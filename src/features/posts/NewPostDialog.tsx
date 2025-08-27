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
import { addDraftPost, type DraftPost, getLibraryHandle, setLibraryHandle, listDraftPosts } from "../../lib/db";
import { ensurePermissions, pickLibraryDir, saveImageToDir } from "../../lib/fs";
import { compressImageToFile, shouldCompress } from "../../lib/image";

type Props = { open: boolean; onClose: () => void; onSaved?: (postId: string) => void };

export default function NewPostDialog({ open, onClose, onSaved }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [caption, setCaption] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [compressing, setCompressing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFiles([]);
      setCaption("");
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
    setSaving(true);
    setCompressing(true);
    try {
      let dir = await getLibraryHandle();
      if (!dir) {
        dir = await pickLibraryDir();
        await setLibraryHandle(dir);
      }
      const ok = await ensurePermissions(dir!, "readwrite");
      if (!ok) {
        setSaving(false);
        setCompressing(false);
        return;
      }

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

      const savedImages = [] as DraftPost["images"];
      for (const f of compressedImages) {
        const meta = await saveImageToDir(dir!, f);
        savedImages.push(meta);
      }

      const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
      // Determine next position (append to end)
      const existing = await listDraftPosts();
      const nextPos = existing.length;
      const post: DraftPost = {
        id,
        createdAt: Date.now(),
        caption,
        images: savedImages,
        position: nextPos,
        status: 'new',
      };
      await addDraftPost(post);
      onSaved?.(id);
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setSaving(false);
      setCompressing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Post</DialogTitle>
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
          label="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          multiline
          minRows={3}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || files.length === 0} 
          variant="contained"
          startIcon={compressing ? <CircularProgress size={16} /> : undefined}
        >
          {compressing ? 'Compressing...' : 'Save locally'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


