import * as React from "react";
import { 
  Box, 
  IconButton, 
  Fade,
  Tooltip,
  Typography
} from "@mui/material";
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { 
  addScheduleConfig, 
  getScheduleConfigByType, 
  updateScheduleConfig, 
  type Schedule 
} from "../lib/db";

interface ScheduleButtonProps {
  type: 'instagram' | 'pinterest';
}

export default function ScheduleButton({ type }: ScheduleButtonProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [postsPerWeek, setPostsPerWeek] = React.useState(7);
  const [schedule, setSchedule] = React.useState<Schedule | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    loadSchedule();
  }, [type]);

  const loadSchedule = async () => {
    try {
      const existingSchedule = await getScheduleConfigByType(type);
      if (existingSchedule) {
        setSchedule(existingSchedule);
        setPostsPerWeek(existingSchedule.amountOfPostsPerWeek);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const handlePlay = async () => {
    setLoading(true);
    try {
      if (schedule) {
        const updatedSchedule: Schedule = { ...schedule, status: "in_process", updatedAt: Date.now() };
        await updateScheduleConfig(updatedSchedule);
        setSchedule(updatedSchedule);
      } else {
        const newSchedule: Schedule = {
          id: crypto.randomUUID(),
          type,
          status: 'in_process',
          amountOfPostsPerWeek: postsPerWeek,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await addScheduleConfig(newSchedule);
        setSchedule(newSchedule);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const updatedSchedule: Schedule = { ...schedule, status: 'paused', updatedAt: Date.now() };
      await updateScheduleConfig(updatedSchedule);
      setSchedule(updatedSchedule);
    } catch (error) {
      console.error('Error pausing schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const updatedSchedule = { ...schedule, amountOfPostsPerWeek: postsPerWeek, updatedAt: Date.now() };
      await updateScheduleConfig(updatedSchedule);
      setSchedule(updatedSchedule);
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = () => {
    if (postsPerWeek < 100) {
      const newValue = postsPerWeek + 1;
      setPostsPerWeek(newValue);
      if (schedule) {
        handleSave();
      }
    }
  };

  const handleDecrement = () => {
    if (postsPerWeek > 1) {
      const newValue = postsPerWeek - 1;
      setPostsPerWeek(newValue);
      if (schedule) {
        handleSave();
      }
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const isActive = schedule?.status === 'in_process';

  return (
    <Box sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }}>
      {!isExpanded ? (
        <Tooltip title="Schedule Posts">
          <IconButton
            onClick={() => setIsExpanded(true)}
            sx={{
              bgcolor: isActive ? '#b1d479' : 'rgba(255, 255, 255, 0.08)',
              color: isActive ? '#000' : '#fff',
              '&:hover': {
                bgcolor: isActive ? '#9bc068' : 'rgba(255, 255, 255, 0.12)',
              },
              width: 56,
              height: 56,
              boxShadow: 3,
            }}
          >
            <ScheduleIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Fade in={isExpanded}>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              p: 2,
              bgcolor: 'background.paper',
              border: '1px solid #2a2a2a',
              borderRadius: 2,
              boxShadow: 3
            }}
          >
            <IconButton
              onClick={handlePlay}
              disabled={loading || isActive}
              sx={{
                bgcolor: isActive ? '#b1d479' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#000' : '#fff',
                '&:hover': {
                  bgcolor: isActive ? '#9bc068' : 'rgba(255, 255, 255, 0.12)',
                },
                width: 40,
                height: 40
              }}
            >
              <PlayArrowIcon />
            </IconButton>
            
            <IconButton
              onClick={handlePause}
              disabled={loading || !isActive}
              sx={{
                bgcolor: !isActive ? '#b1d479' : 'rgba(255, 255, 255, 0.08)',
                color: !isActive ? '#000' : '#fff',
                '&:hover': {
                  bgcolor: !isActive ? '#9bc068' : 'rgba(255, 255, 255, 0.12)',
                },
                width: 40,
                height: 40
              }}
            >
              <PauseIcon />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                onClick={handleDecrement}
                disabled={postsPerWeek <= 1}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.12)',
                  },
                  width: 16,
                  height: 16,
                  minWidth: 16
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
              
              <Typography 
                variant="h6" 
                sx={{ 
                  minWidth: 40, 
                  textAlign: 'center',
                  color: 'text.primary',
                  fontWeight: 'bold'
                }}
              >
                {postsPerWeek}
              </Typography>
              
              <IconButton
                onClick={handleIncrement}
                disabled={postsPerWeek >= 100}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.12)',
                  },
                  width: 16,
                  height: 16,
                  minWidth: 16
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
            
            <IconButton
              onClick={handleClose}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.12)',
                },
                width: 40,
                height: 40
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Fade>
      )}
    </Box>
  );
}
