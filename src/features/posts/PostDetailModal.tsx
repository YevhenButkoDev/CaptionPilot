import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChevronLeft, ChevronRight, Close, Delete } from "@mui/icons-material";
import {type DraftPost, getLibraryHandle} from "../../lib/db";
import { getImageUrl } from "../../lib/fs";

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

  React.useEffect(() => {
    console.log('post', post);

    if (open && post) {
      setCurrentImageIndex(0);
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

  if (!post) return null;

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
              
              {/* Image indicators */}
              {post.images.length > 1 && (
                <Box sx={{
                  position: "absolute",
                  bottom: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 1
                }}>
                  {post.images.map((_, index) => (
                    <Box
                      key={index}
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: index === currentImageIndex ? "white" : "rgba(255,255,255,0.5)",
                        cursor: "pointer"
                      }}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </Box>
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

          {/* Caption */}
          <Box sx={{ flex: "1" }}>
            <Typography variant="body1" sx={{ 
              whiteSpace: "pre-wrap", 
              lineHeight: 1.5,
              mb: 2
            }}>
              {post.caption || "No caption"}
            </Typography>
            
            {/* Post metadata */}
            <Box sx={{ mt: "auto", pt: 2, borderTop: "1px solid #dbdbdb" }}>
              <Typography variant="caption" color="text.secondary">
                Created: {new Date(post.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Images: {post.images.length}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
