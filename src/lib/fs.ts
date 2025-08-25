// File System Access helpers
// Note: Works only in secure contexts (https) and supported browsers

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
    // @ts-expect-error: removeEntry typing varies
    await dir.removeEntry(fileName);
  } catch {
    // ignore missing or permission errors
  }
}


