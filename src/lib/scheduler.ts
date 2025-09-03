import { getScheduleConfigByType, listDraftPosts, updateDraftPost, type DraftPost } from './db';
import {uploadInstagramPostImages} from "./postUpload.ts";

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
      console.log('🕐 Scheduler: Already running');
      return;
    }

    console.log('🚀 Scheduler: Starting background scheduler...');
    this.isRunning = true;

    // Run immediately on start
    this.checkAndPublishPosts();

    // Then run every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkAndPublishPosts();
    }, 3600000);

    console.log('✅ Scheduler: Background scheduler started (runs every hour)');
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
    console.log('⏹️ Scheduler: Background scheduler stopped');
  }

  /**
   * Check if it's time to publish posts and publish them
   */
  private async checkAndPublishPosts() {
    try {
      console.log('🔍 Scheduler: Checking for posts to publish...');
      
      // Check Instagram schedule
      await this.checkInstagramSchedule();
      
      // Check Pinterest schedule (if needed in the future)
      // await this.checkPinterestSchedule();
      
    } catch (error) {
      console.error('❌ Scheduler: Error during scheduled check:', error);
    }
  }

  /**
   * Check Instagram schedule and publish posts if needed
   */
  private async checkInstagramSchedule() {
    try {
      const schedule = await getScheduleConfigByType('instagram');
      
      if (!schedule || !schedule.isActive) {
        console.log('📝 Scheduler: No active Instagram schedule found');
        return;
      }

      console.log('📸 Scheduler: Found active Instagram schedule');
      console.log(`   ⏰ Hours between posts: ${schedule.hoursBetweenPosts}`);

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

      console.log(`   🕐 Last published post: ${lastPublishedTime ? new Date(lastPublishedTime).toISOString() : 'Never'}`);

      // Check if enough time has passed since last publication
      const now = Date.now();
      const timeSinceLastPost = lastPublishedTime ? now - lastPublishedTime : Infinity;
      const requiredInterval = schedule.hoursBetweenPosts * 60 * 60 * 1000; // Convert hours to milliseconds

      if (timeSinceLastPost < requiredInterval) {
        const hoursRemaining = Math.ceil((requiredInterval - timeSinceLastPost) / (60 * 60 * 1000));
        console.log(`⏳ Scheduler: Not enough time passed. ${hoursRemaining} hours remaining until next post`);
        return;
      }

      console.log('✅ Scheduler: Time to publish a new Instagram post!');

      // Find the next post to publish
      const nextPost = await this.findNextPostToPublish();
      
      if (!nextPost) {
        console.log('📭 Scheduler: No unpublished posts found');
        return;
      }

      console.log(`📸 Scheduler: Publishing post: ${nextPost.id}`);

      // Publish the post
      await this.publishPost(nextPost);

      console.log('🎉 Scheduler: Post published successfully!');

    } catch (error) {
      console.error('❌ Scheduler: Error checking Instagram schedule:', error);
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
      console.log(`📋 Scheduler: Selected post for publishing:`);
      console.log(`   🆔 Post ID: ${nextPost.id}`);
      console.log(`   📍 Position: ${nextPost.position}`);
      console.log(`   📝 Caption: ${nextPost.caption.substring(0, 50)}...`);
      console.log(`   🖼️ Images: ${nextPost.images.length}`);

      return nextPost;

    } catch (error) {
      console.error('❌ Scheduler: Error finding next post:', error);
      return null;
    }
  }

  /**
   * Publish a post to Instagram
   */
  private async publishPost(post: DraftPost) {
    try {
      console.log(`🚀 Scheduler: Starting to publish post ${post.id}...`);

      const result = await uploadInstagramPostImages(post, {
        folder: 'instagram-posts',
        tags: ['social-media', 'automated']
      });

      console.log(`✅ Scheduler: Instagram post published successfully!`);

      // Update post status to published
      const updatedPost: DraftPost = {
        ...post,
        status: 'published',
        instagramPostId: result.instagramPostId,
        instagramContainerId: result.instagramContainerId
      };

      await updateDraftPost(updatedPost);

      console.log(`📝 Scheduler: Post status updated to published`);

    } catch (error) {
      console.error(`❌ Scheduler: Error publishing post ${post.id}:`, error);
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
    console.log('🔧 Scheduler: Manual trigger requested');
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
