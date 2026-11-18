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
