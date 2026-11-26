import { describe, expect, it } from 'vitest';
import { bestHours, growth, parseCsv, parseTikTokCsv, share, tiktokDate } from '../tiktok';

const BOM = '﻿';

describe('parseCsv', () => {
  it('handles quotes, BOM and CRLF', () => {
    expect(parseCsv(`${BOM}"a","b, c"\r\n"1","x""y"\r\n`)).toEqual([['a', 'b, c'], ['1', 'x"y']]);
  });
});

describe('tiktokDate', () => {
  it('adds the year of today', () => expect(tiktokDate('November 19', '2026-11-26')).toBe('2026-11-19'));
  it('goes back a year for a day after today', () => expect(tiktokDate('December 30', '2027-01-03')).toBe('2026-12-30'));
  it('reads French months and ISO dates', () => {
    expect(tiktokDate('19 novembre', '2026-11-26')).toBe('2026-11-19');
    expect(tiktokDate('2026-11-19', '2026-11-26')).toBe('2026-11-19');
  });
  it('rejects junk', () => expect(tiktokDate('hier', '2026-11-26')).toBeNull());
});

describe('share', () => {
  it('reads fractions and percents', () => {
    expect(share('0.891')).toBe(0.891);
    expect(share('89,1 %')).toBeCloseTo(0.891);
  });
});

describe('parseTikTokCsv', () => {
  const today = '2026-11-26';
  it('reads FollowerHistory', () => {
    const f = parseTikTokCsv(`${BOM}"Date","Followers","Difference in followers from previous day"\n"November 19","4384","3384"\n"November 20","5809","1425"`, today);
    expect(f).toEqual({ kind: 'history', points: [{ date: '2026-11-19', followers: 4384 }, { date: '2026-11-20', followers: 5809 }] });
  });
  it('averages FollowerActivity per hour', () => {
    const rows = ['"Date","Hour","Active followers"', '"November 19","17","600"', '"November 20","17","800"', '"November 19","3","10"'];
    const f = parseTikTokCsv(rows.join('\n'), today);
    expect(f?.kind).toBe('activity');
    if (f?.kind !== 'activity') return;
    expect(f.hours[17]).toBe(700);
    expect(f.hours[3]).toBe(10);
    expect(f.days).toBe(2);
  });
  it('reads FollowerGender', () => {
    const f = parseTikTokCsv('"Gender","Distribution"\n"Male","0.69"\n"Female","0.31"\n"Other","0"', today);
    expect(f).toEqual({ kind: 'gender', gender: { male: 0.69, female: 0.31, other: 0 } });
  });
  it('reads FollowerTopTerritories and folds Others last', () => {
    const f = parseTikTokCsv('"Top territories","Distribution"\n"CA","0.891"\n"Others","0.088"\n"US","0.014"', today);
    expect(f).toEqual({ kind: 'territories', territories: [{ cc: 'CA', share: 0.891 }, { cc: 'US', share: 0.014 }, { cc: 'other', share: 0.088 }] });
  });
  it('ignores other files', () => expect(parseTikTokCsv('"Video","Views"\n"a","1"', today)).toBeNull());
});

describe('bestHours', () => {
  it('finds the peak and the best 4-hour run', () => {
    const h = [1276, 706, 404, 265, 210, 364, 1338, 2733, 2489, 1780, 1848, 2069, 2516, 1996, 1994, 2622, 3797, 3931, 3828, 3724, 3787, 3723, 3104, 2113];
    expect(bestHours(h)).toEqual({ peak: 17, from: 16, to: 20 });
  });
  it('wraps past midnight', () => {
    const h = Array(24).fill(1); h[23] = 50; h[0] = 50; h[1] = 50; h[22] = 40;
    expect(bestHours(h)).toEqual({ peak: 0, from: 22, to: 2 });
  });
  it('is null without data', () => expect(bestHours(Array(24).fill(0))).toBeNull());
});

describe('growth', () => {
  it('compares with the figure 7 days before the last one', () => {
    const pts = [['2026-11-19', 4384], ['2026-11-20', 5809], ['2026-11-25', 8941]].map(([date, followers]) => ({ date: date as string, followers: followers as number }));
    const g = growth(pts, 7)!;
    expect(g.base.date).toBe('2026-11-19');
    expect(g.gained).toBe(4557);
  });
});
