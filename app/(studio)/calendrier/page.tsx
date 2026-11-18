import { store } from '@/lib/store';
import { addDays, todayInStudio } from '@/lib/date';
import { Calendar } from './Calendar';

export const metadata = { title: 'Calendrier' };
export const dynamic = 'force-dynamic';

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ mois?: string; perso?: string }> }) {
  const sp = await searchParams;
  const today = todayInStudio();
  const month = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : today.slice(0, 7);
  const characters = await store().listCharacters();
  const filter = characters.some(c => c.id === sp.perso) ? sp.perso! : 'tous';
  // Charge le mois affiché plus une semaine de marge de chaque côté (jours hors mois visibles dans la grille).
  const posts = await store().listPosts({ from: addDays(`${month}-01`, -7), to: addDays(`${month}-28`, 14) });
  return <Calendar key={month} month={month} today={today} posts={posts} characters={characters} filter={filter} />;
}
