import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@/lib/upload';

const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
};

/** Serves files uploaded in local dev (production uses Vercel Blob URLs instead). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const file = path.resolve(LOCAL_DIR, ...parts);
  if (!file.startsWith(LOCAL_DIR + path.sep)) return new Response('Introuvable', { status: 404 });
  try {
    const data = await fs.readFile(file);
    const ext = path.extname(file).slice(1).toLowerCase();
    return new Response(new Uint8Array(data), { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' } });
  } catch {
    return new Response('Introuvable', { status: 404 });
  }
}
