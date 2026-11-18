import { store } from '@/lib/store';
import { todayInStudio } from '@/lib/date';
import { Watch } from './Watch';

export const metadata = { title: 'Concurrents' };
export const dynamic = 'force-dynamic';

export default async function ConcurrentsPage() {
  const [competitors, spots] = await Promise.all([store().listCompetitors(), store().listSpots()]);
  return <Watch competitors={competitors} spots={spots} today={todayInStudio()} />;
}
