import { getCloudinaryConfig } from './cloudinary';

/**
 * Checks if Cloudinary is properly configured
 * @returns Object with configuration status and details
 */
export function checkCloudinaryConfig() {
  const config = getCloudinaryConfig();
  
  if (!config) {
    return {
      isConfigured: false,
      missingFields: ['cloudinaryCloudName', 'cloudinaryUploadPreset'],
      message: 'Cloudinary is not configured. Please go to Settings to configure your Cloudinary credentials.',
      config: null
    };
  }

  const missingFields: string[] = [];
  
  if (!config.cloudName) {
    missingFields.push('cloudinaryCloudName');
  }
  
  if (!config.uploadPreset) {
    missingFields.push('cloudinaryUploadPreset');
  }

  if (missingFields.length > 0) {
    return {
      isConfigured: false,
      missingFields,
      message: `Cloudinary configuration incomplete. Missing: ${missingFields.join(', ')}`,
      config: null
    };
  }

  return {
    isConfigured: true,
    missingFields: [],
    message: 'Cloudinary is properly configured and ready to use.',
    config
  };
}

/**
 * Gets a user-friendly message about Cloudinary configuration status
 * @returns String message for display to users
 */
export function getCloudinaryStatusMessage(): string {
  const status = checkCloudinaryConfig();
  return status.message;
}

/**
 * Checks if Cloudinary can be used for uploads
 * @returns True if Cloudinary is ready for uploads
 */
export function canUseCloudinary(): boolean {
  return checkCloudinaryConfig().isConfigured;
}

/**
 * Gets configuration tips for setting up Cloudinary
 * @returns Array of helpful tips
 */
export function getCloudinarySetupTips(): string[] {
  return [
    'Create a free account at cloudinary.com',
    'Get your Cloud Name from the dashboard',
    'Create an Upload Preset with "Unsigned" signing mode',
    'Set the folder to "social-media-posts" (optional)',
    'Enter your credentials in the Settings page'
  ];
}

/**
 * Validates Cloudinary configuration before upload
 * @returns Validation result with error message if invalid
 */
export function validateCloudinaryForUpload(): { isValid: boolean; error?: string } {
  const status = checkCloudinaryConfig();
  
  if (!status.isConfigured) {
    return {
      isValid: false,
      error: status.message
    };
  }

  return { isValid: true };
}

