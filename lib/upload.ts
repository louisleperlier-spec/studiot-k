import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

/** Local dev storage, served by app/fichiers/[...path]/route.ts. */
export const LOCAL_DIR = path.join(process.cwd(), '.data', 'uploads');

const MAX_BYTES = 25 * 1024 * 1024;

/** Saves a file to Vercel Blob in production, or to .data/uploads in local dev. Returns its public URL. */
export async function saveUpload(file: File, folder: string): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('Fichier trop lourd (25 Mo maximum).');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${folder}/${randomUUID()}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: 'public', contentType: file.type || undefined });
    return blob.url;
  }
  if (process.env.VERCEL) throw new Error('Stockage des fichiers non configuré : ajoute Vercel Blob au projet.');
  const dest = path.join(LOCAL_DIR, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return `/fichiers/${name}`;
}

export function kindOf(file: File): 'image' | 'video' | 'audio' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}
