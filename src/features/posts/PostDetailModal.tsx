import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChevronLeft, ChevronRight, Close, Delete, Save as SaveIcon } from "@mui/icons-material";
import {type DraftPost, getLibraryHandle, updateDraftPost} from "../../lib/db";
import { getImageUrl } from "../../lib/fs";
import { MenuItem, Select, FormControl, InputLabel, Button, TextField } from "@mui/material";

interface PostDetailModalProps {
  post: DraftPost | null;
  open: boolean;
  onClose: () => void;
  onDelete: (postId: string) => void;
}

export default function PostDetailModal({ post, open, onClose, onDelete }: PostDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [captionIndex, setCaptionIndex] = React.useState<number>(post?.selectedCaptionIndex ?? 0);
  const [captionDraft, setCaptionDraft] = React.useState<string>(post?.caption ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && post) {
      setCurrentImageIndex(0);
      setCaptionIndex(post.selectedCaptionIndex ?? 0);
      setCaptionDraft(post.caption || "");
      loadImages();
    }
  }, [open, post]);

  const loadImages = async () => {
    if (!post) return;
    
    setLoading(true);
    try {
      const dir = await getLibraryHandle();
      if (!dir) return;
      
      const urls = await Promise.all(
        post.images.map(img => getImageUrl(dir, img.fileName))
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

  const handleDelete = () => {
    if (post && window.confirm("Are you sure you want to delete this post?")) {
      onDelete(post.id);
      onClose();
    }
  };

  const handleClose = () => {
    // Clean up object URLs
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    setImageUrls([]);
    onClose();
  };

  const handleCaptionChange = async (index: number) => {
    if (!post) return;
    try {
      const updated: DraftPost = { ...post, selectedCaptionIndex: index, caption: post.aiCaptions?.[index] ?? post.caption };
      await updateDraftPost(updated);
      setCaptionIndex(index);
      setCaptionDraft(updated.caption);
    } catch (e) {
      // ignore persist error
    }
  };

  const handleSaveCaption = async () => {
    if (!post) return;
    try {
      setSaving(true);
      const updated: DraftPost = { ...post, caption: captionDraft };
      await updateDraftPost(updated);
    } catch (e) {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (!post) return null;

  const captions = post.aiCaptions && post.aiCaptions.length > 0 ? post.aiCaptions : [post.caption];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: "1000px",
          width: "100%",
          height: "600px",
          borderRadius: 0,
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: "flex", height: "100%" }}>
        {/* Left side - Image carousel */}
        <Box sx={{ 
          flex: "1", 
          position: "relative", 
          bgcolor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {loading ? (
            <Typography color="white">Loading...</Typography>
          ) : imageUrls.length > 0 ? (
            <>
              {/* Main image */}
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
              
              {/* Navigation arrows */}
              {post.images.length > 1 && (
                <>
                  <IconButton
                    onClick={handlePrevious}
                    sx={{
                      position: "absolute",
                      left: 8,
                      color: "white",
                      bgcolor: "rgba(0,0,0,0.5)",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.7)" }
                    }}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    onClick={handleNext}
                    sx={{
                      position: "absolute",
                      right: 8,
                      color: "white",
                      bgcolor: "rgba(0,0,0,0.5)",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.7)" }
                    }}
                  >
                    <ChevronRight />
                  </IconButton>
                </>
              )}
            </>
          ) : (
            <Typography color="white">No images found</Typography>
          )}
        </Box>

        {/* Right side - Caption and actions */}
        <Box sx={{ 
          width: "350px", 
          p: 3, 
          display: "flex", 
          flexDirection: "column",
          borderLeft: "1px solid #dbdbdb"
        }}>
          {/* Header with close and delete */}
          <Box sx={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            mb: 2
          }}>
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              Post Details
            </Typography>
            <Box>
              <IconButton
                onClick={handleDelete}
                sx={{ color: "error.main", mr: 1 }}
                size="small"
              >
                <Delete />
              </IconButton>
              <IconButton onClick={handleClose} size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Caption selector */}
          {post.aiCaptions && post.aiCaptions.length > 0 && (
            <FormControl fullWidth sx={{ mb: 1 }}>
              <InputLabel id="caption-select-label">AI Captions</InputLabel>
              <Select
                labelId="caption-select-label"
                value={captionIndex}
                label="AI Captions"
                onChange={(e) => handleCaptionChange(Number(e.target.value))}
              >
                {post.aiCaptions.map((c, idx) => (
                  <MenuItem key={idx} value={idx}>{`Caption ${idx + 1}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Editable caption */}
          <TextField
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            multiline
            minRows={6}
            sx={{ mb: 1 }}
          />
          <Button variant="contained" size="small" onClick={handleSaveCaption} startIcon={<SaveIcon />} disabled={saving}>
            {saving ? 'Saving...' : 'Save Caption'}
          </Button>

          {/* Meta */}
          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #dbdbdb" }}>
            <Typography variant="caption" color="text.secondary">
              Created: {new Date(post.createdAt).toLocaleDateString()}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Images: {post.images.length}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
