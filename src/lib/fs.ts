// File System helpers
// Browser FSA fallback + Tauri app-dir storage when available

import logger, { LogContext } from './logger';

export async function pickLibraryDir(): Promise<FileSystemDirectoryHandle> {
  // @ts-expect-error: showDirectoryPicker is not in lib.dom yet in all TS versions
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
  return handle;
}

export async function ensurePermissions(
  dir: FileSystemDirectoryHandle,
  mode: "read" | "readwrite"
): Promise<boolean> {
  // @ts-expect-error: queryPermission types vary across TS versions
  const query: PermissionState = await dir.queryPermission({ mode });
  if (query === "granted") return true;
  // @ts-expect-error: requestPermission types vary across TS versions
  const res: PermissionState = await dir.requestPermission({ mode });
  return res === "granted";
}

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

function uuid(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  // Fallback simple UUID v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveImageToDir(
  dir: FileSystemDirectoryHandle,
  file: File
): Promise<{ fileName: string; mimeType: string; size: number }> {
  const fileName = `${uuid()}${extFromName(file.name)}`;
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return { fileName, mimeType: file.type || "application/octet-stream", size: file.size };
}

export async function getImageUrl(
  dir: FileSystemDirectoryHandle,
  fileName: string
): Promise<string> {
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

export async function deleteImageFromDir(
  dir: FileSystemDirectoryHandle,
  fileName: string
): Promise<void> {
  // removeEntry throws if missing; we can ignore errors silently
  try {
    await dir.removeEntry(fileName);
  } catch {
    // ignore missing or permission errors
  }
}

// -------- Tauri app-dir helpers --------
export async function tauriImports(): Promise<{
  fs: any | null;
  path: any | null;
  tauri: any | null;
}> {
  const isTauriVar = await isTauri();

  if (!isTauriVar) {
    // running as a web app — don't try to load Tauri modules
    return { fs: null, path: null, tauri: null };
  }

  // Tauri desktop: load plugins/APIs dynamically
  const fs =
      (await import("@tauri-apps/plugin-fs").catch(() => null));

  const path =
      (await import("@tauri-apps/api/path").catch(() => null));

  // convertFileSrc lives in v2 @tauri-apps/api/core; fall back to v1 compat if needed
  const tauriCore = await import("@tauri-apps/api/core").catch(() => null as any);

  return {
    fs,
    path,
    tauri: tauriCore
  };
}

export function isTauriSync(): boolean {
  const w = typeof window !== "undefined" ? (window as any) : undefined;
  return !!(
      w &&
      (w.__TAURI_INTERNALS__ || // v2
          w.__TAURI_IPC__      || // v1
          w.__TAURI__)            // very old / custom
  );
}

export async function isTauri(): Promise<boolean> {
  if (isTauriSync()) return true;
  try {
    // If this import succeeds at runtime, we’re inside Tauri
    await import("@tauri-apps/api/core");
    return true;
  } catch {
    return false; // web browser
  }
}

async function ensureImageDir(): Promise<string> {
  const { fs } = await tauriImports();
  if (!fs) throw new Error('Tauri FS not available');

  const base = fs.BaseDirectory.AppData;
  const appLocalDataExists = await fs.exists('', { baseDir: base, });

  if (!appLocalDataExists) {
    await fs.mkdir(
        "",
        {
          baseDir: base,
          recursive: true
        }
    );
  }

  const imagesDirExists = await fs.exists('images', {
    baseDir: base,
  });

  if (!imagesDirExists) {
    await fs.mkdir(
        "images",
        {
          baseDir: base,
          recursive: true
        }
    );
  }
  return "images";
}

export async function saveImageToAppDir(file: File): Promise<{ fileName: string; mimeType: string; size: number }> {
  const isTauriVar = await isTauri();
  if (!isTauriVar) {
    throw new Error('Tauri runtime not detected');
  }
  const { fs } = await tauriImports();
  const dir = await ensureImageDir();
  const fileName = `${uuid()}${extFromName(file.name)}`;
  const full = `${dir}/${fileName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await fs.writeFile(full, bytes, { baseDir: fs.BaseDirectory.AppData });
  return { fileName, mimeType: file.type || 'application/octet-stream', size: file.size };
}

export async function getImageUrlFromAppDir(fileName: string): Promise<string> {
  if (!(await isTauri())) {
    throw new Error("Tauri runtime not detected");
  }

  const { tauri, path } = await tauriImports(); // v2: core has convertFileSrc
  if (!tauri?.convertFileSrc || !path?.appDataDir || !path?.join) {
    throw new Error("Tauri path/core APIs not available");
  }

  try {
    // ensure subfolder exists (returns "images")
    const relDir = await ensureImageDir();

    // build absolute path: <AppData>/<your-app>/images/<fileName>
    const base = await path.appDataDir();
    const absPath = await path.join(base, relDir, fileName);

    logger.debug(LogContext.IMAGE_PROCESSING, 'Image path resolved', { fileName, relDir, base, absPath });

    // make it WebView-safe
    const url = tauri.convertFileSrc(absPath);
    logger.debug(LogContext.IMAGE_PROCESSING, 'Converted URL', { url });
    
    // In production, Tauri's convertFileSrc should work reliably
    // Skip the fetch test as it can cause CORS issues in production
    return url;
  } catch (error) {
    logger.error(LogContext.IMAGE_PROCESSING, 'Error getting image URL', error);
    throw error;
  }
}

export async function deleteImageFromAppDir(fileName: string): Promise<void> {
  const isTauriVar = await isTauri();
  if (!isTauriVar) {
    throw new Error('Tauri runtime not detected');
  }
  const { fs } = await tauriImports();
  const dir = await ensureImageDir();
  const full = `${dir}/${fileName}`;
  try {
    await fs.removeFile(full);
  } catch {
    // ignore
  }
}

export async function listProjectAssets(): Promise<{ fileName: string; mimeType: string; size: number }[]> {
  const isTauriVar = await isTauri();
  if (!isTauriVar) {
    throw new Error('Tauri runtime not detected');
  }
  
  try {
    const { fs } = await tauriImports();
    const dir = await ensureImageDir();
    
    // List all files in the images directory
    const files = await fs.readDir(dir, { baseDir: fs.BaseDirectory.AppData });
    
    // Filter for image files and get their metadata
    const imageFiles = files.filter((file: any) =>
      file.name && !file.children && // Ensure it's a file, not a directory
      (file.name.endsWith('.jpg') || 
       file.name.endsWith('.jpeg') || 
       file.name.endsWith('.png') || 
       file.name.endsWith('.gif') || 
       file.name.endsWith('.webp'))
    );
    
    // Get file info for each image
    const assets = await Promise.all(
      imageFiles.map(async (file: any) => {
        try {
          const fullPath = `${dir}/${file.name}`;
          const stats = await fs.stat(fullPath, { baseDir: fs.BaseDirectory.AppData });
          return {
            fileName: file.name,
            mimeType: getMimeTypeFromExtension(file.name),
            size: stats.size || 0
          };
        } catch {
          // Skip files we can't read
          return null;
        }
      })
    );
    
    return assets.filter(Boolean) as { fileName: string; mimeType: string; size: number }[];
  } catch (error) {
    logger.error(LogContext.IMAGE_PROCESSING, 'Error listing project assets', error);
    return [];
  }
}

function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
