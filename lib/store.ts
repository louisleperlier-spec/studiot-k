import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedCharacters } from './seed';
import type { Asset, Character, CharacterPatch, NewPost, Post } from './types';

/**
 * Data layer. Uses Postgres when DATABASE_URL is set (production on Vercel),
 * otherwise a JSON file in .data/ so the app runs locally with no setup.
 */
export interface Store {
  listCharacters(): Promise<Character[]>;
  getCharacterBySlug(slug: string): Promise<Character | null>;
  updateCharacter(id: string, patch: CharacterPatch): Promise<void>;
  addAsset(characterId: string, asset: Omit<Asset, 'id' | 'createdAt'>): Promise<void>;
  removeAsset(characterId: string, assetId: string): Promise<void>;
  listPosts(range?: { from: string; to: string }): Promise<Post[]>;
  createPost(p: NewPost): Promise<Post>;
  updatePost(id: string, patch: Partial<NewPost>): Promise<void>;
  deletePost(id: string): Promise<void>;
}

const now = () => new Date().toISOString();
const byDateTime = (a: Post, b: Post) => (a.date + a.time).localeCompare(b.date + b.time);

/* ---------------- JSON file (dev) ---------------- */

interface Db { characters: Character[]; posts: Post[] }

class FileStore implements Store {
  private file = path.join(process.cwd(), '.data', 'db.json');
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Db> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8')) as Db;
    } catch {
      const db: Db = { characters: seedCharacters(now()), posts: [] };
      await this.write(db);
      return db;
    }
  }
  private async write(db: Db) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(db, null, 2));
  }
  /** Serialises read-modify-write so two quick saves don't overwrite each other. */
  private mutate<T>(fn: (db: Db) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const out = fn(db);
      await this.write(db);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listCharacters() { return (await this.read()).characters; }
  async getCharacterBySlug(slug: string) { return (await this.read()).characters.find(c => c.slug === slug) ?? null; }
  async updateCharacter(id: string, patch: CharacterPatch) {
    await this.mutate(db => { const c = db.characters.find(x => x.id === id); if (c) Object.assign(c, patch, { updatedAt: now() }); });
  }
  async addAsset(characterId: string, asset: Omit<Asset, 'id' | 'createdAt'>) {
    await this.mutate(db => { db.characters.find(x => x.id === characterId)?.assets.push({ ...asset, id: randomUUID(), createdAt: now() }); });
  }
  async removeAsset(characterId: string, assetId: string) {
    await this.mutate(db => { const c = db.characters.find(x => x.id === characterId); if (c) c.assets = c.assets.filter(a => a.id !== assetId); });
  }
  async listPosts(range?: { from: string; to: string }) {
    const posts = (await this.read()).posts.filter(p => !range || (p.date >= range.from && p.date <= range.to));
    return posts.sort(byDateTime);
  }
  async createPost(p: NewPost) {
    return this.mutate(db => { const post: Post = { ...p, id: randomUUID(), createdAt: now(), updatedAt: now() }; db.posts.push(post); return post; });
  }
  async updatePost(id: string, patch: Partial<NewPost>) {
    await this.mutate(db => { const p = db.posts.find(x => x.id === id); if (p) Object.assign(p, patch, { updatedAt: now() }); });
  }
  async deletePost(id: string) {
    await this.mutate(db => { db.posts = db.posts.filter(p => p.id !== id); });
  }
}

/* ---------------- Postgres (prod) ---------------- */

type Sql = ReturnType<typeof postgres>;

class PgStore implements Store {
  private ready: Promise<void> | null = null;
  constructor(private sql: Sql) {}

  private init() {
    this.ready ??= (async () => {
      const sql = this.sql;
      await sql`create table if not exists characters (
        id text primary key, slug text unique not null, name text not null, color text not null,
        universe text not null default '', tone text not null default '', catchphrases text not null default '',
        voice_id text not null default '', voice_notes text not null default '',
        assets jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now())`;
      await sql`create table if not exists posts (
        id uuid primary key, character_id text not null references characters(id),
        title text not null, caption text not null default '', date date not null, time text not null,
        networks text[] not null default '{}', status text not null, media_url text not null default '',
        created_at timestamptz not null default now(), updated_at timestamptz not null default now())`;
      await sql`create index if not exists posts_date_idx on posts(date)`;
      for (const c of seedCharacters(now())) {
        await sql`insert into characters (id, slug, name, color) values (${c.id}, ${c.slug}, ${c.name}, ${c.color}) on conflict (id) do nothing`;
      }
    })();
    return this.ready;
  }

  private toCharacter = (r: Record<string, unknown>): Character => ({
    id: r.id as string, slug: r.slug as string, name: r.name as string, color: r.color as string,
    universe: r.universe as string, tone: r.tone as string, catchphrases: r.catchphrases as string,
    voiceId: r.voice_id as string, voiceNotes: r.voice_notes as string,
    assets: (r.assets as Asset[]) ?? [], updatedAt: new Date(r.updated_at as string).toISOString(),
  });
  private toPost = (r: Record<string, unknown>): Post => ({
    id: r.id as string, characterId: r.character_id as string, title: r.title as string, caption: r.caption as string,
    date: r.date as string, time: r.time as string, networks: r.networks as Post['networks'], status: r.status as Post['status'],
    mediaUrl: r.media_url as string,
    createdAt: new Date(r.created_at as string).toISOString(), updatedAt: new Date(r.updated_at as string).toISOString(),
  });

  async listCharacters() {
    await this.init();
    return (await this.sql`select * from characters order by name`).map(this.toCharacter);
  }
  async getCharacterBySlug(slug: string) {
    await this.init();
    const [r] = await this.sql`select * from characters where slug = ${slug}`;
    return r ? this.toCharacter(r) : null;
  }
  async updateCharacter(id: string, p: CharacterPatch) {
    await this.init();
    const cols: Record<string, string> = {};
    if (p.name !== undefined) cols.name = p.name;
    if (p.color !== undefined) cols.color = p.color;
    if (p.universe !== undefined) cols.universe = p.universe;
    if (p.tone !== undefined) cols.tone = p.tone;
    if (p.catchphrases !== undefined) cols.catchphrases = p.catchphrases;
    if (p.voiceId !== undefined) cols.voice_id = p.voiceId;
    if (p.voiceNotes !== undefined) cols.voice_notes = p.voiceNotes;
    if (!Object.keys(cols).length) return;
    await this.sql`update characters set ${this.sql(cols)}, updated_at = now() where id = ${id}`;
  }
  async addAsset(characterId: string, asset: Omit<Asset, 'id' | 'createdAt'>) {
    await this.init();
    const full: Asset = { ...asset, id: randomUUID(), createdAt: now() };
    await this.sql`update characters set assets = assets || ${this.sql.json([full] as never)}::jsonb, updated_at = now() where id = ${characterId}`;
  }
  async removeAsset(characterId: string, assetId: string) {
    await this.init();
    await this.sql`update characters set assets = coalesce((select jsonb_agg(a) from jsonb_array_elements(assets) a where a->>'id' <> ${assetId}), '[]'::jsonb), updated_at = now() where id = ${characterId}`;
  }
  async listPosts(range?: { from: string; to: string }) {
    await this.init();
    const rows = range
      ? await this.sql`select *, to_char(date, 'YYYY-MM-DD') as date from posts where date between ${range.from} and ${range.to} order by date, time`
      : await this.sql`select *, to_char(date, 'YYYY-MM-DD') as date from posts order by date, time`;
    return rows.map(this.toPost);
  }
  async createPost(p: NewPost) {
    await this.init();
    const [r] = await this.sql`insert into posts (id, character_id, title, caption, date, time, networks, status, media_url)
      values (${randomUUID()}, ${p.characterId}, ${p.title}, ${p.caption}, ${p.date}, ${p.time}, ${p.networks}, ${p.status}, ${p.mediaUrl})
      returning *, to_char(date, 'YYYY-MM-DD') as date`;
    return this.toPost(r);
  }
  async updatePost(id: string, p: Partial<NewPost>) {
    await this.init();
    const cols: Record<string, unknown> = {};
    if (p.characterId !== undefined) cols.character_id = p.characterId;
    if (p.title !== undefined) cols.title = p.title;
    if (p.caption !== undefined) cols.caption = p.caption;
    if (p.date !== undefined) cols.date = p.date;
    if (p.time !== undefined) cols.time = p.time;
    if (p.networks !== undefined) cols.networks = p.networks;
    if (p.status !== undefined) cols.status = p.status;
    if (p.mediaUrl !== undefined) cols.media_url = p.mediaUrl;
    if (!Object.keys(cols).length) return;
    await this.sql`update posts set ${this.sql(cols as Record<string, string>)}, updated_at = now() where id = ${id}`;
  }
  async deletePost(id: string) {
    await this.init();
    await this.sql`delete from posts where id = ${id}`;
  }
}

const g = globalThis as unknown as { __studioStore?: Store };

export function store(): Store {
  if (!g.__studioStore) {
    const url = process.env.DATABASE_URL;
    g.__studioStore = url ? new PgStore(postgres(url, { ssl: 'require', max: 3, prepare: false })) : new FileStore();
  }
  return g.__studioStore;
}
