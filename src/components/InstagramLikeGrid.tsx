import * as React from "react";
import { ImageList, ImageListItem, Box } from "@mui/material";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddPostFab from "../features/posts/AddPostFab";
import PostDetailModal from "../features/posts/PostDetailModal";
import ScheduleButton from "./ScheduleButton";
import { listDraftPosts, updateDraftPositions, deleteDraftPost, type DraftPost } from "../lib/db";
import { listSchedules } from "../lib/db";
import { getImageUrlFromAppDir, deleteImageFromAppDir } from "../lib/fs";

type GridItem = { id: string; url: string; post: DraftPost };

export default function DraggableImageList() {
    const [items, setItems] = React.useState<GridItem[]>([]);
    const [bannerNeeded, setBannerNeeded] = React.useState(false);
    const [imageCache, setImageCache] = React.useState<Map<string, string>>(new Map());
    const [selectedPost, setSelectedPost] = React.useState<DraftPost | null>(null);
    const [modalOpen, setModalOpen] = React.useState(false);
    const [hasSchedule, setHasSchedule] = React.useState(false);
    const sortableIds = React.useMemo(() => items.map(i => i.id), [items]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
    );

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setItems((prev) => {
            const oldIndex = prev.findIndex((x) => x.id === active.id);
            const newIndex = prev.findIndex((x) => x.id === over.id);
            return arrayMove(prev, oldIndex, newIndex);
        });
        // persist new order
        const newOrder = items.map(i => i.id);
        const oldIndex = newOrder.indexOf(active.id);
        const overIndex = newOrder.indexOf(over.id);
        const reordered = arrayMove(newOrder, oldIndex, overIndex);
        try {
            await updateDraftPositions(reordered);
        } catch {
            // ignore persist error for now
        }
    };

    React.useCallback(() => {
        // Only revoke URLs that are not in the cache
        items.forEach(i => {
            if (!imageCache.has(i.id)) {
                URL.revokeObjectURL(i.url);
            }
        });
    }, [items, imageCache]);

    const loadDrafts = React.useCallback(async (forceReload = false) => {
        if (!forceReload && imageCache.size > 0 && items.length > 0) {
            return;
        }

        // Tauri app-dir flow doesn't require a picked dir
        const posts = await listDraftPosts();
        
        // Filter to only show Instagram posts (or posts without platform field for backward compatibility)
        const instagramPosts = posts.filter(p => !p.platform || p.platform === 'instagram');
        
        // Create new cache for this load
        const newCache = new Map<string, string>();
        const firstImages = await Promise.all(
            instagramPosts.map(async p => {
                const img = p.images[0];
                if (!img) return null;
                
                // Check if we already have this image cached
                if (imageCache.has(p.id)) {
                    const cachedUrl = imageCache.get(p.id)!;
                    newCache.set(p.id, cachedUrl);
                    return { id: p.id, url: cachedUrl, post: p } as GridItem;
                }
                
                // Load new image and cache it
                const url = await getImageUrlFromAppDir(img.fileName);
                newCache.set(p.id, url);
                return { id: p.id, url, post: p } as GridItem;
            })
        );
        
        setImageCache(newCache);
        setBannerNeeded(false);
        setItems(firstImages.filter(Boolean) as GridItem[]);
    }, [imageCache, items.length]);

    React.useEffect(() => {
        void (async () => {
            void loadDrafts();
            try {
                const scheds = await listSchedules();
                setHasSchedule(scheds.length > 0);
            } catch {
                setHasSchedule(false);
            }
        })();
    }, []);

    const handlePostClick = (post: DraftPost) => {
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
            await deleteDraftPost(postId);
            // Remove from items and cache
            setItems(prev => prev.filter(item => item.id !== postId));
            setImageCache(prev => {
                const newCache = new Map(prev);
                newCache.delete(postId);
                return newCache;
            });
        } catch (error) {
            console.error("Failed to delete post:", error);
        }
    };

    return (
        <Box sx={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center",
            width: "100%",
            minHeight: "100%"
        }}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                {bannerNeeded && null}
                {/* SortableContext makes the children reorderable in a grid */}
                <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                    <ImageList
                        cols={3}
                        rowHeight={410}
                        sx={{
                            width: 930,
                            overflow: "visible",        // use page scroll, not internal
                            touchAction: "none",
                            // optional tiny gutters like IG
                        }}
                        gap={1}
                    >
                        {items.map((it) => (
                            <SortableTile 
                                key={it.id} 
                                id={it.id} 
                                src={it.url} 
                                post={it.post}
                                showScheduledBadge={hasSchedule && (it.post.status === 'scheduled' || it.post.status === undefined || it.post.status === 'new')}
                                onClick={() => handlePostClick(it.post)}
                            />
                        ))}
                    </ImageList>
                </SortableContext>
                <AddPostFab onSaved={() => { void loadDrafts(true); }} />
                <ScheduleButton type="instagram" />
                
                {/* Post Detail Modal */}
                <PostDetailModal
                    post={selectedPost}
                    open={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedPost(null);
                    }}
                    onDelete={handlePostDelete}
                    onPostUpdated={(updated) => {
                        // update selected and items cache
                        setSelectedPost(updated);
                        setItems(prev => prev.map(it => it.id === updated.id ? { ...it, post: updated } : it));
                        // if main image changed, refresh its cached URL for first image only
                        (async () => {
                            try {
                                const first = updated.images[0];
                                if (!first) return;
                                const url = await getImageUrlFromAppDir(first.fileName);
                                setImageCache(prev => {
                                    const next = new Map(prev);
                                    next.set(updated.id, url);
                                    return next;
                                });
                                setItems(prev => prev.map(it => it.id === updated.id ? { ...it, url } : it));
                            } catch {}
                        })();
                    }}
                />
            </DndContext>
        </Box>
    );
}

function SortableTile({ 
    id, 
    src, 
    post,
    onClick,
    showScheduledBadge
}: { 
    id: string; 
    src: string; 
    post: DraftPost;
    onClick: () => void;
    showScheduledBadge?: boolean;
}) {
    const isPublished = post.instagramPostId !== undefined;
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
        useSortable({ id, disabled: isPublished });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging ? 10 : "auto",
    } as React.CSSProperties;

    return (
        <ImageListItem
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            sx={{ userSelect: "none", touchAction: "none", position: 'relative' }}
        >
            <Box
                component="img"
                src={src}
                alt=""
                loading="lazy"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onClick={onClick}
                sx={{ 
                    display: "block", 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "cover",
                    cursor: "pointer",
                    "&:hover": {
                        opacity: 0.9,
                        transition: "opacity 0.2s"
                    }
                }}
            />
            {showScheduledBadge && (
                <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: '2px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AccessTimeIcon fontSize="small" />
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