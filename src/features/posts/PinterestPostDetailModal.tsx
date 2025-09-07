import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChevronLeft, ChevronRight, Close, Delete, Save as SaveIcon, CloudUpload, CheckCircleOutline as CheckCircleOutlineIcon } from "@mui/icons-material";
import { type PinterestPost, updatePinterestPost } from "../../lib/db";
import { getImageUrlFromAppDir } from "../../lib/fs";
import { Button, TextField, Alert, CircularProgress } from "@mui/material";
import { confirm } from "@tauri-apps/plugin-dialog";
import { uploadPinterestPostImages, hasCloudinaryImages } from "../../lib/postUpload";
import { canUseCloudinary } from "../../lib/cloudinaryUtils";
import logger, { LogContext } from "../../lib/logger";

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
  const [publishing, setPublishing] = React.useState(false);
  const [publishResult, setPublishResult] = React.useState<{ success: boolean; message: string } | null>(null);




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
      logger.error(LogContext.DATABASE, "Failed to load images", error);
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
      logger.error(LogContext.DATABASE, "Failed to save Pinterest post", error);
    } finally {
      setSaving(false);
    }
  };



  const handlePublish = async () => {
    if (!post) return;
    
    setPublishing(true);
    setPublishResult(null);
    
    try {
      const result = await uploadPinterestPostImages(post, {
        folder: 'pinterest-posts',
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
          // Update local post state to reflect the Instagram publishing status immediately
          Object.assign(post, updatedPost);
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
          ) : imageUrls.length > 0 ? (
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
          ) : (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: 400,
              color: 'white'
            }}>
              <Typography>No images found</Typography>
            </Box>
          )}
        </Box>

        {/* Content section */}
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Edit Pinterest Post</Typography>
            {(post.cloudinaryImages && post.cloudinaryImages.length > 0) && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5, 
                bgcolor: 'rgba(76, 175, 80, 0.9)', 
                color: 'white', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 2, 
                fontSize: '0.875rem' 
              }}>
                <CheckCircleOutlineIcon sx={{ fontSize: '1rem' }} />
                Published
              </Box>
            )}
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

          {/* Status Messages */}
          {!canUseCloudinary() && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: "0.875rem" }}>
              Cloudinary not configured. Go to Settings to configure your credentials.
            </Alert>
          )}

          {post.id && (
            <Alert severity="success" sx={{ mb: 2, fontSize: "0.875rem" }}>
              This post has been published to Instagram and is ready for social media posting.
            </Alert>
          )}

          {hasCloudinaryImages(post) && !post.id && (
            <Alert severity="info" sx={{ mb: 2, fontSize: "0.875rem" }}>
              This post already has images uploaded to Cloudinary.
            </Alert>
          )}

          {publishResult && (
            <Alert 
              severity={publishResult.success ? "success" : "error"} 
              sx={{ mb: 2, fontSize: "0.875rem" }}
              onClose={() => setPublishResult(null)}
            >
              {publishResult.message}
            </Alert>
          )}

          {/* Button Row */}
          <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
              startIcon={<Delete />}
              sx={{ flex: 1 }}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? undefined : <SaveIcon />}
              sx={{ flex: 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handlePublish}
              disabled={publishing || !canUseCloudinary() || hasCloudinaryImages(post) || post.id !== undefined}
              startIcon={publishing ? <CircularProgress size={16} /> : <CloudUpload />}
              sx={{ flex: 1 }}
            >
              {publishing ? 'Publishing...' : (post.cloudinaryImages && post.cloudinaryImages.length > 0) ? 'Published' : 'Publish'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
