import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { addPinterestPost, type PinterestPost } from "../../lib/db";
import { saveImageToAppDir } from "../../lib/fs";
import { compressImageToFile, shouldCompress } from "../../lib/image";

type Props = { open: boolean; onClose: () => void; onSaved?: (postId: string) => void };

export default function NewPinterestPostDialog({ open, onClose, onSaved }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [description, setDescription] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [compressing, setCompressing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFiles([]);
      setDescription("");
      setWebsiteUrl("");
      setDragOver(false);
      setSaving(false);
      setCompressing(false);
    }
  }, [open]);

  const onDropFiles = (dropped: FileList | null) => {
    if (!dropped) return;
    const imgs = Array.from(dropped).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...imgs]);
  };

  const handleSave = async () => {
    if (files.length === 0) {
      return;
    }

    setSaving(true);
    setCompressing(true);
    try {
      // Compress images before saving
      const compressedImages = await Promise.all(
        files.map(async (file) => {
          if (shouldCompress(file)) {
            return await compressImageToFile(file);
          }
          return file;
        })
      );

      setCompressing(false);

      const savedImages = [] as PinterestPost["images"];
      const originalFiles: PinterestPost["originalFiles"] = [];
      
      for (const f of compressedImages) {
        const meta = await saveImageToAppDir(f);
        savedImages.push(meta);
        
        // Store original file metadata for Cloudinary upload
        originalFiles.push({
          name: f.name,
          type: f.type,
          size: f.size,
          lastModified: f.lastModified
        });
      }

      const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
      const post: PinterestPost = {
        id,
        createdAt: Date.now(),
        description,
        images: savedImages,
        originalFiles,
        position: -1, // Place new post at the start
        websiteUrl: websiteUrl || undefined,
        status: 'new',
      };
      await addPinterestPost(post);
      onSaved?.(id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setCompressing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Pinterest Post</DialogTitle>
      <DialogContent>
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onDropFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          sx={{
            mt: 1,
            mb: 2,
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

        {files.length > 0 && (
          <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {files.map((file, idx) => (
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

        <TextField
          fullWidth
          label="Pin Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          placeholder="Enter your Pinterest pin description..."
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Website URL (Optional)"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
          helperText="Add a website link to your pin (optional)"
          sx={{ mb: 3 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || files.length === 0 || !description.trim()} 
          variant="contained"
          startIcon={compressing ? <CircularProgress size={16} /> : undefined}
        >
          {compressing ? 'Compressing...' : 'Save Pinterest Post'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
