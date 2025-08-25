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
  Paper
} from "@mui/material";
import { listProjects, type Project } from "../lib/db";
import { addDraftPost, type DraftPost } from "../lib/db";

const DEFAULT_PROMPT = `You are a brand copywriter for Instagram.
Your task is to write a unique caption for a new post.

Style Guidelines
\t•\tTone: { Tone }.
\t•\tStructure:
\t•\tCaption must be split into short paragraphs (1–3 sentences each).
\t•\tBegin with a catchy opening line that introduces the project or idea.
\t•\tMiddle section: describe the mood, story, or personality.
\t•\tClosing: inviting, emotional, or playful line.
\t•\tUse emojis naturally (not overstuffed).
\t•\tLength: ~100–150 words.
\t•\tAlways phrase differently from previous outputs; avoid repetition.

Formatting
\t•\tAfter the caption ends, add a line with exactly three dots ... on a new line.
\t•\tAfter that line, add the following hashtags in one block:
{ Hashtags }

Input
\t•\tProject description: { Project Description }
\t•\tMood / post ideas: { Mood }
\t•\tVariation: Write [number, e.g. 3] different caption options, each unique in mood, word choice, and phrasing.

Output
\t•\tReturn the captions as a numbered list.
\t•\tEach caption should:
\t•\tBe split into paragraphs.
\t•\tEnd with a line containing ....
\t•\tFollowed by the full hashtag block.`;

async function generateCaptionWithOpenAI(prompt: string): Promise<string | null> {
  try {
    const savedSettings = localStorage.getItem("app-settings");
    if (!savedSettings) return null;
    const { openaiSecretKey } = JSON.parse(savedSettings || '{}');
    if (!openaiSecretKey) return null;

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
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

function randomPick<T>(arr: T[] | undefined): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
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
  const [prompt, setPrompt] = React.useState<string>(DEFAULT_PROMPT);

  React.useEffect(() => {
    loadProjects();
  }, []);

  React.useEffect(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    updatePrompt(proj);
  }, [selectedProjectId, projects]);

  const updatePrompt = (project?: Project) => {
    const tone = project?.tone || "warm, playful, cozy, and slightly witty";
    const hashtags = project?.hashtags || "#instagram #auto #post";
    const mood = project?.mood || "";
    const desc = project?.description || "";
    const replaced = DEFAULT_PROMPT
      .replace("{ Tone }", tone)
      .replace("{ Hashtags }", hashtags)
      .replace("{ Mood }", mood)
      .replace("{ Project Description }", desc);
    setPrompt(replaced);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectsList = await listProjects();
      setProjects(projectsList);
      if (projectsList.length > 0) {
        setSelectedProjectId(projectsList[0].id);
        updatePrompt(projectsList[0]);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePosts = async () => {
    if (!selectedProjectId || minImages > maxImages) {
      setError("Please select a project and ensure min images ≤ max images");
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
      const generatedPosts = await generatePostsFromProject(selectedProject, minImages, maxImages);
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
    maxImages: number
  ): Promise<DraftPost[]> => {
    const { images, description, tone, moods, postIdeas, hashtags } = project;
    const posts: DraftPost[] = [];

    const totalImages = images.length;
    const maxImagesPerPost = Math.min(maxImages, 6);
    const minImagesPerPost = Math.min(minImages, maxImagesPerPost);
    
    if (totalImages < minImagesPerPost) {
      throw new Error(`Project has only ${totalImages} images, but minimum is ${minImagesPerPost}`);
    }

    let imageIndex = 0;
    while (imageIndex < totalImages) {
      const remainingImages = totalImages - imageIndex;
      let imagesForThisPost: number;
      
      if (remainingImages <= maxImagesPerPost) {
        imagesForThisPost = remainingImages;
      } else if (remainingImages >= minImagesPerPost * 2) {
        imagesForThisPost = maxImagesPerPost;
      } else {
        imagesForThisPost = Math.ceil(remainingImages / 2);
      }

      imagesForThisPost = Math.min(imagesForThisPost, 6);

      const postImages = images.slice(imageIndex, imageIndex + imagesForThisPost);

      // Build prompt with random mood/idea
      const chosenMood = randomPick(moods) || "";
      const chosenIdea = randomPick(postIdeas) || "";
      const promptText = DEFAULT_PROMPT
        .replace("{ Tone }", tone || "warm, playful, cozy, and slightly witty")
        .replace("{ Hashtags }", hashtags || "")
        .replace("{ Mood }", `${chosenMood} ${chosenIdea}`.trim())
        .replace("{ Project Description }", description || "")
        .replace("[number, e.g. 3]", "1");

      // Call OpenAI for the caption
      const aiCaption = await generateCaptionWithOpenAI(promptText);

      const post: DraftPost = {
        id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
        createdAt: Date.now(),
        caption: aiCaption || promptText,
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
    <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
        Auto Posts Generator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Automatically generate Instagram posts from your projects by selecting images and settings.
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
          <TextField
            label="Min images per post"
            type="number"
            value={minImages}
            onChange={(e) => setMinImages(Number(e.target.value))}
            inputProps={{ min: 1, max: 6 }}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Max images per post"
            type="number"
            value={maxImages}
            onChange={(e) => setMaxImages(Number(e.target.value))}
            inputProps={{ min: 1, max: 6 }}
            sx={{ flex: 1 }}
          />
        </Box>

        <TextField
          label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          fullWidth
          multiline
          minRows={10}
          helperText="This prompt will be used to generate captions. Placeholders are auto-filled from the selected project."
        />
      </Paper>

      {selectedProject && (
        <Box sx={{ mb: 3, p: 2, bgcolor: "background.default", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Selected Project:</strong> {selectedProject.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Total Images:</strong> {selectedProject.images.length}
          </Typography>
          {selectedProject.tone && (
            <Typography variant="body2" color="text.secondary">
              <strong>Tone:</strong> {selectedProject.tone}
            </Typography>
          )}
          {selectedProject.mood && (
            <Typography variant="body2" color="text.secondary">
              <strong>Mood:</strong> {selectedProject.mood}
            </Typography>
          )}
          {selectedProject.hashtags && (
            <Typography variant="body2" color="text.secondary">
              <strong>Hashtags:</strong> {selectedProject.hashtags}
            </Typography>
          )}
        </Box>
      )}

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

      {projects.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No projects found. Create a project first to generate auto posts.
        </Alert>
      )}
    </Box>
  );
}
