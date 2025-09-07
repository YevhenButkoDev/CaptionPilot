import * as React from "react";
import { 
  Box, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  Alert,
  CircularProgress,
  Paper,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { listProjects, type Project } from "../lib/db";
import { addDraftPost, type DraftPost } from "../lib/db";
import { addGeneratorTemplate, listGeneratorTemplates, deleteGeneratorTemplate, type GeneratorTemplate } from "../lib/db";
import { cropImageToFormat } from "../lib/imageProcessing";
import { saveImageToAppDir, getImageUrlFromAppDir } from "../lib/fs";
import { compressImageForInstagram, shouldCompress } from "../lib/image";
import logger, { LogContext } from "../lib/logger";

async function generateCaptionWithOpenAI(prompt: string): Promise<string[] | null> {
  try {
    logger.debug(LogContext.POST_GENERATION, 'Starting OpenAI API call');
    
    const savedSettings = localStorage.getItem("app-settings");
    if (!savedSettings) {
      logger.warn(LogContext.POST_GENERATION, 'No app settings found');
      return null;
    }
    
    const { openaiSecretKey } = JSON.parse(savedSettings || '{}');
    if (!openaiSecretKey) {
      logger.warn(LogContext.POST_GENERATION, 'No OpenAI API key found in settings');
      return null;
    }

    logger.debug(LogContext.POST_GENERATION, 'OpenAI API key found, making request');

    const enforcedOutput = 'Output:\n' +
        '- Return 3 captions **strictly in JSON format**, nothing else.\n' +
        '- JSON schema:\n' +
        '\n' +
        '{\n' +
        '  "captions": [\n' +
        '    {\n' +
        '      "id": 1,\n' +
        '      "text": "<caption text>' +
        '    },\n' +
        '    {\n' +
        '      "id": 2,\n' +
        '      "text": "<caption text>' +
        '    },\n' +
        '    {\n' +
        '      "id": 3,\n' +
        '      "text": "<caption text>' +
        '    }\n' +
        '  ]\n' +
        '}';

    // Remove any existing Output section heuristically
    const cleaned = prompt.replace(/\n?Output[\s\S]*$/i, "").trim() + enforcedOutput;

    logger.debug(LogContext.POST_GENERATION, 'Making fetch request to OpenAI');
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiSecretKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a brand copywriter for Instagram." },
          { role: "user", content: cleaned },
        ],
        temperature: 0.8,
      }),
    });

    logger.debug(LogContext.POST_GENERATION, 'OpenAI response received', {
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries())
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error(LogContext.POST_GENERATION, 'OpenAI API error', errorText);
      return null;
    }

    const data = await resp.json();
    logger.debug(LogContext.POST_GENERATION, 'OpenAI response data', { data });
    
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      logger.warn(LogContext.POST_GENERATION, 'No content in OpenAI response');
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      const captions: string[] = Array.isArray(parsed?.captions) ? parsed.captions.map((c: any) => String(c?.text || "").trim()).filter(Boolean) : [];
      logger.debug(LogContext.POST_GENERATION, 'Parsed captions', { captions });
      return captions.length ? captions : null;
    } catch (parseError) {
      logger.error(LogContext.POST_GENERATION, 'Failed to parse OpenAI response as JSON', parseError, { rawText: text });
      return null;
    }
  } catch (error) {
    logger.error(LogContext.POST_GENERATION, 'Error in generateCaptionWithOpenAI', error);
    return null;
  }
}

function uniquePairs(a: string[] = [], b: string[] = []): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const x of a) for (const y of b) pairs.push([x, y]);
  return pairs;
}

function stripHashtags(text: string): string {
  // Remove hash blocks and inline hashtags
  return text
    .replace(/#[^\s#]+/g, "")
    .replace(/\n\s*#+.*$/gms, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

export default function AutoPosts() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [minImages, setMinImages] = React.useState<number>(1);
  const [maxImages, setMaxImages] = React.useState<number>(3);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [numPosts, setNumPosts] = React.useState<number>(1);
  const [ideasInput, setIdeasInput] = React.useState<string>("");
  const [templates, setTemplates] = React.useState<GeneratorTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [generatorMoods, setGeneratorMoods] = React.useState<string>("");
  const [generatorHashtags, setGeneratorHashtags] = React.useState<string>("");
  const [generatorPostFormat, setGeneratorPostFormat] = React.useState<'1:1' | '4:5' | '16:9'>('1:1');
  const [promptInput, setPromptInput] = React.useState<string>("");

  const applyTemplateToForm = React.useCallback((tpl: GeneratorTemplate) => {
    setSelectedProjectId(tpl.projectId);
    setMinImages(tpl.minImages);
    setMaxImages(tpl.maxImages);
    setNumPosts(tpl.numPosts);
    setIdeasInput((tpl.postIdeas || []).join("\n"));
    setGeneratorMoods((tpl.moods || []).join("\n"));
    setGeneratorHashtags(tpl.hashtags || "");
    setGeneratorPostFormat(tpl.postFormat || '1:1');
    setPromptInput(tpl.prompt || "");
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projectsList = await listProjects();
        setProjects(projectsList);
        if (projectsList.length > 0) setSelectedProjectId(projectsList[0].id);
        const tpls = await listGeneratorTemplates();
        setTemplates(tpls);
      } catch (e) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGeneratePosts = async () => {
    if (!selectedProjectId || minImages > maxImages) {
      setError("Please select a project and ensure min images ≤ max images");
      return;
    }
    if (!Number.isFinite(numPosts) || numPosts < 1) {
      setError("Enter a valid number of posts (at least 1)");
      return;
    }
    const userIdeas = ideasInput.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    if (userIdeas.length === 0) {
      setError("Enter at least one Post Idea");
      return;
    }
    const moods = generatorMoods.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    if (!promptInput.trim()) {
      setError("Enter a prompt for AI caption generation");
      return;
    }

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject || selectedProject.images.length === 0) {
      setError("Selected project has no images");
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const generatedPosts = await generatePostsFromProject(selectedProject, minImages, maxImages, promptInput.trim(), numPosts, userIdeas, moods, generatorHashtags.trim());
      setSuccess(`Successfully generated ${generatedPosts.length} posts!`);
    } catch (error) {
      logger.error(LogContext.POST_GENERATION, "Failed to generate posts", error);
      setError("Failed to generate posts");
    } finally {
      setGenerating(false);
    }
  };

  // Helper function to get image file from project metadata
  const getImageFileFromProject = async (imageMeta: { fileName: string; mimeType: string; size: number }): Promise<File | null> => {
    try {
      // Get the image URL from the app directory (Tauri approach)
      const imageUrl = await getImageUrlFromAppDir(imageMeta.fileName);
      if (!imageUrl) {
        logger.warn(LogContext.POST_GENERATION, `Image not found in app directory: ${imageMeta.fileName}`);
        return null;
      }
      
      // Try to fetch the image as a blob and convert to File
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const file = new File([blob], imageMeta.fileName, {
          type: imageMeta.mimeType,
          lastModified: Date.now()
        });
        
        logger.debug(LogContext.POST_GENERATION, 'Successfully loaded image from URL', { fileName: imageMeta.fileName });
        return file;
      } catch (fetchError) {
        // Fallback: try to read the file directly from the file system
        logger.warn(LogContext.POST_GENERATION, 'Fetch failed, trying direct file read', { fileName: imageMeta.fileName, error: fetchError });
        
        const { tauriImports } = await import('../lib/fs');
        const { fs, path } = await tauriImports();
        
        const base = await path.appDataDir();
        const absPath = await path.join(base, 'images', imageMeta.fileName);
        
        const fileBytes = await fs.readFile(absPath, { baseDir: fs.BaseDirectory.AppData });
        const blob = new Blob([fileBytes], { type: imageMeta.mimeType });
        const file = new File([blob], imageMeta.fileName, {
          type: imageMeta.mimeType,
          lastModified: Date.now()
        });
        
        logger.debug(LogContext.POST_GENERATION, 'Successfully loaded image from direct file read', { fileName: imageMeta.fileName });
        return file;
      }
    } catch (error) {
      logger.error(LogContext.POST_GENERATION, 'Error loading image from project', error);
      return null;
    }
  };

  const generatePostsFromProject = async (
    project: Project, 
    minImages: number, 
    maxImages: number,
    prompt: string,
    desiredCount: number,
    userIdeas: string[],
    moods: string[],
    hashtags: string
  ): Promise<DraftPost[]> => {
    const { images, description, tone } = project;
    const posts: DraftPost[] = [];

    const totalImages = images.length;
    const maxImagesPerPost = Math.min(maxImages, 6);
    const minImagesPerPost = Math.min(minImages, maxImagesPerPost);
    
    if (totalImages < minImagesPerPost) {
      throw new Error(`Project has only ${totalImages} images, but minimum is ${minImagesPerPost}`);
    }

    // Build pool of unique mood/idea pairs using user ideas, not project ideas
    let pairs = uniquePairs(moods || [], userIdeas);

    if (pairs.length < desiredCount) {
      throw new Error('The mood - ideas combination is lower that desired posts count of ' + desiredCount);
    }

    let imageIndex = 0;
    while (imageIndex < totalImages && posts.length < desiredCount) {

      if (pairs.length === 0) break;

      const remainingImages = totalImages - imageIndex;
      let imagesForThisPost: number;
      if (remainingImages <= maxImagesPerPost) imagesForThisPost = remainingImages;
        else if (remainingImages >= minImagesPerPost * 2) imagesForThisPost = maxImagesPerPost;
        else imagesForThisPost = Math.ceil(remainingImages / 2);
      imagesForThisPost = Math.min(imagesForThisPost, 6);

      const postImages = images.slice(imageIndex, imageIndex + imagesForThisPost);
      
      // Crop images to the selected format
      const croppedImages = await Promise.all(
        postImages.map(async (imageMeta) => {
          // Get the actual image file from the project
          const imageFile = await getImageFileFromProject(imageMeta);
          if (!imageFile) {
            throw new Error(`Failed to load image: ${imageMeta.fileName}`);
          }
          
          // Compress with high quality for Instagram if needed
          let processedFile = imageFile;
          if (shouldCompress(imageFile)) {
            processedFile = await compressImageForInstagram(imageFile, generatorPostFormat);
          }
          
          // Crop the image to the selected format
          const croppedFile = await cropImageToFormat(processedFile, generatorPostFormat);
          
          // Save the cropped image to app directory
          const savedImage = await saveImageToAppDir(croppedFile);
          
          return savedImage;
        })
      );

      const idx = Math.floor(Math.random() * pairs.length);
      const [chosenMood, chosenIdea] = pairs.splice(idx, 1)[0];

      const resultMood = `moods - ${chosenMood}, post ideas - ${chosenIdea}`.trim();

      const filledPrompt = prompt
        .replace(/[\u00A0\u2007\u202F\u2009\u200A\u200B\uFEFF]/g, ' ')
        .replace(/\{\s*Tone\s*\}/g, tone ?? '')
        .replace(/\{\s*Project\s*Description\s*\}/g, description ?? '')
        .replace(/\{\s*Mood\s*\}/g, resultMood ?? '');

      if (filledPrompt.includes("{ Mood }")) {
        throw Error("Mood is not replaced")
      }

      const aiCaptions = await generateCaptionWithOpenAI(filledPrompt);
      if (aiCaptions == null) {
        throw new Error('Error while generating AI Captions');
      }
      const cleanedCaptions = aiCaptions.map(c => {
        const noTags = stripHashtags(c);
        return hashtags ? `${noTags}\n\n${hashtags}` : noTags;
      });
      const selectedIndex = Math.floor(Math.random() * cleanedCaptions.length);

      const post: DraftPost = {
        id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
        createdAt: Date.now(),
        caption: cleanedCaptions[selectedIndex],
        aiCaptions: cleanedCaptions,
        selectedCaptionIndex: selectedIndex,
        images: croppedImages,
        originalFiles: postImages.map(img => ({
          name: img.fileName,
          type: img.mimeType,
          size: img.size,
          lastModified: Date.now()
        })),
        postFormat: generatorPostFormat,
        position: posts.length,
        projectId: project.id,
        status: 'new',
      };

      await addDraftPost(post);
      posts.push(post);
      imageIndex += imagesForThisPost;
    }

    return posts;
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const canGenerate = selectedProject && selectedProject.images.length > 0 && minImages <= maxImages && numPosts >= 1 && promptInput.trim();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
        Auto Posts Generator
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Source Project</InputLabel>
          <Select
            value={selectedProjectId}
            label="Source Project"
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name} ({project.images.length} images)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField label="Min images per post" type="number" value={minImages} onChange={(e) => setMinImages(Number(e.target.value))} inputProps={{ min: 1, max: 6 }} sx={{ flex: 1 }} />
          <TextField label="Max images per post" type="number" value={maxImages} onChange={(e) => setMaxImages(Number(e.target.value))} inputProps={{ min: 1, max: 6 }} sx={{ flex: 1 }} />
          <TextField label="# of posts" type="number" value={numPosts} onChange={(e) => setNumPosts(Number(e.target.value))} inputProps={{ min: 1 }} sx={{ flex: 1 }} />
        </Box>

        <TextField
          fullWidth
          label="Post ideas (comma or newline separated)"
          value={ideasInput}
          onChange={(e) => setIdeasInput(e.target.value)}
          multiline
          minRows={3}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            label="Moods (comma or newline separated)"
            value={generatorMoods}
            onChange={(e) => setGeneratorMoods(e.target.value)}
            multiline
            minRows={3}
          />
          <TextField
            fullWidth
            label="Hashtags"
            value={generatorHashtags}
            onChange={(e) => setGeneratorHashtags(e.target.value)}
            placeholder="#design #home #cozy"
            multiline
            minRows={3}
          />
        </Box>

        {/* Post Format Selector */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
            Post Format
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(['1:1', '4:5', '16:9'] as const).map((format) => (
              <Box
                key={format}
                onClick={() => setGeneratorPostFormat(format)}
                sx={{
                  flex: 1,
                  p: 2,
                  border: '2px solid',
                  borderColor: generatorPostFormat === format ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: generatorPostFormat === format ? 'primary.light' : 'transparent',
                  color: generatorPostFormat === format ? 'primary.contrastText' : 'text.primary',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: generatorPostFormat === format ? 'primary.light' : 'action.hover',
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {format === '1:1' ? 'Square (1:1)' : format === '4:5' ? 'Portrait (4:5)' : 'Landscape (16:9)'}
                </Typography>
                <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                  {format === '1:1' ? '1080×1080' : format === '4:5' ? '1080×1350' : '1080×607'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <TextField
          fullWidth
          label="AI Prompt"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          multiline
          minRows={4}
          placeholder="Use placeholders: { Tone }, { Mood }, { Project Description }"
          helperText="This prompt will be used to generate captions. Include placeholders for dynamic content."
          sx={{ mb: 3 }}
        />
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => setTemplateDialogOpen(true)}
          disabled={!canGenerate || generating}
        >
          Save as template
        </Button>
        
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleGeneratePosts}
          disabled={!canGenerate || generating}
          startIcon={generating ? <CircularProgress size={20} /> : undefined}
        >
          {generating ? "Generating Posts..." : "Generate Posts"}
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ p: 2, pb: 1 }}>Saved Templates</Typography>
      <Paper sx={{ p: 0, mb: 3 }}>
        {templates.length === 0 ? (
          <Box sx={{ p: 2, pt: 0 }}>
            <Typography color="text.secondary">No templates saved.</Typography>
          </Box>
        ) : (
          <List>
            {templates.map((t, idx) => {
              const formatDisplay = t.postFormat === '1:1' ? 'Square' : t.postFormat === '4:5' ? 'Portrait' : 'Landscape';
              const secondary = `${t.numPosts} posts • ${t.minImages}-${t.maxImages} images/post • ${formatDisplay}`;
              return (
                <React.Fragment key={t.id}>
                  <ListItem
                    onClick={() => applyTemplateToForm(t)}
                    sx={{ cursor: 'pointer',
                      "&:hover": {
                        backgroundColor: "#373737", // light gray highlight
                      }, }}
                    secondaryAction={
                      <Tooltip title="Delete template">
                        <IconButton edge="end" aria-label="delete" onClick={async (e) => { e.stopPropagation(); await deleteGeneratorTemplate(t.id); const refreshed = await listGeneratorTemplates(); setTemplates(refreshed); }}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemText primary={t.name} secondary={secondary} />
                  </ListItem>
                  {idx < templates.length - 1 && <Divider component="li" />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Paper>

      {/* Template Save Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogTitle>Save as template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template name"
            fullWidth
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            const userIdeas = ideasInput.split(/\n|,/).map(s => s.trim()).filter(Boolean);
            if (!templateName.trim() || !selectedProjectId || minImages > maxImages || userIdeas.length === 0 || !promptInput.trim()) {
              return;
            }
            const moods = generatorMoods.split(/\n|,/).map(s => s.trim()).filter(Boolean);
            const tpl: GeneratorTemplate = {
              id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
              name: templateName.trim(),
              projectId: selectedProjectId,
              minImages,
              maxImages,
              prompt: promptInput.trim(),
              postIdeas: userIdeas,
              moods,
              hashtags: generatorHashtags.trim() || undefined,
              numPosts,
              postFormat: generatorPostFormat,
              createdAt: Date.now(),
            };
            await addGeneratorTemplate(tpl);
            const refreshed = await listGeneratorTemplates();
            setTemplates(refreshed);
            setTemplateDialogOpen(false);
            setTemplateName("");
          }} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
