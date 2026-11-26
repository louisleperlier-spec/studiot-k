import { store } from '@/lib/store';
import { todayInStudio } from '@/lib/date';
import { StatsBoard } from './StatsBoard';

export const metadata = { title: 'Stats' };
export const dynamic = 'force-dynamic';

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ perso?: string }> }) {
  const sp = await searchParams;
  const [characters, allFollowers, revenues] = await Promise.all([
    store().listCharacters(), store().listFollowers(), store().listRevenues(),
  ]);
  // By default, the character whose figures were updated last (else St Tarbanouche).
  const latest = [...allFollowers].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.characterId;
  const current = characters.find(c => c.id === sp.perso) ?? characters.find(c => c.id === latest) ?? characters.find(c => c.id === 'tarbanouche') ?? characters[0];
  const audience = await store().getAudience(current.id);
  const empty = !allFollowers.length && !revenues.length && !(await Promise.all(characters.map(c => store().getAudience(c.id)))).some(Boolean);
  return (
    <StatsBoard
      characters={characters}
      current={current}
      followers={allFollowers.filter(f => f.characterId === current.id)}
      audience={audience}
      revenues={revenues}
      today={todayInStudio()}
      syncReady={Boolean(process.env.STATS_API_TOKEN)}
      empty={empty}
    />
  );
}
