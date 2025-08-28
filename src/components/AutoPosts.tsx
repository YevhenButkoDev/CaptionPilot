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
  Chip,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import { List, ListItem, ListItemText, Divider, Tooltip } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { listProjects, type Project } from "../lib/db";
import { addDraftPost, type DraftPost } from "../lib/db";
import { listPrompts, type PromptTemplate } from "../lib/db";
import { addGeneratorTemplate, listGeneratorTemplates, deleteGeneratorTemplate, type GeneratorTemplate } from "../lib/db";

async function generateCaptionWithOpenAI(prompt: string): Promise<string[] | null> {
  try {
    const savedSettings = localStorage.getItem("app-settings");
    if (!savedSettings) return null;
    const { openaiSecretKey } = JSON.parse(savedSettings || '{}');
    if (!openaiSecretKey) return null;

    const enforcedOutput = 'Output:\n' +
        '- Return the captions **strictly in JSON format**, nothing else.\n' +
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

    console.log('open ai response', resp);

    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      const captions: string[] = Array.isArray(parsed?.captions) ? parsed.captions.map((c: any) => String(c?.text || "").trim()).filter(Boolean) : [];
      return captions.length ? captions : null;
    } catch {
      return null;
    }
  } catch {
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
  const [availablePrompts, setAvailablePrompts] = React.useState<PromptTemplate[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<string[]>([]);
  const [numPosts, setNumPosts] = React.useState<number>(1);
  const [ideasInput, setIdeasInput] = React.useState<string>("");
  const [templates, setTemplates] = React.useState<GeneratorTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [generatorMoods, setGeneratorMoods] = React.useState<string>("");
  const [generatorHashtags, setGeneratorHashtags] = React.useState<string>("");

  const applyTemplateToForm = React.useCallback((tpl: GeneratorTemplate) => {
    setSelectedProjectId(tpl.projectId);
    setMinImages(tpl.minImages);
    setMaxImages(tpl.maxImages);
    setNumPosts(tpl.numPosts);
    setSelectedPromptIds(tpl.promptIds);
    setIdeasInput((tpl.postIdeas || []).join("\n"));
    setGeneratorMoods((tpl.moods || []).join("\n"));
    setGeneratorHashtags(tpl.hashtags || "");
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projectsList = await listProjects();
        setProjects(projectsList);
        if (projectsList.length > 0) setSelectedProjectId(projectsList[0].id);
        const prompts = await listPrompts();
        setAvailablePrompts(prompts);
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
    if (selectedPromptIds.length === 0 && availablePrompts.length === 0) {
      setError("Select at least one prompt in the list (Settings → Prompt Management)");
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
      const promptsToUse = (selectedPromptIds.length > 0 ? availablePrompts.filter(p => selectedPromptIds.includes(p.id)) : availablePrompts)
        .map(p => p.content)
        .filter(Boolean);
      if (promptsToUse.length === 0) {
        setError("No prompts available. Please add prompts in Settings");
        setGenerating(false);
        return;
      }
      const generatedPosts = await generatePostsFromProject(selectedProject, minImages, maxImages, promptsToUse, numPosts, userIdeas, moods, generatorHashtags.trim());
      setSuccess(`Successfully generated ${generatedPosts.length} posts!`);
    } catch (error) {
      console.error("Failed to generate posts:", error);
      setError("Failed to generate posts");
    } finally {
      setGenerating(false);
    }
  };

  const generatePostsFromProject = async (
    project: Project, 
    minImages: number, 
    maxImages: number,
    promptsToUse: string[],
    desiredCount: number,
    userIdeas: string[],
    moods: string[],
    hashtags: string
  ): Promise<DraftPost[]> => {
    const { images, description, tone } = project;

    console.log('description', description);

    const posts: DraftPost[] = [];

    const totalImages = images.length;
    const maxImagesPerPost = Math.min(maxImages, 6);
    const minImagesPerPost = Math.min(minImages, maxImagesPerPost);
    
    if (totalImages < minImagesPerPost) {
      throw new Error(`Project has only ${totalImages} images, but minimum is ${minImagesPerPost}`);
    }

    // Build pool of unique mood/idea pairs using user ideas, not project ideas
    let pairs = uniquePairs(moods || [], userIdeas);

    let imageIndex = 0;
    let promptIdx = 0;
    while (imageIndex < totalImages && posts.length < desiredCount) {
      if (pairs.length === 0) break;

      const remainingImages = totalImages - imageIndex;
      let imagesForThisPost: number;
      if (remainingImages <= maxImagesPerPost) imagesForThisPost = remainingImages; else if (remainingImages >= minImagesPerPost * 2) imagesForThisPost = maxImagesPerPost; else imagesForThisPost = Math.ceil(remainingImages / 2);
      imagesForThisPost = Math.min(imagesForThisPost, 6);

      const postImages = images.slice(imageIndex, imageIndex + imagesForThisPost);

      const idx = Math.floor(Math.random() * pairs.length);
      const [chosenMood, chosenIdea] = pairs.splice(idx, 1)[0];

      // Choose prompt: rotate through selected prompts
      const promptSource = promptsToUse[promptIdx % promptsToUse.length];
      promptIdx++;

      const resultMood = `moods - ${chosenMood}, post ideas - ${chosenIdea}`.trim();

      const filledPrompt = promptSource
        .replace(/[\u00A0\u2007\u202F\u2009\u200A\u200B\uFEFF]/g, ' ')
          .replace(/\{\s*Tone\s*\}/g, tone ?? '')
          .replace(/\{\s*Project\s*Description\s*\}/g, description ?? '')
          .replace(/\{\s*Mood\s*\}/g, resultMood ?? '');

      console.log(filledPrompt.includes("{ Mood }"))
      console.log('result prompt', filledPrompt)
      console.log('result mood', resultMood)

      if (filledPrompt.includes("{ Mood }")) {
        throw Error("Mood is not replaced")
      }

      const aiCaptions = await generateCaptionWithOpenAI(filledPrompt);
      const cleanedCaptions = (aiCaptions || [filledPrompt]).map(c => {
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
        images: postImages,
        position: posts.length,
        projectId: project.id,
      };

      await addDraftPost(post);
      posts.push(post);
      imageIndex += imagesForThisPost;
    }

    return posts;
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const canGenerate = selectedProject && selectedProject.images.length > 0 && minImages <= maxImages && numPosts >= 1;

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

        <FormControl fullWidth>
          <InputLabel id="prompts-select-label">Prompts</InputLabel>
          <Select
            labelId="prompts-select-label"
            multiple
            value={selectedPromptIds}
            label="Prompts"
            onChange={(e) => setSelectedPromptIds(Array.isArray(e.target.value) ? e.target.value as string[] : [])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((id) => {
                  const p = availablePrompts.find(x => x.id === id);
                  return <Chip key={id} label={p?.name || id} />
                })}
              </Box>
            )}
          >
            {availablePrompts.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
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
              const secondary = `${t.numPosts} posts • ${t.minImages}-${t.maxImages} images/post`;
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
            if (!templateName.trim() || !selectedProjectId || minImages > maxImages || userIdeas.length === 0 || (selectedPromptIds.length === 0 && availablePrompts.length === 0)) {
              return;
            }
            const moods = generatorMoods.split(/\n|,/).map(s => s.trim()).filter(Boolean);
            const tpl: GeneratorTemplate = {
              id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
              name: templateName.trim(),
              projectId: selectedProjectId,
              minImages,
              maxImages,
              promptIds: selectedPromptIds.length > 0 ? selectedPromptIds : availablePrompts.map(p => p.id),
              postIdeas: userIdeas,
              moods,
              hashtags: generatorHashtags.trim() || undefined,
              numPosts,
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
