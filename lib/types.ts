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
