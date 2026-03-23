/**
 * OPFS (Origin Private File System) utilities for model file caching.
 * The RunAnywhere SDK handles OPFS internally, so this is a thin
 * wrapper for any custom file storage needs.
 */

export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

export async function fileExistsInOPFS(filename: string): Promise<boolean> {
  try {
    const root = await getOPFSRoot();
    await root.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileToOPFS(filename: string, data: ArrayBuffer): Promise<void> {
  const root = await getOPFSRoot();
  const handle = await root.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function readFileFromOPFS(filename: string): Promise<ArrayBuffer | null> {
  try {
    const root = await getOPFSRoot();
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

export async function deleteFileFromOPFS(filename: string): Promise<void> {
  try {
    const root = await getOPFSRoot();
    await root.removeEntry(filename);
  } catch {
    // file doesn't exist, no-op
  }
}
