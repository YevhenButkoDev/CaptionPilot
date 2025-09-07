// Image compression utility using Canvas API
// Targets ~1080px width and <8MB file size

import logger, { LogContext } from './logger';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxFileSize?: number; // in bytes
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1080,
  maxHeight: 1350, // 4:5 aspect ratio max
  maxFileSize: 7.5 * 1024 * 1024, // 7.5MB (leave some buffer under 8MB limit)
  quality: 1.0, // Start with maximum quality
  format: 'image/jpeg' // Will be overridden to preserve original format
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Preserve original format unless explicitly specified
  if (!options.format) {
    opts.format = file.type as 'image/jpeg' | 'image/png';
  }
  
  logger.debug(LogContext.IMAGE_PROCESSING, 'Starting compression', {
    fileName: file.name,
    sourceSizeMB: (file.size / 1024 / 1024).toFixed(2),
    targetMaxSizeMB: (opts.maxFileSize! / 1024 / 1024).toFixed(2),
    options: {
      maxWidth: opts.maxWidth,
      maxHeight: opts.maxHeight,
      quality: opts.quality,
      format: opts.format
    }
  });

  // Decode image using createImageBitmap for robustness (works in Tauri WebView)
  const arrayBuf = await file.arrayBuffer();
  const bitmap = await createImageBitmap(new Blob([arrayBuf]));

  logger.debug(LogContext.IMAGE_PROCESSING, 'Original dimensions', { width: bitmap.width, height: bitmap.height });

  // For compression, we should preserve original dimensions and only compress quality
  // The cropping to specific formats will be handled by cropImageToFormat function
  let targetWidth = bitmap.width;
  let targetHeight = bitmap.height;
  
  logger.debug(LogContext.IMAGE_PROCESSING, 'Compression settings', { 
    targetWidth, 
    targetHeight, 
    note: 'Format-specific cropping will be handled separately' 
  });

  // Create blob producer function
  const createBlobProducer = (width: number, height: number) => {
    if (typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
      const off = new (globalThis as any).OffscreenCanvas(width, height);
      const ctx = off.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(bitmap, 0, 0, width, height);
      return async (quality: number) => {
        return await (off as any).convertToBlob({ type: opts.format, quality });
      };
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(bitmap, 0, 0, width, height);
      return (quality: number) => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to create blob'));
          resolve(blob);
        }, opts.format, quality);
      });
    }
  };

  // Simple compression: start from quality 1.0 and reduce if needed
  let blobProducer = createBlobProducer(targetWidth, targetHeight);
  let currentQuality = 1.0;
  let attempts = 0;
  const maxAttempts = 10;
  let result = await blobProducer(currentQuality);
  
  logger.debug(LogContext.IMAGE_PROCESSING, 'Starting compression from quality 1.0');
  logger.debug(LogContext.IMAGE_PROCESSING, `Compression attempt ${attempts + 1}`, { 
    quality: currentQuality.toFixed(3), 
    sizeMB: (result.size / 1024 / 1024).toFixed(2) 
  });
  
  // If quality 1.0 fits, we're done
  if (result.size <= opts.maxFileSize!) {
    logger.debug(LogContext.IMAGE_PROCESSING, 'Quality 1.0 fits within target size - no compression needed');
  } else {
    // Quality 1.0 is too big, reduce quality
    logger.debug(LogContext.IMAGE_PROCESSING, 'Quality 1.0 too big, reducing quality');
    
    while (result.size > opts.maxFileSize! && attempts < maxAttempts) {
      attempts++;
      currentQuality = Math.max(0.1, currentQuality - 0.03); // Reduce by 0.03 each time
      result = await blobProducer(currentQuality);
      
      logger.debug(LogContext.IMAGE_PROCESSING, `Compression attempt ${attempts + 1}`, { 
        quality: currentQuality.toFixed(3), 
        sizeMB: (result.size / 1024 / 1024).toFixed(2) 
      });
    }
  }
  
  const compressionRatio = ((file.size - result.size) / file.size * 100).toFixed(1);
  logger.info(LogContext.IMAGE_PROCESSING, 'Compression complete', {
    finalQuality: currentQuality.toFixed(3),
    finalDimensions: `${targetWidth}x${targetHeight}`,
    sourceSizeMB: (file.size / 1024 / 1024).toFixed(2),
    finalSizeMB: (result.size / 1024 / 1024).toFixed(2),
    compressionRatio: `${compressionRatio}%`,
    sizeReduction: `${(file.size / 1024 / 1024).toFixed(2)} MB → ${(result.size / 1024 / 1024).toFixed(2)} MB`,
    attemptsUsed: attempts + 1
  });
  
  return result;
}

export async function compressImageToFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const compressedBlob = await compressImage(file, options);
  
  // Determine the file extension based on the compressed blob type
  const extension = compressedBlob.type === 'image/png' ? '.png' : '.jpg';
  
  // Create new file with compressed data, preserving original extension
  const compressedFile = new File(
    [compressedBlob],
    file.name.replace(/\.[^/.]+$/, '') + '_compressed' + extension,
    {
      type: compressedBlob.type,
      lastModified: Date.now()
    }
  );

  return compressedFile;
}

// High quality compression for Instagram posts
export async function compressImageForInstagram(
  file: File,
  postFormat: '1:1' | '4:5' | '16:9' = '1:1'
): Promise<File> {
  logger.debug(LogContext.IMAGE_PROCESSING, 'Using Instagram-optimized compression', {
    fileName: file.name,
    postFormat,
    note: `Compression will preserve original dimensions, cropping to ${postFormat} will be handled separately`
  });
  
  return compressImageToFile(file, {
    maxWidth: 9999, // Large number to avoid resizing during compression
    maxHeight: 9999, // Large number to avoid resizing during compression
    maxFileSize: 7.5 * 1024 * 1024, // 7.5MB
    quality: 1.0, // Start with maximum quality
    // format will be preserved from original file
  });
}

// Standard compression for general use
export async function compressImageStandard(
  file: File
): Promise<File> {
  logger.debug(LogContext.IMAGE_PROCESSING, 'Using standard compression', { fileName: file.name });
  return compressImageToFile(file, {
    maxWidth: 9999, // Large number to avoid resizing during compression
    maxHeight: 9999, // Large number to avoid resizing during compression
    maxFileSize: 5 * 1024 * 1024, // 5MB
    quality: 1.0, // Start with maximum quality
    // format will be preserved from original file
  });
}

// Utility to check if compression is needed
export function shouldCompress(file: File, maxSize: number = 8 * 1024 * 1024): boolean {
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
  
  // Always compress if file is larger than max size
  if (file.size > maxSize) {
    logger.debug(LogContext.IMAGE_PROCESSING, 'Compression needed - file size exceeds limit', {
      fileName: file.name,
      fileSizeMB,
      maxSizeMB: (maxSize / 1024 / 1024).toFixed(2)
    });
    return true;
  }
  
  // Also compress if file is reasonably large (>2MB) and could benefit from optimization
  // This helps with quality optimization even for files under the limit
  if (file.size > 2 * 1024 * 1024) {
    logger.debug(LogContext.IMAGE_PROCESSING, 'Compression needed - large file can benefit from optimization', {
      fileName: file.name,
      fileSizeMB
    });
    return true;
  }
  
  // For smaller files, only compress if they're PNG (which can be large) or very high resolution
  if (file.type === 'image/png' && file.size > 500 * 1024) {
    logger.debug(LogContext.IMAGE_PROCESSING, 'Compression needed - PNG file can be optimized', {
      fileName: file.name,
      fileSizeMB
    });
    return true;
  }
  
  logger.debug(LogContext.IMAGE_PROCESSING, 'No compression needed - file size is already optimized', {
    fileName: file.name,
    fileSizeMB
  });
  return false;
}
