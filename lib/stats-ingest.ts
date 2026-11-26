import 'server-only';
import { store } from './store';
import { parseTikTokCsv } from './tiktok';
import { todayInStudio } from './date';
import { type AudiencePatch, type FollowerPoint, type NewRevenue, type StatSource, type Territory } from './types';

const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/** Applies the CSV files of a TikTok export to one character. Returns a French summary, or null if nothing was recognised. */
export async function importTikTokTexts(characterId: string, files: { name: string; text: string }[]): Promise<string | null> {
  const today = todayInStudio();
  const done: string[] = [];
  const audience: AudiencePatch = { source: 'csv' };
  for (const f of files) {
    const parsed = parseTikTokCsv(f.text, today);
    if (!parsed) continue;
    if (parsed.kind === 'history' && parsed.points.length) {
      await store().upsertFollowers(parsed.points.map((p): FollowerPoint => ({ ...p, characterId, source: 'csv' })));
      done.push(`${parsed.points.length} jour${parsed.points.length > 1 ? 's' : ''} d'abonnés`);
    } else if (parsed.kind === 'activity') {
      audience.hours = parsed.hours; audience.hoursDays = parsed.days; done.push('heures actives');
    } else if (parsed.kind === 'gender') {
      audience.gender = parsed.gender; done.push('genre');
    } else if (parsed.kind === 'territories') {
      audience.territories = parsed.territories; done.push('pays');
    }
  }
  if (Object.keys(audience).length > 1) await store().saveAudience(characterId, audience);
  return done.length ? done.join(', ') : null;
}

/**
 * Payload accepted by POST /api/stats (Process sync, or any script).
 * {
 *   characterId: "tarbanouche",
 *   followers?: [{ date: "2026-11-26", followers: 9100 }],
 *   audience?: { gender?: {male, female, other}, territories?: [{cc, share}], hours?: number[24], hoursDays?: number },
 *   revenues?: [{ date, amount, currency, source, note?, ref? }],
 *   source?: "process" | "csv" | "manuel"
 * }
 */
export async function ingestPayload(body: unknown): Promise<{ ok: true; followers: number; audience: boolean; revenues: number } | { ok: false; error: string }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Corps JSON attendu.' };
  const b = body as Record<string, unknown>;
  const characters = await store().listCharacters();
  const characterId = clip(b.characterId, 64);
  const character = characters.find(c => c.id === characterId || c.slug === characterId);
  if (!character) return { ok: false, error: `characterId inconnu. Valeurs possibles : ${characters.map(c => c.id).join(', ')}.` };
  const source: StatSource = b.source === 'csv' || b.source === 'manuel' ? b.source : 'process';

  const followers: FollowerPoint[] = [];
  if (Array.isArray(b.followers)) {
    for (const p of b.followers.slice(0, 1000) as Record<string, unknown>[]) {
      const n = Number(p?.followers);
      if (isDay(p?.date) && Number.isFinite(n) && n >= 0) followers.push({ characterId: character.id, date: p.date, followers: Math.round(n), source });
    }
  }

  let audience: AudiencePatch | null = null;
  if (b.audience && typeof b.audience === 'object') {
    const a = b.audience as Record<string, unknown>;
    const patch: AudiencePatch = { source };
    const g = a.gender as Record<string, unknown> | undefined;
    if (g && typeof g === 'object') patch.gender = { male: Number(g.male) || 0, female: Number(g.female) || 0, other: Number(g.other) || 0 };
    if (Array.isArray(a.territories)) {
      patch.territories = (a.territories as Record<string, unknown>[])
        .map((t): Territory => ({ cc: clip(t?.cc, 8).toUpperCase() === 'OTHER' ? 'other' : clip(t?.cc, 2).toUpperCase(), share: Number(t?.share) || 0 }))
        .filter(t => t.cc && t.share > 0).slice(0, 50);
    }
    if (Array.isArray(a.hours) && a.hours.length === 24) {
      patch.hours = a.hours.map(v => Math.max(0, Math.round(Number(v) || 0)));
      patch.hoursDays = Math.max(1, Math.round(Number(a.hoursDays) || 1));
    }
    if (Object.keys(patch).length > 1) audience = patch;
  }

  const revenues: NewRevenue[] = [];
  if (Array.isArray(b.revenues)) {
    for (const r of b.revenues.slice(0, 1000) as Record<string, unknown>[]) {
      const amount = Number(r?.amount);
      const currency = clip(r?.currency, 3).toUpperCase();
      if (!isDay(r?.date) || !Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) continue;
      revenues.push({
        date: r.date as string, amount: Math.round(amount * 100) / 100, currency, source: clip(r?.source, 40) || 'autre',
        characterId: character.id, note: clip(r?.note, 300), ref: clip(r?.ref, 200),
      });
    }
  }

  if (followers.length) await store().upsertFollowers(followers);
  if (audience) await store().saveAudience(character.id, audience);
  const added = revenues.length ? await store().addRevenues(revenues) : 0;
  return { ok: true, followers: followers.length, audience: !!audience, revenues: added };
}
