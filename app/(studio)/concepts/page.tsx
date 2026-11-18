import { store } from '@/lib/store';
import { claudeEnabled } from '@/lib/generate';
import { formatById } from '@/lib/concepts';
import { ConceptLab } from './ConceptLab';

export const metadata = { title: 'Générateur de concepts' };
export const dynamic = 'force-dynamic';

export default async function ConceptsPage({ searchParams }: { searchParams: Promise<{ tendance?: string; format?: string }> }) {
  const sp = await searchParams;
  const [characters, concepts, trends, posts] = await Promise.all([
    store().listCharacters(), store().listConcepts(), store().listTrends(), store().listPosts(),
  ]);
  const postDate = Object.fromEntries(posts.map(p => [p.id, p.date]));
  // A concept whose calendar post was deleted goes back to "kept".
  const list = concepts.map(c => (c.status === 'scheduled' && !postDate[c.postId] ? { ...c, status: 'kept' as const, postId: '' } : c));
  return <ConceptLab characters={characters} concepts={list} trends={trends} postDate={postDate} claude={claudeEnabled()}
    initialTrend={(sp.tendance ?? '').slice(0, 200)} initialFormat={formatById(sp.format ?? '')?.id} />;
}
