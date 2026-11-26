'use server';
import { revalidatePath } from 'next/cache';
import { store } from '@/lib/store';
import { kindOf, saveUpload } from '@/lib/upload';
import { CURRENCIES, NETWORKS, REVENUE_SOURCES, type Network, type NewPost, type PostStatus } from '@/lib/types';
import { readZipTexts } from '@/lib/zip';
import { importTikTokTexts } from '@/lib/stats-ingest';
import { STARTER_AUDIENCE, STARTER_CHARACTER, STARTER_FOLLOWERS, STARTER_REVENUES } from '@/lib/stats-seed';
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

/* ---------- Stats ---------- */

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

async function characterIdFrom(form: FormData) {
  const id = str(form, 'characterId', 64);
  return (await store().listCharacters()).some(c => c.id === id) ? id : null;
}

export async function importTikTokAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const characterId = await characterIdFrom(form);
  if (!characterId) return { ok: false, message: 'Personnage inconnu.' };
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: 'Choisis le zip ou les CSV exportés depuis TikTok.' };
  const texts: { name: string; text: string }[] = [];
  try {
    for (const f of files) {
      if (f.size > 10_000_000) return { ok: false, message: `${f.name} est trop lourd (10 Mo max).` };
      const buf = Buffer.from(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name) || buf.readUInt32LE(0) === 0x04034b50) texts.push(...readZipTexts(buf));
      else texts.push({ name: f.name, text: buf.toString('utf8') });
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Lecture impossible.' };
  }
  const summary = await importTikTokTexts(characterId, texts);
  if (!summary) return { ok: false, message: "Aucun export TikTok reconnu. Il faut FollowerHistory, FollowerActivity, FollowerGender ou FollowerTopTerritories." };
  revalidatePath('/stats');
  return { ok: true, message: `Importé : ${summary}.` };
}

export async function addFollowerAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const characterId = await characterIdFrom(form);
  const date = str(form, 'date', 10);
  const followers = Number(str(form, 'followers', 12).replace(/[\s ]/g, ''));
  if (!characterId) return { ok: false, message: 'Personnage inconnu.' };
  if (!isDay(date)) return { ok: false, message: 'Date invalide.' };
  if (!Number.isInteger(followers) || followers < 0) return { ok: false, message: "Nombre d'abonnés invalide." };
  await store().upsertFollowers([{ characterId, date, followers, source: 'manuel' }]);
  revalidatePath('/stats');
  return { ok: true, message: 'Relevé enregistré.' };
}

export async function deleteFollowerAction(characterId: string, date: string) {
  await store().deleteFollower(characterId, date);
  revalidatePath('/stats');
}

export async function addRevenueAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const date = str(form, 'date', 10);
  const amount = Number(str(form, 'amount', 20).replace(/[\s ]/g, '').replace(',', '.'));
  const currency = str(form, 'currency', 3).toUpperCase();
  const source = str(form, 'source', 40);
  const characterId = str(form, 'characterId', 64);
  if (!isDay(date)) return { ok: false, message: 'Date invalide.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Montant invalide.' };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { ok: false, message: 'Devise invalide.' };
  if (!REVENUE_SOURCES.some(s => s.id === source)) return { ok: false, message: 'Source invalide.' };
  if (characterId && !(await characterIdFrom(form))) return { ok: false, message: 'Personnage inconnu.' };
  await store().addRevenues([{ date, amount: Math.round(amount * 100) / 100, currency, source, characterId, note: str(form, 'note', 300), ref: '' }]);
  revalidatePath('/stats');
  return { ok: true, message: 'Revenu ajouté.' };
}

export async function deleteRevenueAction(id: string) {
  await store().deleteRevenue(id);
  revalidatePath('/stats');
}

/** One-time load of the Saint Tabarnouche figures from 19-26 Nov 2026. */
export async function loadStarterStats() {
  await store().upsertFollowers(STARTER_FOLLOWERS);
  await store().saveAudience(STARTER_CHARACTER, STARTER_AUDIENCE);
  await store().addRevenues(STARTER_REVENUES);
  revalidatePath('/stats');
}
