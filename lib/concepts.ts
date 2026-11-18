import { addDays } from './date';
import type { Character, NewConcept, Post } from './types';

/**
 * Pure logic of the concept generator: the format catalogue, the built-in
 * mixer used when no Claude API key is set, and the calendar slot finder.
 * No server-only imports so it can be unit-tested.
 */

export interface FormatDef {
  id: string;
  label: string;
  hint: string;
}

export const FORMATS: FormatDef[] = [
  { id: 'pov', label: 'POV', hint: 'Face caméra, le spectateur est dans la scène.' },
  { id: 'sketch', label: 'Sketch', hint: 'Une courte scène jouée qui finit sur une chute.' },
  { id: 'storytime', label: 'Story time', hint: 'Le personnage raconte une anecdote qui dérape.' },
  { id: 'reponse', label: 'Réponse à un commentaire', hint: 'Le personnage répond à un vrai ou faux commentaire.' },
  { id: 'tuto', label: 'Faux tuto', hint: 'Il explique comment faire quelque chose… à sa façon.' },
  { id: 'serie', label: 'Épisode de série', hint: 'Partie 1, 2, 3… avec un cliffhanger pour revenir.' },
  { id: 'reaction', label: 'Réaction', hint: 'Il réagit à la tendance comme s’il la découvrait.' },
];

export const formatById = (id: string) => FORMATS.find(f => f.id === id);

export interface MixInput {
  characters: Character[];
  trend: string;
  format: FormatDef;
  twist: string;
  count: number;
}

/** Small deterministic PRNG so the same seed gives the same ideas (and tests are stable). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

const pick = <T,>(list: T[], r: () => number) => list[Math.floor(r() * list.length)];

export function namesOf(characters: Character[]) {
  const n = characters.map(c => c.name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} et ${n.at(-1)}` : n[0] ?? '';
}

/** First non-empty line of the character's catchphrases, if any. */
function catchphrase(c: Character | undefined) {
  return c?.catchphrases.split('\n').map(s => s.trim()).find(Boolean) ?? '';
}

export function slugTag(s: string) {
  return '#' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

/** Angles as [singular, plural] so a crossover reads correctly. */
const ANGLES: [string, string][] = [
  ['prend la tendance au pied de la lettre', 'prennent la tendance au pied de la lettre'],
  ['fait la tendance avec 10 ans de retard', 'font la tendance avec 10 ans de retard'],
  ['refuse de faire la tendance, puis craque', 'refusent de faire la tendance, puis craquent'],
  ['transforme la tendance en drame absolu', 'transforment la tendance en drame absolu'],
  ['essaie d’expliquer la tendance à quelqu’un qui s’en fiche', 'essaient d’expliquer la tendance à quelqu’un qui s’en fiche'],
  ['rate la tendance de la pire façon possible', 'ratent la tendance de la pire façon possible'],
];

const HOOKS: Record<string, string[]> = {
  pov: ['POV : {who} vient de découvrir {q}', 'POV : tu demandes à {who} de faire {q}'],
  sketch: ['{who} contre {q} : ça ne pouvait pas bien finir', 'Quand {who} {angle}…'],
  storytime: ['Laissez-moi vous raconter la fois où j’ai fait {q}', 'Story time : {q} m’a coûté très cher'],
  reponse: ['« Fais {trend} » qu’ils disaient…', 'Réponse à @quelquun : non, je ne ferai pas {q}'],
  tuto: ['Comment réussir {q} (méthode {who})', 'Tuto : {q} en 3 étapes, selon {who}'],
  serie: ['Partie 1 : {who} et l’affaire {q}', '{who} contre {q}, épisode 1'],
  reaction: ['{who} découvre {q} pour la première fois', 'Je viens de voir {q} et j’ai des questions'],
};

const ENDINGS = [
  'Chute : tout part en vrille au moment où ça semblait marcher.',
  'Chute : retournement, c’est l’autre qui avait raison depuis le début.',
  'Chute : regard caméra, silence, coupe.',
  'Chute : il recommence, encore pire.',
];

function fill(t: string, v: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
}

/**
 * Built-in mixer: combines character, trend, format and twist into ready-to-shoot
 * ideas without any external service. Claude writes better ones when a key is set.
 */
export function mixConcepts(input: MixInput, seed = Date.now()): NewConcept[] {
  const r = rng(seed);
  const who = namesOf(input.characters);
  const trend = input.trend.trim();
  const [lead, partner] = input.characters;
  const angles = [...ANGLES].sort(() => r() - 0.5);
  const hooks = HOOKS[input.format.id] ?? HOOKS.sketch;

  return Array.from({ length: input.count }, (_, i) => {
    const [one, many] = angles[i % angles.length];
    const angle = input.characters.length > 1 ? many : one;
    const v = { who, trend, angle, q: /[«"“]/.test(trend) ? trend : `« ${trend} »` };
    const hook = fill(hooks[i % hooks.length], v);
    const line = catchphrase(i % 2 && partner ? partner : lead);
    const beats = [
      `Accroche (0-2 s) : ${hook}`,
      `Mise en place : ${lead?.name ?? who} ${one}${lead?.tone ? ` (ton : ${lead.tone.split('\n')[0]})` : ''}.`,
      partner
        ? `Escalade : ${partner.name} s’en mêle et empire tout.`
        : `Escalade : ${input.format.hint.charAt(0).toLowerCase()}${input.format.hint.slice(1)}`,
      ...(input.twist.trim() ? [`Contrainte : ${input.twist.trim()}.`] : []),
      ...(line ? [`Réplique culte : « ${line} »`] : []),
      pick(ENDINGS, r),
    ];
    const title = `${who} ${angle}`.slice(0, 120);
    const tags = [slugTag(trend), ...input.characters.map(c => slugTag(c.name)), '#humour', '#fyp'].filter(t => t.length > 1);
    return {
      characterIds: input.characters.map(c => c.id),
      trend,
      formatId: input.format.id,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      hook,
      beats,
      caption: `${hook} 😅`,
      hashtags: [...new Set(tags)],
      source: 'local' as const,
    };
  });
}

/** Default publishing hours, in order of preference (Toronto time). */
export const SLOT_TIMES = ['18:00', '12:00', '09:00'];

/**
 * Next free calendar slot starting tomorrow: the first day with fewer than
 * `perDay` posts (failed ones don't count), at the first default hour not taken.
 */
export function nextFreeSlot(posts: Pick<Post, 'date' | 'time' | 'status'>[], today: string, perDay: number, horizon = 120) {
  const per = Math.min(Math.max(1, Math.round(perDay)), SLOT_TIMES.length);
  for (let i = 1; i <= horizon; i++) {
    const date = addDays(today, i);
    const taken = posts.filter(p => p.date === date && p.status !== 'failed');
    if (taken.length >= per) continue;
    const time = SLOT_TIMES.slice(0, per).find(t => !taken.some(p => p.time === t)) ?? SLOT_TIMES[0];
    return { date, time };
  }
  return { date: addDays(today, 1), time: SLOT_TIMES[0] };
}

/** Caption sent to the calendar: the caption plus the hashtags. */
export function postCaption(c: Pick<NewConcept, 'caption' | 'hashtags'>) {
  return [c.caption.trim(), c.hashtags.join(' ')].filter(Boolean).join('\n\n');
}

/** Rhythm steps: 1 post a day, then 2, then 3. */
export const RAMP_STEPS = [1, 2, 3];

/** Posts per day over the last 7 days (drafts excluded) and the ramp step reached. */
export function rampStep(posts: Pick<Post, 'date' | 'status'>[], today: string) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const perDay = posts.filter(p => week.includes(p.date) && p.status !== 'draft').length / 7;
  const step = RAMP_STEPS.reduce((acc, s) => (perDay >= s ? s : acc), 1);
  return { perDay, step };
}
