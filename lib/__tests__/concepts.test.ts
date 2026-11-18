import { describe, expect, it } from 'vitest';
import { FORMATS, mixConcepts, nextFreeSlot, postCaption, rampStep, rng, slugTag } from '../concepts';
import type { Character, Post } from '../types';

const char = (id: string, name: string, extra: Partial<Character> = {}): Character => ({
  id, slug: id, name, color: '#fff', universe: '', tone: '', catchphrases: '', voiceId: '', voiceNotes: '', assets: [], updatedAt: '', ...extra,
});
const tarba = char('tarbanouche', 'St Tarbanouche', { tone: 'solennel et dépassé', catchphrases: '\nPar tous les saints !\nAutre' });
const kevun = char('kevun', 'Kevun');
const post = (date: string, time = '18:00', status: Post['status'] = 'scheduled') => ({ date, time, status });

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = rng(42), b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('mixConcepts', () => {
  const base = { characters: [tarba], trend: 'Le son du jumeau', format: FORMATS[0], twist: '', count: 3 };

  it('returns the requested number of concepts, all different', () => {
    const out = mixConcepts(base, 7);
    expect(out).toHaveLength(3);
    expect(new Set(out.map(c => c.title)).size).toBe(3);
  });

  it('keeps the inputs on each concept', () => {
    for (const c of mixConcepts(base, 7)) {
      expect(c.characterIds).toEqual(['tarbanouche']);
      expect(c.trend).toBe('Le son du jumeau');
      expect(c.formatId).toBe('pov');
      expect(c.source).toBe('local');
      expect(c.hook).toContain('Le son du jumeau');
    }
  });

  it('uses the character catchphrase and tone', () => {
    const [c] = mixConcepts(base, 7);
    expect(c.beats.join(' ')).toContain('Par tous les saints !');
    expect(c.beats.join(' ')).toContain('solennel et dépassé');
  });

  it('writes a crossover with both names and the twist', () => {
    const [c] = mixConcepts({ ...base, characters: [tarba, kevun], twist: 'sans un mot', count: 1 }, 3);
    expect(c.characterIds).toEqual(['tarbanouche', 'kevun']);
    expect(c.title).toMatch(/^St Tarbanouche et Kevun \S+nt /);
    expect(c.beats.some(b => b.includes('Kevun s’en mêle'))).toBe(true);
    expect(c.beats).toContain('Contrainte : sans un mot.');
    expect(c.hashtags).toEqual(expect.arrayContaining(['#sttarbanouche', '#kevun']));
  });

  it('does not double the quotes when the trend is already quoted', () => {
    const out = mixConcepts({ ...base, trend: 'Le son « jumeau »', format: FORMATS[1] }, 2);
    for (const c of out) expect(c.hook).not.toMatch(/« Le son « jumeau » »/);
  });

  it('has a hook template for every format', () => {
    for (const format of FORMATS) {
      const [c] = mixConcepts({ ...base, format, count: 1 }, 1);
      expect(c.hook).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('slugTag', () => {
  it('strips accents, spaces and punctuation', () => {
    expect(slugTag('Ça, c’est fou !')).toBe('#cacestfou');
  });
});

describe('nextFreeSlot', () => {
  const today = '2026-11-18';

  it('starts tomorrow at 18:00 when the calendar is empty', () => {
    expect(nextFreeSlot([], today, 1)).toEqual({ date: '2026-11-19', time: '18:00' });
  });

  it('skips full days at 1 post a day', () => {
    expect(nextFreeSlot([post('2026-11-19'), post('2026-11-20')], today, 1)).toEqual({ date: '2026-11-21', time: '18:00' });
  });

  it('fills the second slot of the day at 2 posts a day', () => {
    expect(nextFreeSlot([post('2026-11-19')], today, 2)).toEqual({ date: '2026-11-19', time: '12:00' });
  });

  it('ignores failed posts and today', () => {
    expect(nextFreeSlot([post('2026-11-19', '18:00', 'failed'), post(today)], today, 1)).toEqual({ date: '2026-11-19', time: '18:00' });
  });

  it('crosses month ends', () => {
    expect(nextFreeSlot([post('2026-12-01')], '2026-11-30', 1)).toEqual({ date: '2026-12-02', time: '18:00' });
  });
});

describe('rampStep', () => {
  it('stays at step 1 with few posts', () => {
    expect(rampStep([post('2026-11-18')], '2026-11-18').step).toBe(1);
  });

  it('reaches step 2 with 14 published posts in the last 7 days, drafts excluded', () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-11-1${2 + i}`);
    const posts = days.flatMap(d => [post(d, '12:00', 'published'), post(d, '18:00', 'published'), post(d, '09:00', 'draft')]);
    expect(rampStep(posts, '2026-11-18')).toEqual({ perDay: 2, step: 2 });
  });
});

describe('postCaption', () => {
  it('joins caption and hashtags', () => {
    expect(postCaption({ caption: 'Salut', hashtags: ['#a', '#b'] })).toBe('Salut\n\n#a #b');
  });
});
