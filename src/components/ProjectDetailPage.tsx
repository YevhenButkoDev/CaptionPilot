import * as React from "react";
import { Box, Typography, IconButton, ImageList, ImageListItem, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Chip, Stack, Fab } from "@mui/material";
import { ArrowBack, Add, Remove } from "@mui/icons-material";
import { getProject, updateProject, type Project, getLibraryHandle } from "../lib/db";
import { getImageUrl, saveImageToDir, ensurePermissions, deleteImageFromDir } from "../lib/fs";
import { compressImageToFile, shouldCompress } from "../lib/image";

function renderMarkdownToHtml(src: string): string {
  // Minimal markdown: **bold**, *italic*, line breaks preserved, with basic escaping
  let html = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

interface ProjectDetailPageProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetailPage({ projectId, onBack }: ProjectDetailPageProps) {
  const [project, setProject] = React.useState<Project | null>(null);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [addImagesOpen, setAddImagesOpen] = React.useState(false);
  const [newFiles, setNewFiles] = React.useState<File[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [compressing, setCompressing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectData = await getProject(projectId);
      if (!projectData) {
        setError("Project not found");
        setLoading(false);
        return;
      }
      
      setProject(projectData);
      
      // Load project images
      const dir = await getLibraryHandle();
      if (dir && projectData.images.length > 0) {
        const urls = await Promise.all(
          projectData.images.map(img => getImageUrl(dir, img.fileName))
        );
        setImageUrls(urls);
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // no-op here; deletion handled from the projects grid
  };

  const handleRemoveImage = async (imageIndex: number) => {
    if (!project || !window.confirm("Are you sure you want to remove this image?")) {
      return;
    }

    try {
      // Create new project with removed image
      const updatedImages = [...project.images];
      updatedImages.splice(imageIndex, 1);
      
      const updatedProject: Project = {
        ...project,
        images: updatedImages,
      };

      // Update in database
      await updateProject(updatedProject);
      setProject(updatedProject);
      
      // Delete underlying file
      try {
        const dir = await getLibraryHandle();
        if (dir) {
          await deleteImageFromDir(dir, project.images[imageIndex].fileName);
        }
      } catch {}
      
      // Update image URLs
      const newUrls = [...imageUrls];
      newUrls.splice(imageIndex, 1);
      setImageUrls(newUrls);
    } catch (error) {
      console.error("Failed to remove image:", error);
    }
  };

  const onDropFiles = (dropped: FileList | null) => {
    if (!dropped) return;
    const imgs = Array.from(dropped).filter(f => f.type.startsWith("image/"));
    setNewFiles(prev => [...prev, ...imgs]);
  };

  const handleAddImages = async () => {
    if (newFiles.length === 0) return;
    
    setSaving(true);
    setCompressing(true);
    try {
      const dir = await getLibraryHandle();
      if (!dir) {
        setSaving(false);
        setCompressing(false);
        return;
      }
      
      const ok = await ensurePermissions(dir, "readwrite");
      if (!ok) {
        setSaving(false);
        setCompressing(false);
        return;
      }

      // Compress images before saving
      const compressedImages = await Promise.all(
        newFiles.map(async (file) => {
          if (shouldCompress(file)) {
            return await compressImageToFile(file);
          }
          return file;
        })
      );

      setCompressing(false);

      const savedImages = [] as any[];
      for (const f of compressedImages) {
        const meta = await saveImageToDir(dir, f);
        savedImages.push(meta);
      }

      // Add new images to existing project
      if (project) {
        const updatedProject: Project = {
          ...project,
          images: [...project.images, ...savedImages],
        };
        
        // Update in database
        await updateProject(updatedProject);
        setProject(updatedProject);
        
        // Load new image URLs
        const newUrls = await Promise.all(
          savedImages.map(img => getImageUrl(dir, img.fileName))
        );
        setImageUrls(prev => [...prev, ...newUrls]);
      }

      setAddImagesOpen(false);
      setNewFiles([]);
    } catch (e) {
      console.error("Failed to add images:", e);
    } finally {
      setSaving(false);
      setCompressing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography>Loading project...</Typography>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">{error || "Project not found"}</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>Go Back</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      {/* Header with back only */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <IconButton onClick={onBack} size="large">
          <ArrowBack />
        </IconButton>
      </Box>

      {/* Info box (same width style as metadata box) */}
      <Box sx={{ mb: 3, p: 2, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1 }}>
          {project.name}
        </Typography>
        {project.description && (
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ mb: 1 }}
            component="div"
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(project.description) }}
          />
        )}
        {(project.moods && project.moods.length > 0) && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Moods</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {project.moods.map((m, i) => (<Chip key={`${m}-${i}`} label={m} size="small" />))}
            </Stack>
          </Box>
        )}
        {(project.postIdeas && project.postIdeas.length > 0) && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Post Ideas</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {project.postIdeas.map((m, i) => (<Chip key={`${m}-${i}`} label={m} size="small" />))}
            </Stack>
          </Box>
        )}
      </Box>

      {/* Project metadata */}
      <Box sx={{ mb: 3, p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Created: {new Date(project.createdAt).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Images: {project.images.length}
        </Typography>
      </Box>

      {/* Images grid */}
      {project.images.length > 0 ? (
        <ImageList
          cols={3}
          rowHeight={300}
          gap={8}
          sx={{
            width: "100%",
            overflow: "visible",
          }}
        >
          {imageUrls.map((url, index) => (
            <ImageListItem key={index} sx={{ position: "relative" }}>
              <Box
                component="img"
                src={url}
                alt={`Project image ${index + 1}`}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 1,
                  cursor: "pointer",
                  "&:hover": {
                    opacity: 0.9,
                    transition: "opacity 0.2s"
                  }
                }}
                onClick={() => {
                  window.open(url, '_blank');
                }}
              />
              {/* Remove image button */}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(index);
                }}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  bgcolor: "error.main",
                  color: "white",
                  "&:hover": { bgcolor: "error.dark" },
                  width: 32,
                  height: 32,
                }}
                size="small"
              >
                <Remove />
              </IconButton>
            </ImageListItem>
          ))}
        </ImageList>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          This project has no images yet. Click "Add Images" to get started.
        </Alert>
      )}

      {/* Floating Add Images Button */}
      <Fab 
        color="primary" 
        aria-label="add-images"
        onClick={() => setAddImagesOpen(true)}
        sx={{ position: "fixed", right: 24, bottom: 24 }}
      >
        <Add />
      </Fab>

      {/* Add Images Dialog */}
      <Dialog open={addImagesOpen} onClose={() => setAddImagesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Add Images to Project</DialogTitle>
        <DialogContent>
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onDropFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            sx={{
              p: 2,
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              borderRadius: 2,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragOver ? 'action.hover' : 'transparent',
              userSelect: 'none',
            }}
          >
            <Typography variant="body1">Drag & drop images here, or click to select</Typography>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => onDropFiles(e.target.files)}
            />
          </Box>
          
          {newFiles.length > 0 && (
            <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {newFiles.map((file, idx) => (
                <Box key={`${file.name}-${idx}`} sx={{ position: 'relative', width: '100%', pt: '100%', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.default' }}>
                  <Box
                    component="img"
                    alt={file.name}
                    src={URL.createObjectURL(file)}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onLoad={(e) => URL.revokeObjectURL((e.currentTarget as HTMLImageElement).src)}
                  />
                  {shouldCompress(file) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Will compress
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddImagesOpen(false)} disabled={saving}>Cancel</Button>
          <Button 
            onClick={handleAddImages} 
            disabled={saving || newFiles.length === 0} 
            variant="contained"
            startIcon={compressing ? <CircularProgress size={16} /> : undefined}
          >
            {compressing ? 'Compressing...' : 'Add Images'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
