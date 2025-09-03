import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChevronLeft, ChevronRight, Close, Delete, Save as SaveIcon, CloudUpload } from "@mui/icons-material";
import {type DraftPost, updateDraftPost} from "../../lib/db";
import { getImageUrlFromAppDir } from "../../lib/fs";
import { MenuItem, Select, FormControl, InputLabel, Button, TextField, Alert, CircularProgress } from "@mui/material";
import {confirm} from "@tauri-apps/plugin-dialog";
import { uploadInstagramPostImages, hasCloudinaryImages } from "../../lib/postUpload";
import { canUseCloudinary } from "../../lib/cloudinaryUtils";

interface PostDetailModalProps {
  post: DraftPost | null;
  open: boolean;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onPostUpdated?: (post: DraftPost) => void;
}

export default function PostDetailModal({ post, open, onClose, onDelete, onPostUpdated }: PostDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [captionIndex, setCaptionIndex] = React.useState<number>(post?.selectedCaptionIndex ?? 0);
  const [captionDraft, setCaptionDraft] = React.useState<string>(post?.caption ?? "");
  const [saving, setSaving] = React.useState(false);
  const [localCaptions, setLocalCaptions] = React.useState<string[] | null>(post?.aiCaptions ?? null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishResult, setPublishResult] = React.useState<{ success: boolean; message: string } | null>(null);


  React.useEffect(() => {
    if (open && post) {
      setCurrentImageIndex(0);
      setCaptionIndex(post.selectedCaptionIndex ?? 0);
      setCaptionDraft(post.caption || "");
      setLocalCaptions(post.aiCaptions ?? null);
      loadImages();
    }
  }, [open, post]);

  const loadImages = async () => {
    if (!post) return;
    
    setLoading(true);
    try {
      const urls = await Promise.all(
        post.images.map(img => getImageUrlFromAppDir(img.fileName))
      );
      setImageUrls(urls);
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : post!.images.length - 1
    );
  };

  const handleNext = () => {
    setCurrentImageIndex(prev => 
      prev < post!.images.length - 1 ? prev + 1 : 0
    );
  };

  const handleSetAsMain = async () => {
    if (!post) return;
    try {
      const images = [...post.images];
      const [selected] = images.splice(currentImageIndex, 1);
      images.unshift(selected);
      const updated: DraftPost = { ...post, images };
      await updateDraftPost(updated);
      // Reorder local urls to match without refetch
      setImageUrls(prev => {
        if (!prev || prev.length === 0) return prev;
        const urls = [...prev];
        const [u] = urls.splice(currentImageIndex, 1);
        urls.unshift(u);
        return urls;
      });
      setCurrentImageIndex(0);
      onPostUpdated?.(updated);
    } catch (e) {
      // ignore
    }
  };

  const handleDelete = async () => {
    const accepted = await confirm("Are you sure you want to delete this post?", {
      title: "Confirm deletion",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (post && accepted) {
      onDelete(post.id);
      onClose();
    }
  };

  const handleClose = () => {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    setImageUrls([]);
    onClose();
  };

  const handleCaptionChange = async (index: number) => {
    if (!post) return;
    try {
      const source = localCaptions && localCaptions.length > 0 ? localCaptions : [post.caption];
      const updated: DraftPost = { ...post, selectedCaptionIndex: index, caption: source[index] ?? post.caption };
      await updateDraftPost(updated);
      setCaptionIndex(index);
      setCaptionDraft(updated.caption);
      onPostUpdated?.(updated);
    } catch (e) {
      // ignore persist error
    }
  };

  const handleSaveCaption = async () => {
    if (!post) return;
    try {
      setSaving(true);
      const finalCaption = captionDraft;
      const updated: DraftPost = { ...post, caption: finalCaption, aiCaptions: [finalCaption], selectedCaptionIndex: 0 };
      await updateDraftPost(updated);
      setLocalCaptions([finalCaption]);
      setCaptionIndex(0);
      onPostUpdated?.(updated);
    } catch (e) {
      // ignore
    } finally {
      setSaving(false);
    }
  };



  const handlePublish = async () => {
    if (!post) return;
    
    setPublishing(true);
    setPublishResult(null);
    
    try {
      const result = await uploadInstagramPostImages(post, {
        folder: 'instagram-posts',
        tags: ['social-media', 'automated']
      });
      
      if (result.success) {
        let message = `Successfully uploaded ${result.cloudinaryImages?.length || 0} image(s) to Cloudinary!`;
        
        if (result.instagramPostId) {
          message += ` Post published to Instagram with ID: ${result.instagramPostId}`;
        } else if (result.error && result.error.includes('Instagram')) {
          message += ` Note: ${result.error}`;
        }
        
        setPublishResult({
          success: true,
          message: message
        });
        
        // Update the post in the parent component with the updated post from the result
        if (result.cloudinaryImages) {
          const updatedPost = {
            ...post,
            cloudinaryImages: result.cloudinaryImages,
            instagramPostId: result.instagramPostId,
            instagramContainerId: result.instagramContainerId
            // Status remains unchanged - we use instagramPostId as the indicator
          };
          onPostUpdated?.(updatedPost);
        }
      } else {
        setPublishResult({
          success: false,
          message: result.error || 'Upload failed'
        });
      }
    } catch (error) {
      setPublishResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to publish to Cloudinary"
      });
    } finally {
      setPublishing(false);
    }
  };

  if (!post) return null;

  const captions = localCaptions && localCaptions.length > 0 ? localCaptions : [post.caption];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: "1400px",
          width: "100%",
          height: "1000px",
          borderRadius: 0,
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: "flex", height: "100%", overflow: "hidden" }}>
        {/* Left side - Image carousel */}
        <Box sx={{ 
          flex: "1", 
          position: "relative", 
          bgcolor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0
        }}>
          {loading ? (
            <Typography color="white">Loading...</Typography>
          ) : imageUrls.length > 0 ? (
            <>
              <Box
                component="img"
                src={imageUrls[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                sx={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  userSelect: "none"
                }}
              />
              {post.images.length > 1 && (
                <>
                  <IconButton
                    onClick={handlePrevious}
                    sx={{ position: "absolute", left: 8, color: "white", bgcolor: "rgba(0,0,0,0.5)", "&:hover": { bgcolor: "rgba(0,0,0,0.7)" } }}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    onClick={handleNext}
                    sx={{ position: "absolute", right: 8, color: "white", bgcolor: "rgba(0,0,0,0.5)", "&:hover": { bgcolor: "rgba(0,0,0,0.7)" } }}
                  >
                    <ChevronRight />
                  </IconButton>
                  {/* Slider dots */}
                  <Box sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 1 }}>
                    {imageUrls.map((_, idx) => (
                      <Box key={idx} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: idx === currentImageIndex ? 'white' : 'rgba(255,255,255,0.5)' }} />
                    ))}
                  </Box>
                </>
              )}
            </>
          ) : (
            <Typography color="white">No images found</Typography>
          )}
        </Box>

        {/* Right side - Caption and actions */}
        <Box sx={{ width: "500px", p: 3, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>Post Details</Typography>

            </Box>
            <Box>
              <IconButton onClick={handleDelete} sx={{ color: "error.main", mr: 1 }} size="small">
                <Delete />
              </IconButton>
              <IconButton onClick={handleClose} size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>

          {captions.length > 1 && (
            <FormControl fullWidth sx={{ mb: 1, flexShrink: 0 }}>
              <InputLabel id="caption-select-label">AI Captions</InputLabel>
              <Select labelId="caption-select-label" value={captionIndex} label="AI Captions" onChange={(e) => handleCaptionChange(Number(e.target.value))}>
                {captions.map((_, idx) => (<MenuItem key={idx} value={idx}>{`Caption ${idx + 1}`}</MenuItem>))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", mb: 2 }}>
            <TextField value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} multiline fullWidth minRows={6} sx={{ width: "100%", '& textarea': { overflow: 'auto' } }} />
          </Box>
          
          {/* Button Row */}
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            {post.images.length > 1 && (
              <Button variant="outlined" size="small" onClick={handleSetAsMain} sx={{ flex: 1 }}>
                Set as main
              </Button>
            )}
            <Button variant="contained" size="small" onClick={handleSaveCaption} startIcon={<SaveIcon />} disabled={saving} sx={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handlePublish}
              disabled={publishing || !canUseCloudinary() || hasCloudinaryImages(post) || post.instagramPostId}
              startIcon={publishing ? <CircularProgress size={16} /> : <CloudUpload />}
              sx={{ flex: 1 }}
            >
              {publishing ? 'Publishing...' : post.instagramPostId ? 'Published' : 'Publish'}
            </Button>
          </Box>

          {publishResult && (
              <Alert
                  severity={publishResult.success ? "success" : "error"}
                  sx={{ mb: 2, fontSize: "0.875rem" }}
                  onClose={() => setPublishResult(null)}
              >
                {publishResult.message}
              </Alert>
          )}

          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #dbdbdb", flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary">Created: {new Date(post.createdAt).toLocaleDateString()}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">Images: {post.images.length}</Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
