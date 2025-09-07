/**
 * Production logging utility for Instagram post auto generation
 * Uses tauri-plugin-log methods directly for file-based logging
 */

import { warn, debug, info, error } from '@tauri-apps/plugin-log';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export enum LogContext {
  SCHEDULER = 'scheduler',
  POST_GENERATION = 'post_generation',
  INSTAGRAM_API = 'instagram_api',
  POST_UPLOAD = 'post_upload',
  IMAGE_PROCESSING = 'image_processing',
  CLOUDINARY = 'cloudinary',
  DATABASE = 'database'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: any;
  err?: any;
  duration?: number;
  postId?: string;
  projectId?: string;
  userId?: string;
}

class ProductionLogger {
  private minLevel: LogLevel = LogLevel.DEBUG;

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLogEntry(entry: Omit<LogEntry, 'timestamp'>): LogEntry {
    return {
      ...entry,
      timestamp: new Date().toISOString()
    };
  }

  private formatLogMessage(entry: LogEntry): string {
    const emoji = this.getLevelEmoji(entry.level);
    const contextStr = `[${entry.context.toUpperCase()}]`;
    const postStr = entry.postId ? `[POST:${entry.postId}]` : '';
    const projectStr = entry.projectId ? `[PROJECT:${entry.projectId}]` : '';
    const durationStr = entry.duration ? `(${entry.duration}ms)` : '';
    
    let message = `${emoji} ${contextStr}${postStr}${projectStr} ${entry.message} ${durationStr}`;
    
    if (entry.data) {
      message += `\n   📊 Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.err) {
      message += `\n   ❌ Error: ${entry.err instanceof Error ? entry.err.stack : JSON.stringify(entry.err)}`;
    }
    
    return message;
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  private async log(level: LogLevel, context: LogContext, message: string, data?: any, err?: any, duration?: number, postId?: string, projectId?: string, userId?: string) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatLogEntry({
      level,
      context,
      message,
      data,
      err,
      duration,
      postId,
      projectId,
      userId
    });

    const logMessage = this.formatLogMessage(entry);

    try {
      switch (level) {
        case LogLevel.DEBUG:
          await debug(logMessage);
          break;
        case LogLevel.INFO:
          await info(logMessage);
          break;
        case LogLevel.WARN:
          await warn(logMessage);
          break;
        case LogLevel.ERROR:
          await error(logMessage);
          break;
        default:
          await info(logMessage);
      }
    } catch (logError) {
      // Fallback to console if Tauri logging fails
      console.error('Failed to log via Tauri:', logError);
      console.log(logMessage);
    }
  }

  // Public logging methods
  async debug(context: LogContext, message: string, data?: any, postId?: string, projectId?: string) {
    await this.log(LogLevel.DEBUG, context, message, data, undefined, undefined, postId, projectId);
  }

  async info(context: LogContext, message: string, data?: any, postId?: string, projectId?: string) {
    await this.log(LogLevel.INFO, context, message, data, undefined, undefined, postId, projectId);
  }

  async warn(context: LogContext, message: string, data?: any, error?: any, postId?: string, projectId?: string) {
    await this.log(LogLevel.WARN, context, message, data, error, undefined, postId, projectId);
  }

  async error(context: LogContext, message: string, error?: any, data?: any, postId?: string, projectId?: string) {
    await this.log(LogLevel.ERROR, context, message, data, error, undefined, postId, projectId);
  }

  // Performance logging
  startTimer(context: LogContext, operation: string, postId?: string, projectId?: string): () => void {
    const startTime = Date.now();
    this.debug(context, `Starting ${operation}`, undefined, postId, projectId);
    
    return () => {
      const duration = Date.now() - startTime;
      this.info(context, `Completed ${operation}`, { operation, duration }, postId, projectId);
    };
  }

  // Scheduler-specific logging
  async logSchedulerCheck(scheduleType: string, isActive: boolean, hoursBetweenPosts?: number) {
    await this.info(LogContext.SCHEDULER, 'Scheduler check started', {
      scheduleType,
      isActive,
      hoursBetweenPosts
    });
  }

  async logSchedulerPostFound(postId: string, position: number, captionPreview: string, imageCount: number) {
    await this.info(LogContext.SCHEDULER, 'Post selected for publishing', {
      position,
      captionPreview,
      imageCount
    }, postId);
  }

  async logSchedulerNoPostsAvailable() {
    await this.info(LogContext.SCHEDULER, 'No posts available for publishing');
  }

  async logSchedulerTimeNotReady(hoursRemaining: number) {
    await this.info(LogContext.SCHEDULER, 'Not enough time passed since last post', {
      hoursRemaining
    });
  }
}

// Create singleton instance
const logger = new ProductionLogger();

// Test function to verify logging works
export async function testLogger() {
  try {
    await logger.info(LogContext.SCHEDULER, 'Logger test started', { test: true });
    await logger.debug(LogContext.POST_GENERATION, 'Debug test message', { level: 'debug' });
    await logger.warn(LogContext.INSTAGRAM_API, 'Warning test message', { level: 'warn' });
    await logger.error(LogContext.POST_UPLOAD, 'Error test message', new Error('Test error'), { level: 'error' });
    await logger.info(LogContext.SCHEDULER, 'Logger test completed', { test: true });
    console.log('✅ Logger test completed - check AppData logs');
  } catch (error) {
    console.error('❌ Logger test failed:', error);
  }
}

export default logger;
