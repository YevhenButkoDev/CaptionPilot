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

  // Decode image using createImageBitmap for robustness (works in Tauri WebView)
  const arrayBuf = await file.arrayBuffer();
  const bitmap = await createImageBitmap(new Blob([arrayBuf]));

  // Compute target dimensions
  const { width, height } = calculateDimensions(
    bitmap.width,
    bitmap.height,
    opts.maxWidth!,
    opts.maxHeight!
  );

  // Prefer OffscreenCanvas when available; fallback to HTMLCanvasElement
  let blobProducer: (quality: number) => Promise<Blob>;

  if (typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
    const off = new (globalThis as any).OffscreenCanvas(width, height);
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    ctx.drawImage(bitmap, 0, 0, width, height);
    blobProducer = async (quality: number) => {
      // convertToBlob is supported on OffscreenCanvas
      return await (off as any).convertToBlob({ type: opts.format, quality });
    };
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    ctx.drawImage(bitmap, 0, 0, width, height);
    blobProducer = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Failed to create blob'));
        resolve(blob);
      }, opts.format, quality);
    });
  }

  // Iteratively lower quality to meet file size target
  let currentQuality = opts.quality!;
  let attempts = 0;
  const maxAttempts = 10;
  let out = await blobProducer(currentQuality);
  while (out.size > opts.maxFileSize! && attempts < maxAttempts) {
    attempts++;
    currentQuality = Math.max(0.1, currentQuality * 0.9);
    out = await blobProducer(currentQuality);
  }
  return out;
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
