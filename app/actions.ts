'use server';
import { revalidatePath } from 'next/cache';
import { store } from '@/lib/store';
import { kindOf, saveUpload } from '@/lib/upload';
import { NETWORKS, type Network, type NewPost, type PostStatus } from '@/lib/types';
import { formatById, nextFreeSlot, postCaption, rampStep } from '@/lib/concepts';
import { generateConcepts } from '@/lib/generate';
import { formatLongFr, todayInStudio } from '@/lib/date';

export type ActionResult = { ok: true; message: string } | { ok: false; message: string } | null;

const STATUSES: PostStatus[] = ['draft', 'scheduled', 'published', 'failed'];
const str = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? '').trim().slice(0, max);

/* ---------- Personnages ---------- */

export async function saveCharacter(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, 'id', 64);
  const name = str(form, 'name', 80);
  if (!name) return { ok: false, message: 'Le nom ne peut pas être vide.' };
  const color = /^#[0-9a-f]{6}$/i.test(str(form, 'color')) ? str(form, 'color') : undefined;
  await store().updateCharacter(id, {
    name, color,
    universe: str(form, 'universe'),
    tone: str(form, 'tone'),
    catchphrases: str(form, 'catchphrases'),
    voiceId: str(form, 'voiceId', 120),
    voiceNotes: str(form, 'voiceNotes'),
  });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Fiche enregistrée.' };
}

export async function uploadAssets(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, 'id', 64);
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: 'Choisis au moins un fichier.' };
  try {
    for (const file of files) {
      const url = await saveUpload(file, `personnages/${id}`);
      await store().addAsset(id, { url, name: file.name, kind: kindOf(file) });
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "L'envoi a échoué." };
  }
  revalidatePath('/personnages');
  return { ok: true, message: files.length > 1 ? `${files.length} fichiers ajoutés.` : 'Fichier ajouté.' };
}

export async function removeAsset(characterId: string, assetId: string) {
  await store().removeAsset(characterId, assetId);
  revalidatePath('/personnages');
}

/* ---------- Posts ---------- */

export async function savePost(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, 'id', 64);
  const date = str(form, 'date', 10);
  const time = str(form, 'time', 5);
  const title = str(form, 'title', 160);
  const status = str(form, 'status', 20) as PostStatus;
  const networks = form.getAll('networks').map(String).filter((n): n is Network => (NETWORKS as readonly string[]).includes(n));
  if (!title) return { ok: false, message: 'Donne un titre au post.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Date invalide.' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: 'Heure invalide.' };
  if (!STATUSES.includes(status)) return { ok: false, message: 'Statut invalide.' };
  if (!networks.length) return { ok: false, message: 'Choisis au moins un réseau.' };

  let mediaUrl = str(form, 'mediaUrl', 1000);
  const media = form.get('media');
  try {
    if (media instanceof File && media.size > 0) mediaUrl = await saveUpload(media, 'posts');
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "L'envoi a échoué." };
  }

  const data: NewPost = { characterId: str(form, 'characterId', 64), title, caption: str(form, 'caption'), date, time, networks, status, mediaUrl };
  if (id) await store().updatePost(id, data);
  else await store().createPost(data);
  revalidatePath('/', 'layout');
  return { ok: true, message: id ? 'Post mis à jour.' : 'Post programmé.' };
}

export async function movePost(id: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await store().updatePost(id, { date });
  revalidatePath('/', 'layout');
}

export async function deletePost(id: string) {
  await store().deletePost(id);
  revalidatePath('/', 'layout');
}

/* ---------- Générateur de concepts ---------- */

export type GenerateResult = { ok: true; message: string; ids: string[] } | { ok: false; message: string } | null;

export async function generateAction(_prev: GenerateResult, form: FormData): Promise<GenerateResult> {
  const characters = await store().listCharacters();
  const picked = form.getAll('characterIds').map(String);
  const chosen = characters.filter(c => picked.includes(c.id));
  const trend = str(form, 'trend', 200);
  const format = formatById(str(form, 'formatId', 40));
  const count = Math.min(5, Math.max(1, Number(str(form, 'count', 2)) || 3));
  if (!chosen.length) return { ok: false, message: 'Choisis au moins un personnage.' };
  if (!trend) return { ok: false, message: 'Écris ou choisis une tendance.' };
  if (!format) return { ok: false, message: 'Choisis un format.' };

  const { concepts, note } = await generateConcepts({ characters: chosen, trend, format, twist: str(form, 'twist', 300), count });
  const saved = await store().createConcepts(concepts);
  if (form.get('saveTrend') === 'on') await store().addTrend(trend);
  revalidatePath('/concepts');
  return { ok: true, message: note ?? `${saved.length} concepts prêts.`, ids: saved.map(c => c.id) };
}

export async function setConceptStatus(id: string, status: 'idea' | 'kept') {
  await store().updateConcept(id, { status });
  revalidatePath('/concepts');
}

export async function deleteConcept(id: string) {
  await store().deleteConcept(id);
  revalidatePath('/concepts');
}

/** Sends a concept to the calendar as a draft, on the next free slot for the current ramp step. */
export async function scheduleConcept(id: string): Promise<ActionResult> {
  const c = await store().getConcept(id);
  if (!c) return { ok: false, message: 'Concept introuvable.' };
  const posts = await store().listPosts();
  if (c.postId && posts.some(p => p.id === c.postId)) return { ok: false, message: 'Ce concept est déjà dans le calendrier.' };
  const today = todayInStudio();
  const { step } = rampStep(posts, today);
  const slot = nextFreeSlot(posts, today, step);
  const post = await store().createPost({
    characterId: c.characterIds[0], title: c.title, caption: postCaption(c),
    date: slot.date, time: slot.time, networks: [...NETWORKS], status: 'draft', mediaUrl: '',
  });
  await store().updateConcept(id, { status: 'scheduled', postId: post.id });
  revalidatePath('/', 'layout');
  return { ok: true, message: `${formatLongFr(slot.date)} à ${slot.time}` };
}

export async function removeTrend(id: string) {
  await store().removeTrend(id);
  revalidatePath('/concepts');
}
