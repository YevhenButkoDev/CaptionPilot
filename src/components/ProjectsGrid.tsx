import * as React from "react";
import { ImageList, ImageListItem, Box, Alert, Button, Typography, IconButton } from "@mui/material";
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddProjectFab from "../features/projects/AddProjectFab";
import { getLibraryHandle, listProjects, setLibraryHandle, type Project, deleteProject, deleteDraftPostsByProject } from "../lib/db";
import { ensurePermissions, pickLibraryDir, getImageUrl } from "../lib/fs";
import DeleteIcon from '@mui/icons-material/Delete';

type GridItem = { id: string; project: Project; imageUrl?: string };

export default function ProjectsGrid() {
    const [items, setItems] = React.useState<GridItem[]>([]);
    const [bannerNeeded, setBannerNeeded] = React.useState(false);
    const [imageCache, setImageCache] = React.useState<Map<string, string>>(new Map());

    const loadProjects = React.useCallback(async (forceReload = false) => {
        if (!forceReload && items.length > 0) {
            return;
        }

        const dir = await getLibraryHandle();
        if (!dir) {
            setBannerNeeded(true);
            setItems([]);
            return;
        }
        const has = await ensurePermissions(dir, "readwrite");
        if (!has) {
            setBannerNeeded(true);
            setItems([]);
            return;
        }
        const projects = await listProjects();
        
        // Create new cache for this load
        const newCache = new Map<string, string>();
        const projectItems = await Promise.all(
            projects.map(async p => {
                console.log('project', p)
                const img = p.images[0];
                if (!img) return { id: p.id, project: p };
                
                // Check if we already have this image cached
                if (imageCache.has(p.id)) {
                    const cachedUrl = imageCache.get(p.id)!;
                    newCache.set(p.id, cachedUrl);
                    return { id: p.id, project: p, imageUrl: cachedUrl } as GridItem;
                }
                
                // Load new image and cache it
                try {
                    const url = await getImageUrl(dir, img.fileName);
                    newCache.set(p.id, url);
                    return { id: p.id, project: p, imageUrl: url } as GridItem;
                } catch (error) {
                    console.error("Failed to load project image:", error);
                    return { id: p.id, project: p };
                }
            })
        );
        
        setImageCache(newCache);
        setBannerNeeded(false);
        setItems(projectItems);
    }, [imageCache, items.length]);

    React.useEffect(() => {
        void loadProjects();
    }, []);

    const handleProjectClick = (project: Project) => {
        // Navigate to project detail page
        window.location.hash = `#project/${project.id}`;
    };

    return (
        <>
            {bannerNeeded && (
                <Alert
                    severity="info"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={async () => {
                                try {
                                    const dir = await pickLibraryDir();
                                    await setLibraryHandle(dir);
                                    await loadProjects(true);
                                } catch {
                                    // ignore
                                }
                            }}
                        >
                            Choose Folder
                        </Button>
                    }
                >
                    Choose a local folder to store your projects.
                </Alert>
            )}
            
            <ImageList
                cols={3}
                rowHeight={200}
                sx={{
                    width: 930,
                    overflow: "visible",
                    touchAction: "none",
                }}
                gap={10}
            >
                {items.map((item) => (
                    <ProjectTile 
                        key={item.id} 
                        project={item.project}
                        imageUrl={item.imageUrl}
                        onClick={() => handleProjectClick(item.project)}
                        onDelete={async () => {
                            if (window.confirm("Delete this project and all its generated posts?")) {
                                try {
                                    await deleteDraftPostsByProject(item.project.id);
                                    await deleteProject(item.project.id);
                                    setItems(prev => prev.filter(x => x.id !== item.id));
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                        }}
                    />
                ))}
            </ImageList>
            
            <AddProjectFab onSaved={() => { void loadProjects(true); }} />
        </>
    );
}

function ProjectTile({ 
    project, 
    imageUrl,
    onClick, 
    onDelete,
}: { 
    project: Project; 
    imageUrl?: string;
    onClick: () => void;
    onDelete: () => void;
}) {
    return (
        <ImageListItem
            sx={{ 
                userSelect: "none", 
                cursor: "pointer",
                "&:hover": {
                    opacity: 0.9,
                    transition: "opacity 0.2s"
                }
            }}
            onClick={onClick}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 2,
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {imageUrl ? (
                    <Box
                        component="img"
                        src={imageUrl}
                        alt={project.name}
                        sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            position: "absolute",
                            inset: 0,
                        }}
                    />
                ) : (
                    <DashboardIcon 
                        sx={{ 
                            fontSize: 48, 
                            color: "primary.main",
                            mb: 1
                        }} 
                    />
                )}

                <IconButton 
                    size="small" 
                    sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(0,0,0,0.5)", color: "white", '&:hover': { bgcolor: "rgba(0,0,0,0.7)" }, zIndex: 2 }}
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
                
                {/* Project name overlay */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: "rgba(0,0,0,0.7)",
                        color: "white",
                        p: 1,
                        textAlign: "center",
                    }}
                >
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            fontWeight: "medium",
                            wordBreak: "break-word"
                        }}
                    >
                        {project.name}
                    </Typography>
                </Box>
            </Box>
        </ImageListItem>
    );
}
