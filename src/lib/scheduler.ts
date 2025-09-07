import { getScheduleConfigByType, listDraftPosts, updateDraftPost, type DraftPost } from './db';
import {uploadInstagramPostImages} from "./postUpload.ts";
import logger, { LogContext } from './logger';

/**
 * Background scheduler service that runs every hour to check and publish scheduled posts
 */
class PostScheduler {
  private intervalId: number | null = null;
  private isRunning = false;

  /**
   * Start the scheduler - runs every hour
   */
  start() {
    if (this.isRunning) {
      logger.warn(LogContext.SCHEDULER, 'Scheduler already running');
      return;
    }

    logger.info(LogContext.SCHEDULER, 'Starting background scheduler', { interval: '1 hour' });
    this.isRunning = true;

    // Run immediately on start
    this.checkAndPublishPosts();

    // Then run every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkAndPublishPosts();
    }, 3600000);

    logger.info(LogContext.SCHEDULER, 'Background scheduler started successfully', { 
      interval: '1 hour',
      isRunning: true 
    });
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info(LogContext.SCHEDULER, 'Background scheduler stopped', { isRunning: false });
  }

  /**
   * Check if it's time to publish posts and publish them
   */
  private async checkAndPublishPosts() {
    const timer = logger.startTimer(LogContext.SCHEDULER, 'scheduled check');
    
    try {
      logger.debug(LogContext.SCHEDULER, 'Starting scheduled check for posts to publish');
      
      // Check Instagram schedule
      await this.checkInstagramSchedule();
      
      // Check Pinterest schedule (if needed in the future)
      // await this.checkPinterestSchedule();
      
      timer();
    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error during scheduled check', error);
      timer();
    }
  }

  /**
   * Check Instagram schedule and publish posts if needed
   */
  private async checkInstagramSchedule() {
    try {
      const schedule = await getScheduleConfigByType('instagram');
      
      if (!schedule || !schedule.isActive) {
        logger.logSchedulerCheck('instagram', false);
        return;
      }

      logger.logSchedulerCheck('instagram', true, schedule.hoursBetweenPosts);

      // Get all published posts to find the most recent publication time
      const allPosts = await listDraftPosts();
      const publishedPosts = allPosts.filter(post => 
        post.platform === 'instagram' && 
        post.status === 'published'
      );

      // Find the most recent published post timestamp
      const lastPublishedTime = publishedPosts.length > 0 
        ? Math.max(...publishedPosts.map(post => post.createdAt))
        : 0;

      logger.debug(LogContext.SCHEDULER, 'Last published post analysis', {
        lastPublishedTime: lastPublishedTime ? new Date(lastPublishedTime).toISOString() : 'Never',
        publishedPostsCount: publishedPosts.length
      });

      // Check if enough time has passed since last publication
      const now = Date.now();
      const timeSinceLastPost = lastPublishedTime ? now - lastPublishedTime : Infinity;
      const requiredInterval = schedule.hoursBetweenPosts * 60 * 60 * 1000; // Convert hours to milliseconds

      if (timeSinceLastPost < requiredInterval) {
        const hoursRemaining = Math.ceil((requiredInterval - timeSinceLastPost) / (60 * 60 * 1000));
        logger.logSchedulerTimeNotReady(hoursRemaining);

        return;
      }

      logger.info(LogContext.SCHEDULER, 'Time to publish a new Instagram post', {
        timeSinceLastPost: Math.round(timeSinceLastPost / (60 * 60 * 1000)),
        requiredInterval: schedule.hoursBetweenPosts
      });

      // Find the next post to publish
      const nextPost = await this.findNextPostToPublish();
      
      if (!nextPost) {
        logger.logSchedulerNoPostsAvailable();
        return;
      }

      logger.logSchedulerPostFound(
        nextPost.id, 
        nextPost.position || -1, 
        nextPost.caption.substring(0, 50), 
        nextPost.images.length
      );

      // Publish the post
      await this.publishPost(nextPost);

      logger.info(LogContext.SCHEDULER, 'Post published successfully', { postId: nextPost.id });

    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error checking Instagram schedule', error);
    }
  }

  /**
   * Find the next post to publish (highest position, unpublished)
   */
  private async findNextPostToPublish(): Promise<DraftPost | null> {
    try {
      const allPosts = await listDraftPosts();
      
      // Filter for Instagram posts that are not published
      const unpublishedPosts = allPosts.filter(post => 
        post.platform === 'instagram' && 
        post.status !== 'published'
      );

      if (unpublishedPosts.length === 0) {
        return null;
      }

      // Sort by position (highest position number first)
      // Posts with no position should come last (treated as position -1)
      const sortedPosts = unpublishedPosts.sort((a, b) => {
        const aPos = typeof a.position === 'number' ? a.position : -1;
        const bPos = typeof b.position === 'number' ? b.position : -1;
        return bPos - aPos; // Higher position number = higher priority
      });

      const nextPost = sortedPosts[0];
      logger.debug(LogContext.SCHEDULER, 'Post selected for publishing', {
        postId: nextPost.id,
        position: nextPost.position,
        captionPreview: nextPost.caption.substring(0, 50),
        imageCount: nextPost.images.length
      });

      return nextPost;

    } catch (error) {
      logger.error(LogContext.SCHEDULER, 'Error finding next post', error);
      return null;
    }
  }

  /**
   * Publish a post to Instagram
   */
  private async publishPost(post: DraftPost) {
    const timer = logger.startTimer(LogContext.SCHEDULER, 'publish post', post.id);
    
    try {
      logger.info(LogContext.SCHEDULER, 'Starting post publication', {
        postId: post.id,
        imageCount: post.images.length,
        captionLength: post.caption.length
      }, post.id);

      const result = await uploadInstagramPostImages(post, {
        folder: 'instagram-posts',
        tags: ['social-media', 'automated']
      });

      logger.info(LogContext.SCHEDULER, 'Instagram post published successfully', {
        postId: post.id,
        instagramPostId: result.instagramPostId,
        instagramContainerId: result.instagramContainerId
      }, post.id);

      // Update post status to published
      const updatedPost: DraftPost = {
        ...post,
        status: 'published',
        instagramPostId: result.instagramPostId,
        instagramContainerId: result.instagramContainerId
      };

      await updateDraftPost(updatedPost);

      logger.info(LogContext.SCHEDULER, 'Post status updated to published', {
        postId: post.id,
        status: 'published'
      }, post.id);

      timer();

    } catch (error) {
      logger.error(LogContext.SCHEDULER, `Error publishing post ${post.id}`, error, {
        postId: post.id,
        imageCount: post.images.length
      }, post.id);
      timer();
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.intervalId
    };
  }

  /**
   * Manually trigger a check (useful for testing)
   */
  async triggerCheck() {
    logger.info(LogContext.SCHEDULER, 'Manual trigger requested');
    await this.checkAndPublishPosts();
  }
}

// Create a singleton instance
const postScheduler = new PostScheduler();

export default postScheduler;

// Export the instance for testing purposes
export { postScheduler };

// Auto-start the scheduler when the module is imported
// This ensures the scheduler starts when the app loads
if (typeof window !== 'undefined') {
  // Only start in browser environment
  postScheduler.start();
}
