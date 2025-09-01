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
import { addProject, type Project, listProjects } from "../../lib/db";
import { saveImageToAppDir } from "../../lib/fs";
import { compressImageStandard, shouldCompress } from "../../lib/image";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

type Props = { open: boolean; onClose: () => void; onSaved?: (projectId: string) => void };

const TONE_OPTIONS = ["warm", "playful", "cozy", "witty", "friendly", "energetic", "Other..."];

export default function NewProjectDialog({ open, onClose, onSaved }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [website, setWebsite] = React.useState<string>("");
  const [dragOver, setDragOver] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [compressing, setCompressing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [toneOption, setToneOption] = React.useState<string>("");
  const [toneCustom, setToneCustom] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) {
      setFiles([]);
      setName("");
      setDescription("");
      setWebsite("");
      setDragOver(false);
      setSaving(false);
      setCompressing(false);
      setToneOption("");
      setToneCustom("");
    }
  }, [open]);

  const onDropFiles = (dropped: FileList | null) => {
    if (!dropped) return;
    const imgs = Array.from(dropped).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...imgs]);
  };

  const handleSave = async () => {
    if (files.length === 0 || !name.trim()) return;
    
    setSaving(true);
    setCompressing(true);
    try {

      // Compress images before saving
      const compressedImages = await Promise.all(
        files.map(async (file) => {
          if (shouldCompress(file)) {
            return await compressImageStandard(file);
          }
          return file;
        })
      );

      setCompressing(false);

      const savedImages = [] as Project["images"];
      for (const f of compressedImages) {
        const meta = await saveImageToAppDir(f);
        savedImages.push(meta);
      }

      const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
      // Determine next position (append to end)
      const existing = await listProjects();
      const nextPos = existing.length;
      const project: Project = {
        id,
        name: name.trim(),
        description: description.trim(),
        images: savedImages,
        tone: (toneOption === "Other..." ? toneCustom.trim() : toneOption) || undefined,
        website: website.trim() || undefined,
        createdAt: Date.now(),
        position: nextPos,
      };
      await addProject(project);
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
      <DialogTitle>Create Project</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          <TextField
            fullWidth
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            placeholder="Supports simple markdown like **bold** and *italic*"
          />

          <TextField
            fullWidth
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            type="url"
          />

          {/* Tone */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="tone-label">Tone</InputLabel>
              <Select
                labelId="tone-label"
                value={toneOption}
                label="Tone"
                onChange={(e) => setToneOption(e.target.value)}
              >
                {TONE_OPTIONS.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {toneOption === "Other..." && (
              <TextField
                fullWidth
                label="Custom Tone"
                value={toneCustom}
                onChange={(e) => setToneCustom(e.target.value)}
              />
            )}
          </Box>

          {/* Hashtags moved to generator */}
        </Box>

        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onDropFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          sx={{
            mt: 2,
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
          <Box sx={{ mb: 2, mt: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || files.length === 0 || !name.trim()} 
          variant="contained"
          startIcon={compressing ? <CircularProgress size={16} /> : undefined}
        >
          {compressing ? 'Compressing...' : 'Save Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
