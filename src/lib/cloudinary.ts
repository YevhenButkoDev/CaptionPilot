import logger, { LogContext } from './logger';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string; // Optional for unsigned uploads
}

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
}

export interface CloudinaryError {
  error: {
    message: string;
    http_code?: number;
  };
}

/**
 * Uploads an image file to Cloudinary
 * @param file - The image file to upload
 * @param config - Cloudinary configuration
 * @param options - Additional upload options
 * @returns Promise with upload result or error
 */
export async function uploadImageToCloudinary(
  file: File,
  config: CloudinaryConfig,
  options: {
    folder?: string;
    tags?: string[];
    transformation?: string;
  } = {}
): Promise<CloudinaryUploadResult | CloudinaryError> {
  try {
    // Create FormData for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', config.uploadPreset);
    
    // Add optional parameters
    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.tags && options.tags.length > 0) {
      formData.append('tags', options.tags.join(','));
    }
    if (options.transformation) {
      formData.append('transformation', options.transformation);
    }

    // Build the upload URL
    const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
    
    // Make the upload request
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: {
          message: errorData.error?.message || `Upload failed with status ${response.status}`,
          http_code: response.status
        }
      };
    }

    const result = await response.json();
    
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      createdAt: result.created_at
    };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown upload error'
      }
    };
  }
}

/**
 * Uploads multiple images to Cloudinary
 * @param files - Array of image files to upload
 * @param config - Cloudinary configuration
 * @param options - Additional upload options
 * @returns Promise with array of upload results
 */
export async function uploadMultipleImagesToCloudinary(
  files: File[],
  config: CloudinaryConfig,
  options: {
    folder?: string;
    tags?: string[];
    transformation?: string;
  } = {}
): Promise<(CloudinaryUploadResult | CloudinaryError)[]> {
  const uploadPromises = files.map(file => 
    uploadImageToCloudinary(file, config, options)
  );
  
  return Promise.all(uploadPromises);
}

/**
 * Applies transformations to a Cloudinary URL
 * @param url - The original Cloudinary URL
 * @param transformation - The transformation string to apply
 * @returns The transformed URL
 */
export function applyTransformation(url: string, transformation: string): string {
  // Insert transformation before the file extension
  const lastDotIndex = url.lastIndexOf('.');
  if (lastDotIndex === -1) return url;
  
  const baseUrl = url.substring(0, lastDotIndex);
  const extension = url.substring(lastDotIndex);
  
  // Insert transformation before the extension
  return `${baseUrl}/${transformation}${extension}`;
}

/**
 * Gets Cloudinary configuration from localStorage settings
 * @returns Cloudinary configuration or null if not configured
 */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  try {
    const savedSettings = localStorage.getItem("app-settings");
    if (!savedSettings) {
      logger.warn(LogContext.CLOUDINARY, 'Cloudinary configuration not found. Please configure your Cloudinary settings in the Settings page.');
      return null;
    }
    
    const settings = JSON.parse(savedSettings);
    const { cloudinaryCloudName, cloudinaryUploadPreset, cloudinaryApiKey } = settings;
    
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      logger.warn(LogContext.CLOUDINARY, 'Cloudinary configuration incomplete. Please set both Cloud Name and Upload Preset in Settings.');
      return null;
    }
    
    return {
      cloudName: cloudinaryCloudName,
      uploadPreset: cloudinaryUploadPreset,
      apiKey: cloudinaryApiKey
    };
  } catch (error) {
    logger.error(LogContext.CLOUDINARY, 'Failed to load Cloudinary configuration', error);
    return null;
  }
}
