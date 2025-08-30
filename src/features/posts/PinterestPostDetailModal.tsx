import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChevronLeft, ChevronRight, Close, Delete, Save as SaveIcon } from "@mui/icons-material";
import { type PinterestPost, updatePinterestPost } from "../../lib/db";
import { getImageUrlFromAppDir } from "../../lib/fs";
import { Button, TextField } from "@mui/material";
import { confirm } from "@tauri-apps/plugin-dialog";

interface PinterestPostDetailModalProps {
  post: PinterestPost | null;
  open: boolean;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onPostUpdated?: (post: PinterestPost) => void;
}

export default function PinterestPostDetailModal({ post, open, onClose, onDelete, onPostUpdated }: PinterestPostDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [descriptionDraft, setDescriptionDraft] = React.useState<string>(post?.description ?? "");
  const [websiteUrlDraft, setWebsiteUrlDraft] = React.useState<string>(post?.websiteUrl ?? "");
  const [saving, setSaving] = React.useState(false);



  React.useEffect(() => {
    if (open && post) {
      setCurrentImageIndex(0);
      setDescriptionDraft(post.description || "");
      setWebsiteUrlDraft(post.websiteUrl || "");
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
      const updated: PinterestPost = { ...post, images };
      await updatePinterestPost(updated);
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
    const accepted = await confirm("Are you sure you want to delete this Pinterest post?", {
      title: "Confirm deletion",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (post && accepted) {
      onDelete(post.id);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!post) return;
    
    setSaving(true);
    try {
      const updated: PinterestPost = { 
        ...post, 
        description: descriptionDraft,
        websiteUrl: websiteUrlDraft || undefined
      };
      await updatePinterestPost(updated);
      onPostUpdated?.(updated);
    } catch (error) {
      console.error("Failed to save Pinterest post:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!post) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2,
        }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        {/* Close button */}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)',
            }
          }}
        >
          <Close />
        </IconButton>

        {/* Image section */}
        <Box sx={{ position: 'relative', bgcolor: 'black' }}>
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: 400,
              color: 'white'
            }}>
              <Typography>Loading...</Typography>
            </Box>
          ) : (
            <>
              <Box
                component="img"
                src={imageUrls[currentImageIndex]}
                alt={`Pinterest post image ${currentImageIndex + 1}`}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 500,
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
              
              {/* Navigation arrows */}
              {post.images.length > 1 && (
                <>
                  <IconButton
                    onClick={handlePrevious}
                    sx={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                      }
                    }}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    onClick={handleNext}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                      }
                    }}
                  >
                    <ChevronRight />
                  </IconButton>
                </>
              )}
              
              {/* Image counter */}
              {post.images.length > 1 && (
                <Box sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.875rem'
                }}>
                  {currentImageIndex + 1} / {post.images.length}
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Content section */}
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Edit Pinterest Post</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {post.images.length > 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSetAsMain}
                >
                  Set as Main Image
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleDelete}
                startIcon={<Delete />}
              >
                Delete
              </Button>
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Pin Description"
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            multiline
            minRows={3}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Website URL (Optional)"
            value={websiteUrlDraft}
            onChange={(e) => setWebsiteUrlDraft(e.target.value)}
            placeholder="https://example.com"
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? undefined : <SaveIcon />}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
