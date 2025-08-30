import * as React from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Grid,
  CircularProgress,
  Alert
} from "@mui/material";
import InstagramIcon from '@mui/icons-material/Instagram';
import PinterestIcon from '@mui/icons-material/Pinterest';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessIcon from '@mui/icons-material/Business';
import PublishIcon from '@mui/icons-material/Publish';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { 
  listDraftPosts, 
  listPinterestPosts, 
  listProjects,
  listSchedules 
} from "../lib/db";
import { listProjectAssets } from "../lib/fs";

interface DashboardMetrics {
  instagramPosts: number;
  pinterestPosts: number;
  projectAssets: number;
  projects: number;
  publishedPosts: number;
  scheduledPosts: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [
        instagramPosts,
        pinterestPosts,
        projects,
        schedules
      ] = await Promise.all([
        listDraftPosts(),
        listPinterestPosts(),
        listProjects(),
        listSchedules()
      ]);

      // Count published posts (status === 'published')
      const publishedPosts = instagramPosts.filter(post => post.status === 'published').length;

      // Count scheduled posts (status === 'scheduled')
      const scheduledPosts = schedules.length;

      // Count project assets
      const projectAssets = await listProjectAssets();

      setMetrics({
        instagramPosts: instagramPosts.length,
        pinterestPosts: pinterestPosts.length,
        projectAssets: projectAssets.length,
        projects: projects.length,
        publishedPosts,
        scheduledPosts
      });
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <Box sx={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="h6" color="text.secondary">
          Please try refreshing the page or check your connection.
        </Typography>
      </Box>
    );
  }

  if (!metrics) {
    return null;
  }

  const metricCards = [
    {
      title: "Instagram Posts",
      value: metrics.instagramPosts,
      icon: <InstagramIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    },
    {
      title: "Pinterest Posts", 
      value: metrics.pinterestPosts,
      icon: <PinterestIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    },
    {
      title: "Project Assets",
      value: metrics.projectAssets,
      icon: <FolderIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    },
    {
      title: "Projects",
      value: metrics.projects,
      icon: <BusinessIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    },
    {
      title: "Published Posts",
      value: metrics.publishedPosts,
      icon: <PublishIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    },
    {
      title: "Scheduled Posts",
      value: metrics.scheduledPosts,
      icon: <ScheduleIcon sx={{ fontSize: 40, color: "#c44949" }} />,
      color: "#c44949"
    }
  ];

  return (
    <Box sx={{ 
      p: 3, 
      maxWidth: 1200, 
      mt: 10
    }}>

      
      <Grid container spacing={3}>
        {metricCards.map((card, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                textAlign: "center",
                borderRadius: 2,
                borderTop: `4px solid ${card.color}`,
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 6
                }
              }}
            >
              <Box sx={{ mb: 2 }}>
                {card.icon}
              </Box>
              
              <Typography variant="h3" component="div" sx={{ 
                fontWeight: "bold", 
                color: card.color,
                mb: 1
              }}>
                {card.value.toLocaleString()}
              </Typography>
              
              <Typography variant="h6" color="text.secondary">
                {card.title}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
