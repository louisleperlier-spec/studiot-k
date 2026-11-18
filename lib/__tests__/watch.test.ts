import { describe, expect, it } from 'vitest';
import { conceptLink, formatStats, formatViews, fromUrl, parseViews, safeUrl, summarize, topSpots } from '../watch';
import type { Competitor, Spot } from '../types';

const spot = (p: Partial<Spot>): Spot => ({
  id: Math.random().toString(36), competitorId: 'a', title: 't', url: '', formatId: 'pov', views: null, hook: '', note: '', date: '2026-11-10', createdAt: '', ...p,
});
const comp = (id: string): Competitor => ({ id, name: id, network: 'tiktok', handle: '', url: '', niche: '', notes: '', createdAt: '' });

describe('parseViews', () => {
  it.each([
    ['12000', 12000], ['12 000', 12000], ['850 000', 850000], ['12k', 12000], ['12,5K', 12500],
    ['1,2 M', 1200000], ['3.4m vues', 3400000], ['2 Md', 2e9], ['1.234.567', 1234567], ['45 views', 45],
  ])('%s → %d', (raw, n) => expect(parseViews(raw)).toBe(n));
  it.each(['', 'beaucoup', '12x'])('%s → null', raw => expect(parseViews(raw)).toBeNull());
});

describe('formatViews', () => {
  it('abbreviates in French', () => {
    expect(formatViews(null)).toBe('—');
    expect(formatViews(950)).toBe('950');
    expect(formatViews(1500)).toBe('1,5 k');
    expect(formatViews(45000)).toBe('45 k');
    expect(formatViews(1200000)).toBe('1,2 M');
    expect(formatViews(23000000)).toBe('23 M');
  });
});

describe('fromUrl', () => {
  it('reads TikTok, Instagram, YouTube and Facebook links', () => {
    expect(fromUrl('https://www.tiktok.com/@lemoine.ia/video/123')).toEqual({ network: 'tiktok', handle: '@lemoine.ia' });
    expect(fromUrl('https://instagram.com/lemoine.ia/')).toEqual({ network: 'instagram', handle: '@lemoine.ia' });
    expect(fromUrl('https://www.instagram.com/reel/abc')).toEqual({ network: 'instagram', handle: undefined });
    expect(fromUrl('https://youtube.com/@moine')).toEqual({ network: 'youtube', handle: '@moine' });
    expect(fromUrl('https://m.facebook.com/moinepage')).toEqual({ network: 'facebook', handle: '@moinepage' });
  });
  it('ignores other or invalid links', () => {
    expect(fromUrl('https://example.com/@x')).toEqual({});
    expect(fromUrl('pas un lien')).toEqual({});
  });
});

describe('safeUrl', () => {
  it('keeps only http(s) links', () => {
    expect(safeUrl('https://tiktok.com/@a')).toBe('https://tiktok.com/@a');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('')).toBe('');
  });
});

describe('stats', () => {
  const spots = [
    spot({ formatId: 'pov', views: 100000 }), spot({ formatId: 'pov', views: 300000 }), spot({ formatId: 'pov', views: null }),
    spot({ formatId: 'sketch', views: 1000000, competitorId: 'b', date: '2026-11-12' }), spot({ formatId: 'tuto', views: null }),
  ];
  it('ranks formats by average views, unknown views last', () => {
    expect(formatStats(spots).map(s => [s.formatId, s.count, s.avgViews])).toEqual([['sketch', 1, 1000000], ['pov', 3, 200000], ['tuto', 1, null]]);
  });
  it('lists the most viewed videos', () => {
    expect(topSpots(spots, 2).map(s => s.views)).toEqual([1000000, 300000]);
  });
  it('summarizes a competitor', () => {
    expect(summarize(comp('a'), spots)).toEqual({ count: 4, lastDate: '2026-11-10', bestViews: 300000 });
    expect(summarize(comp('z'), spots)).toEqual({ count: 0, lastDate: null, bestViews: null });
  });
});

describe('conceptLink', () => {
  it('prefills the generator', () => {
    expect(conceptLink({ title: 'Moine & Wi-Fi', hook: '', formatId: 'sketch' })).toBe('/concepts?tendance=Moine+%26+Wi-Fi&format=sketch');
  });
});
