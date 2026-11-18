import type { Character } from './types';

export function seedCharacters(now: string): Character[] {
  return [
    {
      id: 'tarbanouche', slug: 'st-tarbanouche', name: 'St Tarbanouche', color: '#f2a65a',
      universe: '', tone: '', catchphrases: '', voiceId: '', voiceNotes: '', assets: [], updatedAt: now,
    },
    {
      id: 'kevun', slug: 'kevun', name: 'Kevun', color: '#5EEAD4',
      universe: '', tone: '', catchphrases: '', voiceId: '', voiceNotes: '', assets: [], updatedAt: now,
    },
  ];
}
