import { store } from '@/lib/store';
import { CharacterStudio } from './CharacterStudio';

export const metadata = { title: 'Personnages' };
export const dynamic = 'force-dynamic';

export default async function PersonnagesPage() {
  const [characters, posts] = await Promise.all([store().listCharacters(), store().listPosts()]);
  const postCounts: Record<string, number> = {};
  for (const p of posts) postCounts[p.characterId] = (postCounts[p.characterId] ?? 0) + 1;
  return (
    <>
      <div className="head"><div><div className="eyebrow">Bibliothèque</div><h1>Tes personnages</h1></div>
        <p className="muted">Fais glisser les dossiers ou utilise les flèches pour changer de personnage.</p></div>
      <CharacterStudio characters={characters} postCounts={postCounts} />
    </>
  );
}
