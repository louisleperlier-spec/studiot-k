import Link from 'next/link';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { Nets, Who, thumb } from '@/components/bits';
import { store } from '@/lib/store';
import { formatLongFr, todayInStudio } from '@/lib/date';
import { RAMP_STEPS as STEPS, rampStep } from '@/lib/concepts';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const today = todayInStudio();
  const [characters, posts] = await Promise.all([store().listCharacters(), store().listPosts()]);
  const byId = Object.fromEntries(characters.map(c => [c.id, c]));
  const upcoming = posts.filter(p => p.date >= today && p.status !== 'published').slice(0, 6);
  const scheduled = posts.filter(p => p.status === 'scheduled' && p.date >= today);
  const lastScheduled = scheduled.at(-1)?.date;
  const { perDay: perDayLastWeek, step: current } = rampStep(posts, today);
  const daysCovered = lastScheduled ? Math.max(0, Math.round((new Date(lastScheduled).getTime() - new Date(today).getTime()) / 864e5) + 1) : 0;
  const failed = posts.filter(p => p.status === 'failed').length;

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">{formatLongFr(today)}</div><h1>Bonjour Louis</h1></div>
        <Link className="btn btn-primary" href="/calendrier">Programmer un post</Link>
      </div>

      <div className="grid g-4">
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Programmés d&apos;avance</span><b>{scheduled.length}</b><span className="sub">{lastScheduled ? `jusqu'au ${formatLongFr(lastScheduled)}` : 'rien de prévu'}</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Jours couverts</span><b>{daysCovered}</b><span className="sub">objectif : 7 jours d&apos;avance</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Rythme des 7 derniers jours</span><b>{perDayLastWeek.toFixed(1)}</b><span className="sub">posts par jour</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">À relancer</span><b>{failed}</b><span className="sub">{failed ? 'posts en échec' : 'tout va bien'}</span></GlassPanel>
      </div>

      <div className="grid g-main">
        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h"><h2>File de publication</h2><Link className="btn btn-ghost btn-sm" href="/calendrier">Voir le calendrier</Link></div>
          {upcoming.length ? (
            <div className="queue">
              {upcoming.map(p => {
                const c = byId[p.characterId];
                return (
                  <Link key={p.id} className="q" href={`/calendrier?mois=${p.date.slice(0, 7)}`}>
                    <span className="q-time">{p.date === today ? p.time : `${p.date.slice(8)}/${p.date.slice(5, 7)}`}</span>
                    <span className="q-thumb" style={{ '--t': thumb(p.mediaUrl || c?.assets.find(a => a.kind === 'image')?.url, c?.color ?? '#555') } as React.CSSProperties} />
                    <span className="q-txt"><strong>{p.title}</strong><Who c={c} /></span>
                    <Nets list={p.networks} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <p>Aucun post à venir pour l&apos;instant.</p>
              <Link className="btn btn-ghost btn-sm" href="/calendrier">Programmer le premier</Link>
            </div>
          )}
        </GlassPanel>

        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h"><h2>Montée en rythme</h2><span className="chip is-scheduled">Palier {current}</span></div>
          <div className="ramp">
            {STEPS.map(s => (
              <div key={s} className={`ramp-step${s === current ? ' is-now' : ''}`}>
                <b>{s} / jour</b>
                <div className="ramp-bar"><i style={{ width: `${Math.min(100, (perDayLastWeek / s) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Passe au palier suivant quand tu as au moins 7 jours de vidéos prêtes d&apos;avance.</p>
        </GlassPanel>
      </div>
    </>
  );
}
