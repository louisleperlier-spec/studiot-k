export const NETWORKS = ['tiktok', 'instagram', 'facebook', 'youtube'] as const;
export type Network = (typeof NETWORKS)[number];
export const NETWORK_LABEL: Record<Network, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
};
export const NETWORK_SHORT: Record<Network, string> = { tiktok: 'TT', instagram: 'IG', facebook: 'FB', youtube: 'YT' };

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  published: 'Publié',
  failed: 'Échec',
};

export interface Asset {
  id: string;
  url: string;
  name: string;
  kind: 'image' | 'video' | 'audio';
  createdAt: string;
}

export interface Character {
  id: string;
  slug: string;
  name: string;
  color: string;
  universe: string;
  tone: string;
  catchphrases: string;
  voiceId: string;
  voiceNotes: string;
  assets: Asset[];
  updatedAt: string;
}

export interface Post {
  id: string;
  characterId: string;
  title: string;
  caption: string;
  /** Local date in the studio time zone, YYYY-MM-DD. */
  date: string;
  /** HH:MM, studio time zone. */
  time: string;
  networks: Network[];
  status: PostStatus;
  mediaUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type NewPost = Omit<Post, 'id' | 'createdAt' | 'updatedAt'>;
export type CharacterPatch = Partial<Omit<Character, 'id' | 'slug' | 'assets' | 'updatedAt'>>;

/* ---------- Générateur de concepts ---------- */

export type ConceptStatus = 'idea' | 'kept' | 'scheduled';
export const CONCEPT_STATUS_LABEL: Record<ConceptStatus, string> = {
  idea: 'Idée',
  kept: 'Gardé',
  scheduled: 'Au calendrier',
};

export interface Concept {
  id: string;
  /** One character, or both for a crossover. */
  characterIds: string[];
  trend: string;
  formatId: string;
  title: string;
  hook: string;
  beats: string[];
  caption: string;
  hashtags: string[];
  status: ConceptStatus;
  /** Calendar post created from this concept, if any. */
  postId: string;
  /** 'claude' when written by the Claude API, 'local' for the built-in mixer. */
  source: 'claude' | 'local';
  createdAt: string;
}

export type NewConcept = Omit<Concept, 'id' | 'createdAt' | 'status' | 'postId'>;

export interface Trend {
  id: string;
  label: string;
  createdAt: string;
}

/* ---------- Stats : abonnés, audience, revenus ---------- */

/** Where a figure came from: a TikTok CSV export, typed by hand, or pushed by the Process sync. */
export type StatSource = 'csv' | 'manuel' | 'process';
export const STAT_SOURCE_LABEL: Record<StatSource, string> = { csv: 'CSV TikTok', manuel: 'Saisie manuelle', process: 'Process' };

export interface FollowerPoint {
  characterId: string;
  /** YYYY-MM-DD. One figure per character and day. */
  date: string;
  followers: number;
  source: StatSource;
}

export interface Gender { male: number; female: number; other: number }
export interface Territory { cc: string; share: number }

export interface Audience {
  characterId: string;
  /** Shares between 0 and 1. */
  gender: Gender | null;
  /** Top countries by share (0-1), largest first. cc "other" groups the rest. */
  territories: Territory[];
  /** 24 values: average active followers per hour of the day, as in the TikTok export. */
  hours: number[];
  /** Days the hourly averages were computed from. */
  hoursDays: number;
  source: StatSource;
  updatedAt: string;
}
export type AudiencePatch = Partial<Pick<Audience, 'gender' | 'territories' | 'hours' | 'hoursDays'>> & { source: StatSource };

export const REVENUE_SOURCES = [
  { id: 'tiktok-cadeaux', label: 'Cadeaux TikTok' },
  { id: 'tiktok-createurs', label: 'Programme créateurs TikTok' },
  { id: 'whop', label: 'Whop' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'partenariat', label: 'Partenariat' },
  { id: 'autre', label: 'Autre' },
] as const;
export const CURRENCIES = ['CAD', 'USD', 'EUR'] as const;

export interface Revenue {
  id: string;
  date: string;
  amount: number;
  /** ISO 4217, e.g. USD. */
  currency: string;
  /** One of REVENUE_SOURCES ids, or free text from the sync. */
  source: string;
  /** '' when it belongs to no character in particular. */
  characterId: string;
  note: string;
  /** External id from the sync, so a daily push never counts a sale twice. '' for manual entries. */
  ref: string;
  createdAt: string;
}
export type NewRevenue = Omit<Revenue, 'id' | 'createdAt'>;
