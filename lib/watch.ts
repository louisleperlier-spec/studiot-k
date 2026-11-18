import type { Competitor, Network, Spot } from './types';

/** Pure helpers for the competitor watch (no server imports, unit-tested). */

/** Reads "12k", "1,2 M", "850 000", "3.4m vues" into a number of views. */
export function parseViews(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/vues?|views?/g, '').replace(/\s| | /g, '');
  if (!s) return null;
  const m = /^(\d+(?:[.,]\d+)?)([km]|md|b)?$/.exec(s);
  if (!m) {
    const digits = s.replace(/[.,]/g, '');
    return /^\d+$/.test(digits) ? Number(digits) : null;
  }
  const n = Number(m[1].replace(',', '.'));
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'md' || m[2] === 'b' ? 1e9 : 1;
  return Math.round(n * mult);
}

export function formatViews(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',')} k`;
  return String(n);
}

/** Guesses the network and handle from a profile or video link. */
export function fromUrl(url: string): { network?: Network; handle?: string } {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return {}; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  const at = first.startsWith('@') ? first : first ? `@${first}` : undefined;
  if (host.endsWith('tiktok.com')) return { network: 'tiktok', handle: first.startsWith('@') ? first : undefined };
  if (host.endsWith('instagram.com')) return { network: 'instagram', handle: ['p', 'reel', 'reels', 'stories'].includes(first) ? undefined : at };
  if (host.endsWith('youtube.com') || host === 'youtu.be') return { network: 'youtube', handle: first.startsWith('@') ? first : undefined };
  if (host.endsWith('facebook.com') || host === 'fb.watch') return { network: 'facebook', handle: ['watch', 'reel', 'share'].includes(first) ? undefined : at };
  return {};
}

/** Only http(s) links are rendered as links. */
export function safeUrl(url: string): string {
  try { const u = new URL(url.trim()); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''; } catch { return ''; }
}

export interface FormatStat { formatId: string; count: number; totalViews: number; avgViews: number | null }

/** Which formats perform best across spotted videos, best average views first. */
export function formatStats(spots: Spot[]): FormatStat[] {
  const map = new Map<string, { count: number; total: number; withViews: number }>();
  for (const s of spots) {
    const e = map.get(s.formatId) ?? { count: 0, total: 0, withViews: 0 };
    e.count++;
    if (s.views !== null) { e.total += s.views; e.withViews++; }
    map.set(s.formatId, e);
  }
  return [...map].map(([formatId, e]) => ({ formatId, count: e.count, totalViews: e.total, avgViews: e.withViews ? Math.round(e.total / e.withViews) : null }))
    .sort((a, b) => (b.avgViews ?? -1) - (a.avgViews ?? -1) || b.count - a.count);
}

export function topSpots(spots: Spot[], n = 5): Spot[] {
  return spots.filter(s => s.views !== null).sort((a, b) => b.views! - a.views!).slice(0, n);
}

export interface CompetitorSummary { count: number; lastDate: string | null; bestViews: number | null }

export function summarize(c: Competitor, spots: Spot[]): CompetitorSummary {
  const own = spots.filter(s => s.competitorId === c.id);
  const views = own.map(s => s.views).filter((v): v is number => v !== null);
  return {
    count: own.length,
    lastDate: own.reduce<string | null>((d, s) => (!d || s.date > d ? s.date : d), null),
    bestViews: views.length ? Math.max(...views) : null,
  };
}

/** Link that opens the concept generator prefilled from a spotted video. */
export function conceptLink(s: Pick<Spot, 'title' | 'hook' | 'formatId'>) {
  const q = new URLSearchParams({ tendance: s.title.slice(0, 200), format: s.formatId });
  return `/concepts?${q}`;
}
