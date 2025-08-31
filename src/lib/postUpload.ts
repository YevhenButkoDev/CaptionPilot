import { uploadMultipleImagesToCloudinary, getCloudinaryConfig, applyTransformation, type CloudinaryUploadResult, type CloudinaryError } from './cloudinary';
import { updateDraftPost, updatePinterestPost, type DraftPost, type PinterestPost } from './db';
import { getImageUrlFromAppDir } from './fs';
import { publishInstagramPost, type InstagramConfig } from './instagram';

export interface UploadResult {
  success: boolean;
  cloudinaryImages?: CloudinaryUploadResult[];
  instagramPostId?: string;
  instagramContainerId?: string;
  error?: string;
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
      try {
        // Read the local image file
        const imageUrl = await getImageUrlFromAppDir(imageMeta.fileName);
        
        // Convert the image URL to a File object
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Create a File object with the original metadata
        const file = new File([blob], imageMeta.fileName, {
          type: imageMeta.mimeType,
          lastModified: Date.now()
        });
        
        imageFiles.push(file);
      } catch (error) {
        console.error(`Failed to read image ${imageMeta.fileName}:`, error);
        return {
          success: false,
          error: `Failed to read local image: ${imageMeta.fileName}`
        };
      }
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
      console.log('🚀 Post Upload: Starting Instagram publishing workflow...');
      
      // Get Instagram configuration from settings
      const settings = localStorage.getItem('app-settings');
      if (!settings) {
        console.warn('⚠️  Post Upload: No app settings found, skipping Instagram publishing');
        return {
          success: true,
          cloudinaryImages: successfulUploads
        };
      }

      const appSettings = JSON.parse(settings);
      if (!appSettings.instagramUserToken) {
        console.warn('⚠️  Post Upload: Instagram user token not configured, skipping Instagram publishing');
        return {
          success: true,
          cloudinaryImages: successfulUploads
        };
      }

      console.log('✅ Post Upload: Instagram credentials found, proceeding with publishing...');
      
      const instagramConfig: InstagramConfig = {
        userToken: appSettings.instagramUserToken
      };

      // Get Cloudinary URLs for Instagram publishing
      const imageUrls = successfulUploads.map(img => img.secureUrl);
      console.log('🖼️  Post Upload: Cloudinary URLs prepared for Instagram:', imageUrls.length, 'images');
      
      // Publish to Instagram
      console.log('📤 Post Upload: Calling Instagram publishing API...');
      const instagramResult = await publishInstagramPost(
        instagramConfig,
        imageUrls,
        post.caption
      );

      console.log('🎉 Post Upload: Instagram publishing successful!');
      console.log('   🆔 Instagram Container ID:', instagramResult.containerId);
      console.log('   🆔 Instagram Post ID:', instagramResult.publishedPostId);
      
      // Update the post with Instagram IDs (status remains 'new' since we use instagramPostId as indicator)
      const finalUpdatedPost: DraftPost = {
        ...updatedPost,
        instagramPostId: instagramResult.publishedPostId,
        instagramContainerId: instagramResult.containerId
      };

      // Save Instagram IDs and published status to database
      console.log('💾 Post Upload: Saving Instagram IDs and published status to database...');
      await updateDraftPost(finalUpdatedPost);
      console.log('✅ Post Upload: Database updated successfully');

      return {
        success: true,
        cloudinaryImages: successfulUploads,
        instagramPostId: instagramResult.publishedPostId,
        instagramContainerId: instagramResult.containerId
      };
    } catch (instagramError) {
      console.error('❌ Post Upload: Instagram publishing failed:', instagramError);
      console.error('   📍 Error details:', {
        message: instagramError instanceof Error ? instagramError.message : 'Unknown error',
        stack: instagramError instanceof Error ? instagramError.stack : undefined
      });
      
      // Return success for Cloudinary upload but include Instagram error
      // Post remains unpublished since Instagram failed
      console.log('⚠️  Post Upload: Instagram failed, but Cloudinary succeeded. Post remains unpublished.');
      
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
      try {
        // Read the local image file
        const imageUrl = await getImageUrlFromAppDir(imageMeta.fileName);
        
        // Convert the image URL to a File object
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Create a File object with the original metadata
        const file = new File([blob], imageMeta.fileName, {
          type: imageMeta.mimeType,
          lastModified: Date.now()
        });
        
        imageFiles.push(file);
      } catch (error) {
        console.error(`Failed to read image ${imageMeta.fileName}:`, error);
        return {
          success: false,
          error: `Failed to read local image: ${imageMeta.fileName}`
        };
      }
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
    return post.cloudinaryImages && post.cloudinaryImages.length > 0;
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
