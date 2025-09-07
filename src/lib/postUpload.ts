import { uploadMultipleImagesToCloudinary, getCloudinaryConfig, applyTransformation, type CloudinaryUploadResult, type CloudinaryError } from './cloudinary';
import { updateDraftPost, updatePinterestPost, type DraftPost, type PinterestPost } from './db';
import { getImageUrlFromAppDir, tauriImports } from './fs';
import { publishInstagramPost, type InstagramConfig } from './instagram';
import logger, { LogContext } from './logger';

export interface UploadResult {
  success: boolean;
  cloudinaryImages?: CloudinaryUploadResult[];
  instagramPostId?: string;
  instagramContainerId?: string;
  error?: string;
}

// Helper function to load image file with fallback for production
async function loadImageFile(imageMeta: { fileName: string; mimeType: string; size: number }): Promise<File | null> {
  try {
    // Get the image URL from the app directory (Tauri approach)
    const imageUrl = await getImageUrlFromAppDir(imageMeta.fileName);
    if (!imageUrl) {
      logger.warn(LogContext.POST_UPLOAD, `Image not found in app directory: ${imageMeta.fileName}`);
      return null;
    }
    
    // Try to fetch the image as a blob and convert to File
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], imageMeta.fileName, {
        type: imageMeta.mimeType,
        lastModified: Date.now()
      });
      
      logger.debug(LogContext.POST_UPLOAD, 'Successfully loaded image from URL', { fileName: imageMeta.fileName });
      return file;
    } catch (fetchError) {
      // Fallback: try to read the file directly from the file system
      logger.warn(LogContext.POST_UPLOAD, 'Fetch failed, trying direct file read', { fileName: imageMeta.fileName, error: fetchError });
      
      const { fs, path } = await tauriImports();
      
      const base = await path.appDataDir();
      const absPath = await path.join(base, 'images', imageMeta.fileName);
      
      const fileBytes = await fs.readFile(absPath, { baseDir: fs.BaseDirectory.AppData });
      const blob = new Blob([fileBytes], { type: imageMeta.mimeType });
      const file = new File([blob], imageMeta.fileName, {
        type: imageMeta.mimeType,
        lastModified: Date.now()
      });
      
      logger.debug(LogContext.POST_UPLOAD, 'Successfully loaded image from direct file read', { fileName: imageMeta.fileName });
      return file;
    }
  } catch (error) {
    logger.error(LogContext.POST_UPLOAD, 'Error loading image file', error);
    return null;
  }
}

/**
 * Uploads images for an Instagram post to Cloudinary and updates the database
 * @param post - The Instagram post to update
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadInstagramPostImages(
  post: DraftPost,
  options: {
    folder?: string;
    tags?: string[];
  } = {}
): Promise<UploadResult> {
  try {
    // Get Cloudinary configuration
    const config = getCloudinaryConfig();
    if (!config) {
      return {
        success: false,
        error: 'Cloudinary configuration not found. Please configure your Cloudinary settings.'
      };
    }

    // Convert stored local images to File objects for Cloudinary upload
    const imageFiles: File[] = [];
    
    for (const imageMeta of post.images) {
      const file = await loadImageFile(imageMeta);
      if (!file) {
        logger.error(LogContext.POST_UPLOAD, `Failed to load image ${imageMeta.fileName}`);
        return {
          success: false,
          error: `Failed to load image ${imageMeta.fileName}`
        };
      }
      imageFiles.push(file);
    }
    
    if (imageFiles.length === 0) {
      return {
        success: false,
        error: 'No images found to upload'
      };
    }

    // Upload images to Cloudinary
    const uploadResults = await uploadMultipleImagesToCloudinary(imageFiles, config, {
      folder: options.folder || 'instagram-posts',
      tags: [...(options.tags || []), 'instagram', 'social-media']
    });

    // Check for upload errors
    const errors = uploadResults.filter(result => 'error' in result) as CloudinaryError[];
    if (errors.length > 0) {
      return {
        success: false,
        error: `Failed to upload ${errors.length} images: ${errors.map(e => e.error.message).join(', ')}`
      };
    }

    // Extract successful uploads
    const successfulUploads = uploadResults.filter(result => !('error' in result)) as CloudinaryUploadResult[];
    
    if (successfulUploads.length === 0) {
      return {
        success: false,
        error: 'No images were successfully uploaded'
      };
    }

    // Update the post with Cloudinary URLs but DON'T mark as published yet
    // We need Instagram publishing to succeed first
    const updatedPost: DraftPost = {
      ...post,
      cloudinaryImages: successfulUploads,
      status: 'new' // Keep as new until Instagram publishing succeeds
    };

    // Save Cloudinary URLs to database
    await updateDraftPost(updatedPost);

    // Now automatically publish to Instagram
    try {
      logger.info(LogContext.POST_UPLOAD, 'Starting Instagram publishing workflow', {
        postId: post.id,
        imageCount: post.images.length
      }, post.id);
      
      // Get Instagram configuration from settings
      const settings = localStorage.getItem('app-settings');
      if (!settings) {
        logger.warn(LogContext.POST_UPLOAD, 'No app settings found, skipping Instagram publishing');
        return {
          success: true,
          cloudinaryImages: successfulUploads
        };
      }

      const appSettings = JSON.parse(settings);
      if (!appSettings.instagramUserToken) {
        logger.warn(LogContext.POST_UPLOAD, 'Instagram user token not configured, skipping Instagram publishing');
        return {
          success: true,
          cloudinaryImages: successfulUploads
        };
      }

      logger.info(LogContext.POST_UPLOAD, 'Instagram credentials found, proceeding with publishing', {
        hasUserToken: !!appSettings.instagramUserToken
      }, post.id);
      
      const instagramConfig: InstagramConfig = {
        userToken: appSettings.instagramUserToken
      };

      // Get Cloudinary URLs for Instagram publishing
      const imageUrls = successfulUploads.map(img => img.secureUrl);
      logger.debug(LogContext.POST_UPLOAD, 'Cloudinary URLs prepared for Instagram', {
        imageCount: imageUrls.length
      }, post.id);
      
      // Publish to Instagram
      logger.debug(LogContext.POST_UPLOAD, 'Calling Instagram publishing API', undefined, post.id);
      const instagramResult = await publishInstagramPost(
        instagramConfig,
        imageUrls,
        post.caption
      );

      logger.info(LogContext.POST_UPLOAD, 'Instagram publishing successful', {
        containerId: instagramResult.containerId,
        publishedPostId: instagramResult.publishedPostId
      }, post.id);
      
      // Update the post with Instagram IDs (status remains 'new' since we use instagramPostId as indicator)
      const finalUpdatedPost: DraftPost = {
        ...updatedPost,
        instagramPostId: instagramResult.publishedPostId,
        instagramContainerId: instagramResult.containerId
      };

      // Save Instagram IDs and published status to database
      logger.debug(LogContext.POST_UPLOAD, 'Saving Instagram IDs and published status to database', undefined, post.id);
      await updateDraftPost(finalUpdatedPost);
      logger.info(LogContext.POST_UPLOAD, 'Database updated successfully', {
        instagramPostId: instagramResult.publishedPostId,
        instagramContainerId: instagramResult.containerId
      }, post.id);

      return {
        success: true,
        cloudinaryImages: successfulUploads,
        instagramPostId: instagramResult.publishedPostId,
        instagramContainerId: instagramResult.containerId
      };
    } catch (instagramError) {
      logger.error(LogContext.POST_UPLOAD, 'Instagram publishing failed', instagramError, {
        message: instagramError instanceof Error ? instagramError.message : 'Unknown error',
        stack: instagramError instanceof Error ? instagramError.stack : undefined
      }, post.id);
      
      // Return success for Cloudinary upload but include Instagram error
      // Post remains unpublished since Instagram failed
      logger.warn(LogContext.POST_UPLOAD, 'Instagram failed, but Cloudinary succeeded. Post remains unpublished', undefined, post.id);
      
      return {
        success: true,
        cloudinaryImages: successfulUploads,
        error: `Images uploaded to Cloudinary successfully, but failed to publish to Instagram: ${instagramError instanceof Error ? instagramError.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload'
    };
  }
}

/**
 * Uploads images for a Pinterest post to Cloudinary and updates the database
 * @param post - The Pinterest post to update
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadPinterestPostImages(
  post: PinterestPost,
  options: {
    folder?: string;
    tags?: string[];
  } = {}
): Promise<UploadResult> {
  try {
    // Get Cloudinary configuration
    const config = getCloudinaryConfig();
    if (!config) {
      return {
        success: false,
        error: 'Cloudinary configuration not found. Please configure your Cloudinary settings.'
      };
    }

    // Convert stored local images to File objects for Cloudinary upload
    const imageFiles: File[] = [];
    
    for (const imageMeta of post.images) {
      const file = await loadImageFile(imageMeta);
      if (!file) {
        logger.error(LogContext.POST_UPLOAD, `Failed to load image ${imageMeta.fileName}`);
        return {
          success: false,
          error: `Failed to load image ${imageMeta.fileName}`
        };
      }
      imageFiles.push(file);
    }
    
    if (imageFiles.length === 0) {
      return {
        success: false,
        error: 'No images found to upload'
      };
    }

    // Upload images to Cloudinary
    const uploadResults = await uploadMultipleImagesToCloudinary(imageFiles, config, {
      folder: options.folder || 'pinterest-posts',
      tags: [...(options.tags || []), 'pinterest', 'social-media']
    });

    // Check for upload errors
    const errors = uploadResults.filter(result => 'error' in result) as CloudinaryError[];
    if (errors.length > 0) {
      return {
        success: false,
        error: `Failed to upload ${errors.length} images: ${errors.map(e => e.error.message).join(', ')}`
      };
    }

    // Extract successful uploads
    const successfulUploads = uploadResults.filter(result => !('error' in result)) as CloudinaryUploadResult[];
    
    if (successfulUploads.length === 0) {
      return {
        success: false,
        error: 'No images were successfully uploaded'
      };
    }

    // Update the post with Cloudinary URLs and mark as published
    const updatedPost: PinterestPost = {
      ...post,
      cloudinaryImages: successfulUploads,
      status: 'published'
    };

    // Save to database
    await updatePinterestPost(updatedPost);

    return {
      success: true,
      cloudinaryImages: successfulUploads
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload'
    };
  }
}

/**
 * Uploads images for any post type to Cloudinary
 * @param post - The post to update (Instagram or Pinterest)
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadPostImages(
  post: DraftPost | PinterestPost,
  options: {
    folder?: string;
    tags?: string[];
  } = {}
): Promise<UploadResult> {
  // Determine post type and call appropriate function
  if ('caption' in post) {
    // Instagram post
    return uploadInstagramPostImages(post as DraftPost, options);
  } else {
    // Pinterest post
    return uploadPinterestPostImages(post as PinterestPost, options);
  }
}

/**
 * Checks if a post has Cloudinary images uploaded
 * @param post - The post to check
 * @returns True if the post has Cloudinary images
 */
export function hasCloudinaryImages(post: DraftPost | PinterestPost): boolean {
  if ('cloudinaryImages' in post) {
    return post.cloudinaryImages !== undefined && post.cloudinaryImages.length > 0;
  }
  return false;
}

/**
 * Gets Cloudinary URLs for a post
 * @param post - The post to get URLs from
 * @returns Array of Cloudinary URLs or empty array if none
 */
export function getCloudinaryUrls(post: DraftPost | PinterestPost): string[] {
  if ('cloudinaryImages' in post && post.cloudinaryImages) {
    return post.cloudinaryImages.map(img => img.secureUrl);
  }
  return [];
}

/**
 * Gets transformed Cloudinary URLs for a post
 * @param post - The post to get URLs from
 * @param transformation - The transformation to apply (e.g., 'f_auto,q_auto,w_1080')
 * @returns Array of transformed Cloudinary URLs or empty array if none
 */
export function getTransformedCloudinaryUrls(post: DraftPost | PinterestPost, transformation: string): string[] {
  if ('cloudinaryImages' in post && post.cloudinaryImages) {
    return post.cloudinaryImages.map(img => applyTransformation(img.secureUrl, transformation));
  }
  return [];
}
