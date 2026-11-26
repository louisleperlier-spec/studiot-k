import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ingestPayload } from '@/lib/stats-ingest';

export const dynamic = 'force-dynamic';

/**
 * Porte d'entrée de la synchro : Claude (via Process) ou un script envoie les chiffres ici.
 * Protégée par STATS_API_TOKEN, en en-tête « Authorization: Bearer <jeton> ».
 */
function authorized(req: Request): boolean | null {
  const token = process.env.STATS_API_TOKEN;
  if (!token) return null;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const auth = authorized(req);
  if (auth === null) return Response.json({ error: 'Synchro désactivée : ajoute STATS_API_TOKEN dans les variables du projet.' }, { status: 503 });
  if (!auth) return Response.json({ error: 'Jeton invalide.' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON invalide.' }, { status: 400 }); }
  const res = await ingestPayload(body);
  if (!res.ok) return Response.json({ error: res.error }, { status: 422 });
  revalidatePath('/stats');
  return Response.json(res);
}
