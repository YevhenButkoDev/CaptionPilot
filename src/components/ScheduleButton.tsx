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
import logger, { LogContext } from "../lib/logger";

interface ScheduleButtonProps {
  type: 'instagram' | 'pinterest';
}

export default function ScheduleButton({ type }: ScheduleButtonProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [hoursBetweenPosts, setHoursBetweenPosts] = React.useState(24); // Default 24 hours
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
        // Use hoursBetweenPosts if available, otherwise convert from posts per week
        const hours = existingSchedule.hoursBetweenPosts || Math.round(168 / existingSchedule.amountOfPostsPerWeek);
        setHoursBetweenPosts(hours);
      }
    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error loading schedule', error);
    }
  };

  const handlePlay = async () => {
    setLoading(true);
    try {
      if (schedule) {
        const updatedSchedule: Schedule = { 
          ...schedule, 
          status: "in_process", 
          isActive: true,
          hoursBetweenPosts,
          updatedAt: Date.now() 
        };
        await updateScheduleConfig(updatedSchedule);
        setSchedule(updatedSchedule);
      } else {
        const newSchedule: Schedule = {
          id: crypto.randomUUID(),
          type,
          status: 'in_process',
          isActive: true,
          amountOfPostsPerWeek: Math.round(168 / hoursBetweenPosts), // Convert to posts per week for backward compatibility
          hoursBetweenPosts,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await addScheduleConfig(newSchedule);
        setSchedule(newSchedule);
      }
    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error updating schedule', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const updatedSchedule: Schedule = { 
        ...schedule, 
        status: 'paused', 
        isActive: false,
        updatedAt: Date.now() 
      };
      await updateScheduleConfig(updatedSchedule);
      setSchedule(updatedSchedule);
    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error pausing schedule', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const updatedSchedule = { 
        ...schedule, 
        hoursBetweenPosts,
        amountOfPostsPerWeek: Math.round(168 / hoursBetweenPosts), // Convert to posts per week for backward compatibility
        updatedAt: Date.now() 
      };
      await updateScheduleConfig(updatedSchedule);
      setSchedule(updatedSchedule);
    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error saving schedule', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = () => {
    if (hoursBetweenPosts < 168) { // Max 1 week
      const newValue = hoursBetweenPosts + 1;
      setHoursBetweenPosts(newValue);
      if (schedule) {
        handleSave();
      }
    }
  };

  const handleDecrement = () => {
    if (hoursBetweenPosts > 1) {
      const newValue = hoursBetweenPosts - 1;
      setHoursBetweenPosts(newValue);
      if (schedule) {
        handleSave();
      }
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const isActive = schedule?.isActive === true;

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
                disabled={hoursBetweenPosts <= 1}
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
                {hoursBetweenPosts}h
              </Typography>
              
              <IconButton
                onClick={handleIncrement}
                disabled={hoursBetweenPosts >= 168}
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
