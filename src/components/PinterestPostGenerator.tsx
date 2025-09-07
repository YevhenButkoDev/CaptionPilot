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
  Stack
} from "@mui/material";
import { listProjects, type Project } from "../lib/db";
import { addPinterestPost, type PinterestPost } from "../lib/db";
import logger, { LogContext } from "../lib/logger";

export default function PinterestPostGenerator() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [numPosts, setNumPosts] = React.useState<number>(1);
  const [pinDescription, setPinDescription] = React.useState<string>("");
  const [projectWebsiteUrl, setProjectWebsiteUrl] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projectsList = await listProjects();
        setProjects(projectsList);
        if (projectsList.length > 0) {
          setSelectedProjectId(projectsList[0].id);
          // Set default website URL from the first project
          setProjectWebsiteUrl(projectsList[0].website || "");
        }
      } catch (e) {
        setError("Failed to load projects");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Update website URL when project changes
  React.useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project?.website) {
        setProjectWebsiteUrl(project.website);
      }
    }
  }, [selectedProjectId, projects]);

  const handleGeneratePosts = async () => {
    if (!selectedProjectId) {
      setError("Please select a project");
      return;
    }
    if (!Number.isFinite(numPosts) || numPosts < 1) {
      setError("Enter a valid number of posts (at least 1)");
      return;
    }
    if (!pinDescription.trim()) {
      setError("Enter a pin description");
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
      const generatedPosts = await generatePinterestPosts(
        selectedProject, 
        numPosts, 
        pinDescription.trim(),
        projectWebsiteUrl.trim()
      );
      setSuccess(`Successfully generated ${generatedPosts.length} Pinterest posts!`);
    } catch (error) {
      logger.error(LogContext.POST_GENERATION, "Failed to generate Pinterest posts", error);
      setError("Failed to generate Pinterest posts");
    } finally {
      setGenerating(false);
    }
  };

  const generatePinterestPosts = async (
    project: Project, 
    desiredCount: number,
    description: string,
    websiteUrl: string
  ): Promise<PinterestPost[]> => {
    const { images } = project;

    const posts: PinterestPost[] = [];
    const totalImages = images.length;
    
    if (totalImages === 0) {
      throw new Error("Project has no images");
    }

    // Create posts with one image each for Pinterest
    const imagesToUse = Math.min(desiredCount, totalImages);
    
    for (let i = 0; i < imagesToUse; i++) {
      const image = images[i];
      
      const post: PinterestPost = {
        id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
        createdAt: Date.now(),
        description,
        images: [image],
        position: i,
        projectId: project.id,
        websiteUrl: websiteUrl || undefined,
        status: 'new',
        postFormat: '1:1'
      };

      await addPinterestPost(post);
      posts.push(post);
    }

    return posts;
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const canGenerate = selectedProject && selectedProject.images.length > 0 && numPosts >= 1 && pinDescription.trim();

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
        Pinterest Post Generator
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

        <TextField
          fullWidth
          label="Number of Posts"
          type="number"
          value={numPosts}
          onChange={(e) => setNumPosts(Number(e.target.value))}
          inputProps={{ min: 1, max: selectedProject?.images.length || 10 }}
          sx={{ mb: 3 }}
          helperText={`Maximum ${selectedProject?.images.length || 0} posts available from this project`}
        />

        <TextField
          fullWidth
          label="Pin Description"
          value={pinDescription}
          onChange={(e) => setPinDescription(e.target.value)}
          multiline
          minRows={4}
          placeholder="Enter your Pinterest pin description here..."
          helperText="This description will be used for all generated pins"
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Project Website URL (Optional)"
          value={projectWebsiteUrl}
          onChange={(e) => setProjectWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
          helperText="Leave empty to use project's default website, or override with a custom URL"
          sx={{ mb: 3 }}
        />

        {selectedProject && (
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #2a2a2a' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Project Info
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Name:</strong> {selectedProject.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Images:</strong> {selectedProject.images.length} available
            </Typography>
            {selectedProject.website && (
              <Typography variant="body2" color="text.secondary">
                <strong>Default Website:</strong> {selectedProject.website}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleGeneratePosts}
          disabled={!canGenerate || generating}
          startIcon={generating ? <CircularProgress size={20} /> : undefined}
        >
          {generating ? "Generating Pinterest Posts..." : "Generate Pinterest Posts"}
        </Button>
      </Stack>
    </Box>
  );
}
