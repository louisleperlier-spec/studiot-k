import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { mixConcepts, namesOf, type MixInput } from './concepts';
import type { Character, NewConcept } from './types';

const MODEL = 'claude-opus-5-5';

const ConceptsSchema = z.object({
  concepts: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    beats: z.array(z.string()),
    caption: z.string(),
    hashtags: z.array(z.string()),
  })),
});

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

function describe(c: Character) {
  const lines = [`- ${c.name}`];
  if (c.universe) lines.push(`  Univers : ${c.universe}`);
  if (c.tone) lines.push(`  Ton : ${c.tone}`);
  if (c.catchphrases) lines.push(`  Répliques : ${c.catchphrases.replace(/\n+/g, ' / ')}`);
  return lines.join('\n');
}

// Stable across calls so the prefix can be cached.
const SYSTEM = `Tu es l'auteur des vidéos courtes (TikTok, Reels, Shorts) de deux personnages IA créés par Louis : St Tarbanouche et Kevun.
Tu écris en français, avec un humour absurde et rythmé, pour des vidéos de 20 à 45 secondes.
Pour chaque concept, donne :
- title : un titre de travail court (moins de 70 caractères)
- hook : la phrase des 2 premières secondes, celle qui arrête le scroll
- beats : 4 à 6 étapes du déroulé, de l'accroche à la chute, chacune jouable en une ou deux prises
- caption : la légende du post, une ou deux phrases, sans hashtags
- hashtags : 3 à 6 hashtags pertinents, avec le #
Chaque concept doit prendre un angle vraiment différent des autres. Reste fidèle à la personnalité décrite de chaque personnage ; si elle est vide, invente un caractère cohérent avec son nom.`;

/**
 * Writes concepts with Claude when ANTHROPIC_API_KEY is set, otherwise with the
 * built-in mixer. Any API failure also falls back to the mixer so the button always works.
 */
export async function generateConcepts(input: MixInput): Promise<{ concepts: NewConcept[]; note?: string }> {
  if (!claudeEnabled()) return { concepts: mixConcepts(input) };

  const prompt = [
    `Personnage${input.characters.length > 1 ? 's (crossover, ils apparaissent ensemble)' : ''} :`,
    ...input.characters.map(describe),
    '',
    `Tendance à exploiter : ${input.trend}`,
    `Format : ${input.format.label} (${input.format.hint})`,
    input.twist ? `Contrainte en plus : ${input.twist}` : '',
    '',
    `Écris ${input.count} concepts pour ${namesOf(input.characters)}.`,
  ].join('\n');

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ConceptsSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`stop_reason=${res.stop_reason}`);
    const concepts = res.parsed_output.concepts.slice(0, input.count).map((c): NewConcept => ({
      characterIds: input.characters.map(x => x.id),
      trend: input.trend,
      formatId: input.format.id,
      title: c.title.slice(0, 160),
      hook: c.hook.slice(0, 400),
      beats: c.beats.slice(0, 8).map(b => b.slice(0, 400)),
      caption: c.caption.slice(0, 1000),
      hashtags: c.hashtags.slice(0, 8).map(h => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, '')),
      source: 'claude',
    }));
    if (!concepts.length) throw new Error('empty');
    return { concepts };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.error('[concepts] clé ANTHROPIC_API_KEY refusée');
    else console.error('[concepts] génération Claude impossible, bascule sur le mixeur', e);
    return { concepts: mixConcepts(input), note: 'Claude ne répondait pas, idées faites par le mixeur intégré.' };
  }
}
