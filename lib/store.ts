import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedCharacters } from './seed';
import type {
  Asset, Audience, AudiencePatch, Character, CharacterPatch, Concept, ConceptStatus, FollowerPoint, NewConcept, NewPost, NewRevenue, Post, Revenue, Trend,
} from './types';

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
  listConcepts(): Promise<Concept[]>;
  getConcept(id: string): Promise<Concept | null>;
  createConcepts(list: NewConcept[]): Promise<Concept[]>;
  updateConcept(id: string, patch: { status?: ConceptStatus; postId?: string }): Promise<void>;
  deleteConcept(id: string): Promise<void>;
  listTrends(): Promise<Trend[]>;
  addTrend(label: string): Promise<void>;
  removeTrend(id: string): Promise<void>;
  /** Follower counts, oldest first. */
  listFollowers(characterId?: string): Promise<FollowerPoint[]>;
  /** Inserts or replaces the figure for each (character, day). */
  upsertFollowers(points: FollowerPoint[]): Promise<void>;
  deleteFollower(characterId: string, date: string): Promise<void>;
  getAudience(characterId: string): Promise<Audience | null>;
  /** Merges: only the fields present in the patch are replaced. */
  saveAudience(characterId: string, patch: AudiencePatch): Promise<void>;
  /** Newest first. */
  listRevenues(): Promise<Revenue[]>;
  /** Skips entries whose non-empty ref already exists. Returns how many were added. */
  addRevenues(list: NewRevenue[]): Promise<number>;
  deleteRevenue(id: string): Promise<void>;
}

const emptyAudience = (characterId: string): Audience => ({
  characterId, gender: null, territories: [], hours: [], hoursDays: 0, source: 'manuel', updatedAt: now(),
});
const mergeAudience = (base: Audience, p: AudiencePatch): Audience => ({
  ...base,
  ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)),
  updatedAt: now(),
});
const byRevenue = (a: Revenue, b: Revenue) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt);

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

const now = () => new Date().toISOString();
const byDateTime = (a: Post, b: Post) => (a.date + a.time).localeCompare(b.date + b.time);

/* ---------------- JSON file (dev) ---------------- */

interface Db {
  characters: Character[]; posts: Post[]; concepts?: Concept[]; trends?: Trend[];
  followers?: FollowerPoint[]; audiences?: Audience[]; revenues?: Revenue[];
}

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
  async listConcepts() { return [...((await this.read()).concepts ?? [])].sort(newestFirst); }
  async getConcept(id: string) { return (await this.read()).concepts?.find(c => c.id === id) ?? null; }
  async createConcepts(list: NewConcept[]) {
    return this.mutate(db => {
      const at = Date.now();
      // Stagger timestamps so a batch keeps its order when sorted newest first.
      const out = list.map((c, i): Concept => ({ ...c, id: randomUUID(), status: 'idea', postId: '', createdAt: new Date(at - i).toISOString() }));
      (db.concepts ??= []).push(...out);
      return out;
    });
  }
  async updateConcept(id: string, patch: { status?: ConceptStatus; postId?: string }) {
    await this.mutate(db => { const c = db.concepts?.find(x => x.id === id); if (c) Object.assign(c, patch); });
  }
  async deleteConcept(id: string) {
    await this.mutate(db => { db.concepts = (db.concepts ?? []).filter(c => c.id !== id); });
  }
  async listTrends() { return [...((await this.read()).trends ?? [])].sort(newestFirst); }
  async addTrend(label: string) {
    await this.mutate(db => {
      const list = (db.trends ??= []);
      if (!list.some(t => t.label.toLowerCase() === label.toLowerCase())) list.push({ id: randomUUID(), label, createdAt: now() });
    });
  }
  async removeTrend(id: string) {
    await this.mutate(db => { db.trends = (db.trends ?? []).filter(t => t.id !== id); });
  }
  async listFollowers(characterId?: string) {
    const all = (await this.read()).followers ?? [];
    return all.filter(f => !characterId || f.characterId === characterId).sort((a, b) => a.date.localeCompare(b.date));
  }
  async upsertFollowers(points: FollowerPoint[]) {
    await this.mutate(db => {
      const list = (db.followers ??= []);
      for (const p of points) {
        const i = list.findIndex(f => f.characterId === p.characterId && f.date === p.date);
        if (i >= 0) list[i] = { ...p }; else list.push({ ...p });
      }
    });
  }
  async deleteFollower(characterId: string, date: string) {
    await this.mutate(db => { db.followers = (db.followers ?? []).filter(f => !(f.characterId === characterId && f.date === date)); });
  }
  async getAudience(characterId: string) { return (await this.read()).audiences?.find(a => a.characterId === characterId) ?? null; }
  async saveAudience(characterId: string, patch: AudiencePatch) {
    await this.mutate(db => {
      const list = (db.audiences ??= []);
      const i = list.findIndex(a => a.characterId === characterId);
      const next = mergeAudience(i >= 0 ? list[i] : emptyAudience(characterId), patch);
      if (i >= 0) list[i] = next; else list.push(next);
    });
  }
  async listRevenues() { return [...((await this.read()).revenues ?? [])].sort(byRevenue); }
  async addRevenues(list: NewRevenue[]) {
    return this.mutate(db => {
      const all = (db.revenues ??= []);
      let n = 0;
      for (const r of list) {
        if (r.ref && all.some(x => x.ref === r.ref)) continue;
        all.push({ ...r, id: randomUUID(), createdAt: now() });
        n++;
      }
      return n;
    });
  }
  async deleteRevenue(id: string) {
    await this.mutate(db => { db.revenues = (db.revenues ?? []).filter(r => r.id !== id); });
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
      await sql`create table if not exists concepts (
        id uuid primary key, character_ids text[] not null default '{}', trend text not null default '',
        format_id text not null, title text not null, hook text not null default '', beats jsonb not null default '[]'::jsonb,
        caption text not null default '', hashtags text[] not null default '{}', status text not null default 'idea',
        post_id text not null default '', source text not null default 'local', created_at timestamptz not null default now())`;
      await sql`create table if not exists trends (
        id uuid primary key, label text not null, created_at timestamptz not null default now())`;
      await sql`create unique index if not exists trends_label_idx on trends(lower(label))`;
      await sql`create table if not exists followers (
        character_id text not null, date date not null, followers integer not null, source text not null default 'manuel',
        updated_at timestamptz not null default now(), primary key (character_id, date))`;
      await sql`create table if not exists audiences (
        character_id text primary key, data jsonb not null, updated_at timestamptz not null default now())`;
      await sql`create table if not exists revenues (
        id uuid primary key, date date not null, amount numeric(12,2) not null, currency text not null, source text not null,
        character_id text not null default '', note text not null default '', ref text not null default '',
        created_at timestamptz not null default now())`;
      await sql`create unique index if not exists revenues_ref_idx on revenues(ref) where ref <> ''`;
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

  private toConcept = (r: Record<string, unknown>): Concept => ({
    id: r.id as string, characterIds: r.character_ids as string[], trend: r.trend as string, formatId: r.format_id as string,
    title: r.title as string, hook: r.hook as string, beats: (r.beats as string[]) ?? [], caption: r.caption as string,
    hashtags: r.hashtags as string[], status: r.status as ConceptStatus, postId: r.post_id as string,
    source: r.source as Concept['source'], createdAt: new Date(r.created_at as string).toISOString(),
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
  async listConcepts() {
    await this.init();
    return (await this.sql`select * from concepts order by created_at desc limit 300`).map(this.toConcept);
  }
  async getConcept(id: string) {
    await this.init();
    const [r] = await this.sql`select * from concepts where id = ${id}`;
    return r ? this.toConcept(r) : null;
  }
  async createConcepts(list: NewConcept[]) {
    await this.init();
    const at = Date.now();
    const out: Concept[] = [];
    for (const [i, c] of list.entries()) {
      const [r] = await this.sql`insert into concepts (id, character_ids, trend, format_id, title, hook, beats, caption, hashtags, source, created_at)
        values (${randomUUID()}, ${c.characterIds}, ${c.trend}, ${c.formatId}, ${c.title}, ${c.hook}, ${this.sql.json(c.beats)}::jsonb,
          ${c.caption}, ${c.hashtags}, ${c.source}, ${new Date(at - i).toISOString()})
        returning *`;
      out.push(this.toConcept(r));
    }
    return out;
  }
  async updateConcept(id: string, p: { status?: ConceptStatus; postId?: string }) {
    await this.init();
    const cols: Record<string, string> = {};
    if (p.status !== undefined) cols.status = p.status;
    if (p.postId !== undefined) cols.post_id = p.postId;
    if (!Object.keys(cols).length) return;
    await this.sql`update concepts set ${this.sql(cols)} where id = ${id}`;
  }
  async deleteConcept(id: string) {
    await this.init();
    await this.sql`delete from concepts where id = ${id}`;
  }
  async listTrends() {
    await this.init();
    return (await this.sql`select * from trends order by created_at desc`).map(r => ({
      id: r.id as string, label: r.label as string, createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  async addTrend(label: string) {
    await this.init();
    await this.sql`insert into trends (id, label) values (${randomUUID()}, ${label}) on conflict do nothing`;
  }
  async removeTrend(id: string) {
    await this.init();
    await this.sql`delete from trends where id = ${id}`;
  }
  async listFollowers(characterId?: string) {
    await this.init();
    const rows = characterId
      ? await this.sql`select character_id, to_char(date, 'YYYY-MM-DD') as date, followers, source from followers where character_id = ${characterId} order by date`
      : await this.sql`select character_id, to_char(date, 'YYYY-MM-DD') as date, followers, source from followers order by date`;
    return rows.map(r => ({
      characterId: r.character_id as string, date: r.date as string, followers: Number(r.followers), source: r.source as FollowerPoint['source'],
    }));
  }
  async upsertFollowers(points: FollowerPoint[]) {
    await this.init();
    for (const p of points) {
      await this.sql`insert into followers (character_id, date, followers, source) values (${p.characterId}, ${p.date}, ${p.followers}, ${p.source})
        on conflict (character_id, date) do update set followers = excluded.followers, source = excluded.source, updated_at = now()`;
    }
  }
  async deleteFollower(characterId: string, date: string) {
    await this.init();
    await this.sql`delete from followers where character_id = ${characterId} and date = ${date}`;
  }
  async getAudience(characterId: string) {
    await this.init();
    const [r] = await this.sql`select data from audiences where character_id = ${characterId}`;
    return r ? (r.data as Audience) : null;
  }
  async saveAudience(characterId: string, patch: AudiencePatch) {
    await this.init();
    const next = mergeAudience((await this.getAudience(characterId)) ?? emptyAudience(characterId), patch);
    await this.sql`insert into audiences (character_id, data) values (${characterId}, ${this.sql.json(next as never)}::jsonb)
      on conflict (character_id) do update set data = excluded.data, updated_at = now()`;
  }
  async listRevenues() {
    await this.init();
    const rows = await this.sql`select *, to_char(date, 'YYYY-MM-DD') as date from revenues order by date desc, created_at desc limit 1000`;
    return rows.map(r => ({
      id: r.id as string, date: r.date as string, amount: Number(r.amount), currency: r.currency as string, source: r.source as string,
      characterId: r.character_id as string, note: r.note as string, ref: r.ref as string,
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  async addRevenues(list: NewRevenue[]) {
    await this.init();
    let n = 0;
    for (const r of list) {
      const res = await this.sql`insert into revenues (id, date, amount, currency, source, character_id, note, ref)
        values (${randomUUID()}, ${r.date}, ${r.amount}, ${r.currency}, ${r.source}, ${r.characterId}, ${r.note}, ${r.ref})
        on conflict do nothing`;
      n += res.count;
    }
    return n;
  }
  async deleteRevenue(id: string) {
    await this.init();
    await this.sql`delete from revenues where id = ${id}`;
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
