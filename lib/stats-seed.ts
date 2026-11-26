import type { AudiencePatch, FollowerPoint, NewRevenue } from './types';

/**
 * Chiffres de départ du compte Saint Tabarnouche : export TikTok du 19 au 25 nov. 2026
 * et cadeaux déclarés par Louis le 26 nov. 2026. Chargés une seule fois, sur demande, depuis la page Stats.
 */
const ID = 'tarbanouche';

export const STARTER_FOLLOWERS: FollowerPoint[] = (
  [['2026-11-19', 4384], ['2026-11-20', 5809], ['2026-11-21', 6279], ['2026-11-22', 6987],
   ['2026-11-23', 7384], ['2026-11-24', 7585], ['2026-11-25', 8941]] as const
).map(([date, followers]) => ({ characterId: ID, date, followers, source: 'csv' }));

export const STARTER_AUDIENCE: AudiencePatch = {
  source: 'csv',
  gender: { male: 0.69, female: 0.31, other: 0 },
  territories: [
    { cc: 'CA', share: 0.891 }, { cc: 'US', share: 0.014 }, { cc: 'BR', share: 0.002 }, { cc: 'DZ', share: 0.001 },
    { cc: 'FR', share: 0.001 }, { cc: 'MA', share: 0.001 }, { cc: 'MX', share: 0.001 }, { cc: 'PF', share: 0.001 },
    { cc: 'other', share: 0.088 },
  ],
  // Moyenne des abonnés actifs par heure, 19-25 nov. (FollowerActivity.csv).
  hours: [1276, 706, 404, 265, 210, 364, 1338, 2733, 2489, 1780, 1848, 2069, 2516, 1996, 1994, 2622, 3797, 3931, 3828, 3724, 3787, 3723, 3104, 2113],
  hoursDays: 7,
};

export const STARTER_CHARACTER = ID;

export const STARTER_REVENUES: NewRevenue[] = [
  { date: '2026-11-26', amount: 97, currency: 'USD', source: 'tiktok-cadeaux', characterId: ID, note: 'Cadeaux TikTok cumulés (déclaré le 26 nov.)', ref: 'depart:tiktok-cadeaux:2026-11-26' },
];
