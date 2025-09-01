export type PostFormat = '1:1' | '4:5' | '16:9';

export interface CropDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate crop dimensions to fit an image into a specific aspect ratio
 * The image will be cropped from the center, maintaining the aspect ratio
 */
export function calculateCropDimensions(
  imageWidth: number,
  imageHeight: number,
  targetFormat: PostFormat
): CropDimensions {
  let targetWidth: number;
  let targetHeight: number;

  // Define target dimensions based on format
  switch (targetFormat) {
    case '1:1':
      targetWidth = 1080;
      targetHeight = 1080;
      break;
    case '4:5':
      targetWidth = 1080;
      targetHeight = 1350;
      break;
    case '16:9':
      targetWidth = 1080;
      targetHeight = 607.5;
      break;
    default:
      targetWidth = 1080;
      targetHeight = 1080;
  }

  // Calculate the target aspect ratio
  const targetAspectRatio = targetWidth / targetHeight;
  const imageAspectRatio = imageWidth / imageHeight;

  let cropWidth: number;
  let cropHeight: number;
  let cropX: number;
  let cropY: number;

  if (imageAspectRatio > targetAspectRatio) {
    // Image is wider than target - crop horizontally
    cropHeight = imageHeight;
    cropWidth = imageHeight * targetAspectRatio;
    cropX = (imageWidth - cropWidth) / 2;
    cropY = 0;
  } else {
    // Image is taller than target - crop vertically
    cropWidth = imageWidth;
    cropHeight = imageWidth / targetAspectRatio;
    cropX = 0;
    cropY = (imageHeight - cropHeight) / 2;
  }

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
}

/**
 * Crop an image to the specified format using HTML5 Canvas
 */
export async function cropImageToFormat(
  imageFile: File,
  targetFormat: PostFormat
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      const cropDimensions = calculateCropDimensions(img.width, img.height, targetFormat);
      
      // Set canvas size to target format dimensions
      let targetWidth: number;
      let targetHeight: number;
      
      switch (targetFormat) {
        case '1:1':
          targetWidth = 1080;
          targetHeight = 1080;
          break;
        case '4:5':
          targetWidth = 1080;
          targetHeight = 1350;
          break;
        case '16:9':
          targetWidth = 1080;
          targetHeight = 607.5;
          break;
        default:
          targetWidth = 1080;
          targetHeight = 1080;
      }
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw the cropped portion of the image, scaled to fit the target dimensions
      ctx.drawImage(
        img,
        cropDimensions.x,
        cropDimensions.y,
        cropDimensions.width,
        cropDimensions.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Convert canvas to blob and then to file
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], imageFile.name, {
            type: imageFile.type,
            lastModified: Date.now()
          });
          resolve(croppedFile);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, imageFile.type, 0.9);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(imageFile);
  });
}

/**
 * Get the display name for a post format
 */
export function getFormatDisplayName(format: PostFormat): string {
  switch (format) {
    case '1:1':
      return 'Square (1:1)';
    case '4:5':
      return 'Portrait (4:5)';
    case '16:9':
      return 'Landscape (16:9)';
    default:
      return format;
  }
}

/**
 * Get the dimensions string for a post format
 */
export function getFormatDimensions(format: PostFormat): string {
  switch (format) {
    case '1:1':
      return '1080×1080';
    case '4:5':
      return '1080×1350';
    case '16:9':
      return '1080×607';
    default:
      return '';
  }
}

