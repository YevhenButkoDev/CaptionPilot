// Image compression utility using Canvas API
// Targets ~1080px width and <8MB file size

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
  maxFileSize: 8 * 1024 * 1024, // 8MB
  quality: 1,
  format: 'image/jpeg'
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        const { width, height } = calculateDimensions(
          img.width,
          img.height,
          opts.maxWidth!,
          opts.maxHeight!
        );

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to meet file size requirement
        let currentQuality = opts.quality!;
        let attempts = 0;
        const maxAttempts = 10;

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }

              // Check if file size is acceptable
              if (blob.size <= opts.maxFileSize! || attempts >= maxAttempts) {
                resolve(blob);
                return;
              }

              // Reduce quality and try again
              attempts++;
              currentQuality = Math.max(0.1, currentQuality * 0.9);
              tryCompress();
            },
            opts.format,
            currentQuality
          );
        };

        tryCompress();
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let { width, height } = { width: originalWidth, height: originalHeight };

  // Scale down if width exceeds maxWidth
  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  // Scale down if height exceeds maxHeight
  if (height > maxHeight) {
    const ratio = maxHeight / height;
    height = maxHeight;
    width = Math.round(width * ratio);
  }

  // Ensure minimum dimensions
  width = Math.max(width, 320);
  height = Math.max(height, 320);

  return { width, height };
}

export async function compressImageToFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const compressedBlob = await compressImage(file, options);
  
  // Create new file with compressed data
  const compressedFile = new File(
    [compressedBlob],
    file.name.replace(/\.[^/.]+$/, '') + '_compressed.jpg',
    {
      type: 'image/jpeg',
      lastModified: Date.now()
    }
  );

  return compressedFile;
}

// Utility to check if compression is needed
export function shouldCompress(file: File, maxSize: number = 8 * 1024 * 1024): boolean {
  return file.size > maxSize;
}
