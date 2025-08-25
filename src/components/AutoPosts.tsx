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
  Chip
} from "@mui/material";
import { listProjects, type Project } from "../lib/db";
import { addDraftPost, type DraftPost } from "../lib/db";
import { listPrompts, type PromptTemplate } from "../lib/db";

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

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projectsList = await listProjects();
        setProjects(projectsList);
        if (projectsList.length > 0) setSelectedProjectId(projectsList[0].id);
        const prompts = await listPrompts();
        setAvailablePrompts(prompts);
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
      const generatedPosts = await generatePostsFromProject(selectedProject, minImages, maxImages, promptsToUse);
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
    promptsToUse: string[]
  ): Promise<DraftPost[]> => {
    const { images, description, hashtags, moods, postIdeas, tone } = project;
    const posts: DraftPost[] = [];

    const totalImages = images.length;
    const maxImagesPerPost = Math.min(maxImages, 6);
    const minImagesPerPost = Math.min(minImages, maxImagesPerPost);
    
    if (totalImages < minImagesPerPost) {
      throw new Error(`Project has only ${totalImages} images, but minimum is ${minImagesPerPost}`);
    }

    // Build pool of unique mood/idea pairs
    let pairs = uniquePairs(moods || [], postIdeas || []);

    let imageIndex = 0;
    let promptIdx = 0;
    while (imageIndex < totalImages) {
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

      const filledPrompt = promptSource
        .replace("{ Tone }", tone || "")
        .replace("{ Hashtags }", hashtags || "")
        .replace("{ Mood }", `${chosenMood} ${chosenIdea}`.trim())
        .replace("{ Project Description }", description || "");

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
  const canGenerate = selectedProject && selectedProject.images.length > 0 && minImages <= maxImages;

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
    </Box>
  );
}
