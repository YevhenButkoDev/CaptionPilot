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
 * Deletes an image from Cloudinary (requires signed uploads)
 * @param publicId - The public ID of the image to delete
 * @param config - Cloudinary configuration with API key
 * @returns Promise with deletion result
 */
export async function deleteImageFromCloudinary(
  publicId: string,
  config: CloudinaryConfig & { apiKey: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.apiKey) {
      throw new Error('API key is required for deletion');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = await generateSignature(publicId, timestamp, config);
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('api_key', config.apiKey);

    const deleteUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`;
    
    const response = await fetch(deleteUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error?.message || `Deletion failed with status ${response.status}`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deletion error'
    };
  }
}

/**
 * Generates a signature for Cloudinary API calls (requires server-side implementation)
 * This is a placeholder - in production, signatures should be generated server-side
 */
async function generateSignature(
  publicId: string, 
  timestamp: number, 
  config: CloudinaryConfig & { apiKey: string }
): Promise<string> {
  // This is a placeholder - in a real application, you would:
  // 1. Send the request to your backend
  // 2. Generate the signature server-side using your secret key
  // 3. Return the signature
  
  throw new Error('Signature generation requires server-side implementation');
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
      console.warn('Cloudinary configuration not found. Please configure your Cloudinary settings in the Settings page.');
      return null;
    }
    
    const settings = JSON.parse(savedSettings);
    const { cloudinaryCloudName, cloudinaryUploadPreset, cloudinaryApiKey } = settings;
    
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      console.warn('Cloudinary configuration incomplete. Please set both Cloud Name and Upload Preset in Settings.');
      return null;
    }
    
    return {
      cloudName: cloudinaryCloudName,
      uploadPreset: cloudinaryUploadPreset,
      apiKey: cloudinaryApiKey
    };
  } catch (error) {
    console.error('Failed to load Cloudinary configuration:', error);
    return null;
  }
}
