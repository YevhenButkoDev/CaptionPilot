import * as React from "react";
import { ImageList, ImageListItem, Box, Typography } from "@mui/material";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import AddPinterestPostFab from "../features/posts/AddPinterestPostFab";
import PinterestPostDetailModal from "../features/posts/PinterestPostDetailModal";
import { listPinterestPosts, deletePinterestPost, type PinterestPost } from "../lib/db";
import { listSchedules } from "../lib/db";
import { getImageUrlFromAppDir, deleteImageFromAppDir } from "../lib/fs";
import ScheduleButton from "./ScheduleButton.tsx";

type GridItem = { id: string; url: string; post: PinterestPost };

export default function PinterestFeed() {
    const [items, setItems] = React.useState<GridItem[]>([]);
    const [imageCache] = React.useState(new Map<string, string>());
    const [bannerNeeded, setBannerNeeded] = React.useState(false);
    const [hasSchedule, setHasSchedule] = React.useState(false);
    const [selectedPost, setSelectedPost] = React.useState<PinterestPost | null>(null);
    const [modalOpen, setModalOpen] = React.useState(false);



    const loadPinterestPosts = async (forceReload = false) => {
        if (!forceReload && items.length > 0) return;
        
        try {
            const posts = await listPinterestPosts();
            if (posts.length === 0) {
                setBannerNeeded(true);
                setItems([]);
                return;
            }

            const firstImages = await Promise.all(
                posts.map(async (p) => {
                    if (!p.images || p.images.length === 0) return null;
                    
                    const img = p.images[0]; // Pinterest posts have one image
                    
                    // Check cache first
                    if (imageCache.has(p.id)) {
                        return { id: p.id, url: imageCache.get(p.id)!, post: p } as GridItem;
                    }
                    
                    // Load new image and cache it
                    const url = await getImageUrlFromAppDir(img.fileName);
                    imageCache.set(p.id, url);
                    return { id: p.id, url, post: p } as GridItem;
                })
            );
            
            setBannerNeeded(false);
            setItems(firstImages.filter(Boolean) as GridItem[]);
        } catch (error) {
            console.error("Failed to load Pinterest posts:", error);
            setBannerNeeded(true);
        }
    };

    React.useEffect(() => {
        void (async () => {
            void loadPinterestPosts();
            try {
                const scheds = await listSchedules();
                setHasSchedule(scheds.length > 0);
            } catch {
                setHasSchedule(false);
            }
        })();
    }, []);

    const handlePostClick = (post: PinterestPost) => {
        setSelectedPost(post);
        setModalOpen(true);
    };

    const handlePostDelete = async (postId: string) => {
        try {
            const gridItem = items.find(i => i.id === postId);
            const post = gridItem?.post;
            if (post) {
                if (!post.projectId) {
                    for (const img of post.images) {
                        try { await deleteImageFromAppDir(img.fileName); } catch {}
                    }
                }
            }
            await deletePinterestPost(postId);
            // Remove from items and cache
            setItems(prev => prev.filter(item => item.id !== postId));
            imageCache.delete(postId);
        } catch (error) {
            console.error("Failed to delete Pinterest post:", error);
        }
    };



    if (bannerNeeded) {
        return (
            <Box sx={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center",
                width: "100%",
                minHeight: "100%",
                pt: 8
            }}>
                <Typography variant="h5" sx={{ mb: 2, color: "text.secondary" }}>
                    No Pinterest Posts Yet
                </Typography>
                <Typography variant="body1" sx={{ mb: 4, color: "text.secondary", textAlign: "center" }}>
                    Create your first Pinterest post using the Generator tab
                </Typography>
                <AddPinterestPostFab onSaved={() => loadPinterestPosts(true)} />
            </Box>
        );
    }

    return (
        <Box sx={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center",
            width: "100%",
            minHeight: "100%"
        }}>
            <ImageList
                cols={3}
                rowHeight={410}
                sx={{
                    width: 930,
                    overflow: "visible",        // use page scroll, not internal
                    gap: 1
                }}
            >
                {items.map((it) => (
                    <PinterestTile 
                        key={it.id} 
                        src={it.url} 
                        post={it.post}
                        showScheduledBadge={hasSchedule && (it.post.status === 'scheduled' || it.post.status === undefined || it.post.status === 'new')}
                        onClick={() => handlePostClick(it.post)}
                        onDelete={() => handlePostDelete(it.id)}
                    />
                ))}
            </ImageList>

            <AddPinterestPostFab onSaved={() => loadPinterestPosts(true)} />
            <ScheduleButton type="pinterest" />

            {selectedPost && (
                <PinterestPostDetailModal
                    open={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedPost(null);
                    }}
                    post={selectedPost}
                    onDelete={() => {
                        handlePostDelete(selectedPost.id);
                        setModalOpen(false);
                        setSelectedPost(null);
                    }}
                    onPostUpdated={(updatedPost) => {
                        // Update the selected post and refresh the feed
                        setSelectedPost(updatedPost);
                        loadPinterestPosts(true);
                    }}
                />
            )}
        </Box>
    );
}

function PinterestTile({ 
    src, 
    post,
    showScheduledBadge, 
    onClick
}: { 
    src: string; 
    post: PinterestPost;
    showScheduledBadge: boolean; 
    onClick: () => void; 
    onDelete: () => void;
}) {
    return (
        <ImageListItem
            sx={{
                position: "relative",
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid #2a2a2a",
                bgcolor: "background.paper",
            }}
        >
            {/* Clickable image */}
            <Box
                component="img"
                src={src}
                alt="Pinterest post"
                sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                    "&:hover": {
                        opacity: 0.9,
                        transition: "opacity 0.2s",
                    },
                }}
                onClick={onClick}
            />
            
            {showScheduledBadge && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        bgcolor: "rgba(0, 0, 0, 0.7)",
                        color: "white",
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        zIndex: 2,
                    }}
                >
                    <AccessTimeIcon sx={{ fontSize: "1rem" }} />
                    Scheduled
                </Box>
            )}
            {post.instagramPostId && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        bgcolor: "rgba(76, 175, 80, 0.9)",
                        color: "white",
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        zIndex: 2,
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: "1rem" }} />
                    Published
                </Box>
            )}
        </ImageListItem>
    );
}
