import type { Gender, Territory } from './types';

/**
 * Lecture des exports CSV de TikTok Studio (Analyses → Abonnés → Exporter) :
 * FollowerHistory, FollowerActivity, FollowerGender, FollowerTopTerritories.
 * Pure functions, no I/O, so they are easy to test.
 */

export type TikTokFile =
  | { kind: 'history'; points: { date: string; followers: number }[] }
  | { kind: 'activity'; hours: number[]; days: number }
  | { kind: 'gender'; gender: Gender }
  | { kind: 'territories'; territories: Territory[] };

/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * TikTok writes "November 19" with no year. We pick the most recent such day
 * that is not after `today` (YYYY-MM-DD). ISO dates pass through.
 */
export function tiktokDate(label: string, today: string): string | null {
  const iso = label.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const t = fold(label).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  let month = 0, day = 0, year = 0;
  for (const w of t) {
    if (MONTHS[w]) month = MONTHS[w];
    else if (/^\d{4}$/.test(w)) year = Number(w);
    else if (/^\d{1,2}$/.test(w)) day = Number(w);
  }
  if (!month || !day || day > 31) return null;
  if (year) return `${year}-${pad(month)}-${pad(day)}`;
  const y = Number(today.slice(0, 4));
  const guess = `${y}-${pad(month)}-${pad(day)}`;
  return guess > today ? `${y - 1}-${pad(month)}-${pad(day)}` : guess;
}

/** "0.891", "89.1%", "89,1 %" → 0.891 */
export function share(v: string): number {
  const pct = v.includes('%');
  const n = Number(v.replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return pct || n > 1 ? n / 100 : n;
}
const int = (v: string) => {
  const n = Number(v.replace(/[\s ,]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/** Recognises a TikTok export from its header row. Returns null for anything else. */
export function parseTikTokCsv(text: string, today: string): TikTokFile | null {
  const [head, ...rows] = parseCsv(text);
  if (!head) return null;
  const h = head.map(fold);
  const col = (re: RegExp) => h.findIndex(x => re.test(x));

  if (col(/^followers$|^abonnes$/) >= 0 && col(/^date$/) >= 0) {
    const d = col(/^date$/), f = col(/^followers$|^abonnes$/);
    const points = rows
      .map(r => ({ date: tiktokDate(r[d] ?? '', today), followers: int(r[f] ?? '') }))
      .filter((p): p is { date: string; followers: number } => !!p.date && Number.isFinite(p.followers) && p.followers >= 0);
    return { kind: 'history', points };
  }
  if (col(/^hour$|^heure$/) >= 0) {
    const d = col(/^date$/), hr = col(/^hour$|^heure$/), v = col(/active|actifs/);
    if (v < 0) return null;
    const sum = Array(24).fill(0), n = Array(24).fill(0), days = new Set<string>();
    for (const r of rows) {
      const hour = int(r[hr] ?? ''), val = int(r[v] ?? '');
      if (!(hour >= 0 && hour < 24) || !Number.isFinite(val)) continue;
      sum[hour] += val; n[hour]++;
      if (d >= 0) days.add(r[d]);
    }
    return { kind: 'activity', hours: sum.map((s, i) => (n[i] ? Math.round(s / n[i]) : 0)), days: days.size || Math.max(...n) };
  }
  if (col(/^gender$|^genre$|^sexe$/) >= 0) {
    const g = col(/^gender$|^genre$|^sexe$/), v = col(/distribution|share|part/);
    const gender: Gender = { male: 0, female: 0, other: 0 };
    for (const r of rows) {
      const k = fold(r[g] ?? ''), val = share(r[v] ?? '');
      if (/^(male|homme|hommes)$/.test(k)) gender.male = val;
      else if (/^(female|femme|femmes)$/.test(k)) gender.female = val;
      else gender.other += val;
    }
    return { kind: 'gender', gender };
  }
  if (col(/territor|pays|countr/) >= 0) {
    const c = col(/territor|pays|countr/), v = col(/distribution|share|part/);
    const territories = rows
      .map(r => {
        const raw = (r[c] ?? '').trim();
        return { cc: /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : 'other', share: share(r[v] ?? '') };
      })
      .filter(t => t.share > 0);
    // Merge every non-country row ("Others", unknown codes) into a single "other".
    const other = territories.filter(t => t.cc === 'other').reduce((a, t) => a + t.share, 0);
    const list = territories.filter(t => t.cc !== 'other').sort((a, b) => b.share - a.share);
    if (other > 0) list.push({ cc: 'other', share: Math.round(other * 1000) / 1000 });
    return { kind: 'territories', territories: list };
  }
  return null;
}

/** Hours with the most active followers: the peak hour and the best run of 4 consecutive hours. */
export function bestHours(hours: number[]): { peak: number; from: number; to: number } | null {
  if (hours.length !== 24 || !hours.some(v => v > 0)) return null;
  const peak = hours.indexOf(Math.max(...hours));
  let best = 0, from = 0;
  for (let i = 0; i < 24; i++) {
    const s = hours[i] + hours[(i + 1) % 24] + hours[(i + 2) % 24] + hours[(i + 3) % 24];
    if (s > best) { best = s; from = i; }
  }
  return { peak, from, to: (from + 4) % 24 };
}

/** Growth over the last `days` days of a date-sorted series. */
export function growth(points: { date: string; followers: number }[], days = 7) {
  if (!points.length) return null;
  const last = points.at(-1)!;
  const start = new Date(`${last.date}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  const from = start.toISOString().slice(0, 10);
  // The figure on or just before the start day; else the oldest one we have.
  const base = [...points].reverse().find(p => p.date <= from) ?? points[0];
  const gained = last.followers - base.followers;
  return { last, base, gained, pct: base.followers ? gained / base.followers : 0 };
}
