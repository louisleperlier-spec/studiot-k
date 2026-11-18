'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { deleteCompetitor, deleteSpot, saveCompetitor, saveSpot, type ActionResult } from '@/app/actions';
import { FORMATS, formatById } from '@/lib/concepts';
import { formatLongFr } from '@/lib/date';
import { conceptLink, formatStats, formatViews, safeUrl, summarize, topSpots } from '@/lib/watch';
import { NETWORKS, NETWORK_LABEL, NETWORK_SHORT, type Competitor, type Spot } from '@/lib/types';

interface Props { competitors: Competitor[]; spots: Spot[]; today: string }

type Editing =
  | { kind: 'competitor'; item?: Competitor }
  | { kind: 'spot'; item?: Spot; competitorId?: string }
  | null;

const shortDate = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export function Watch({ competitors, spots, today }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const [filter, setFilter] = useState('tous');
  const byId = useMemo(() => Object.fromEntries(competitors.map(c => [c.id, c])), [competitors]);
  const shown = spots.filter(s => filter === 'tous' || s.competitorId === filter);
  const stats = formatStats(shown);
  const best = stats.find(s => s.avgViews !== null);
  const maxAvg = Math.max(1, ...stats.map(s => s.avgViews ?? 0));
  const top = topSpots(shown, 3);

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Veille</div><h1>Concurrents</h1></div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setEditing({ kind: 'competitor' })}>+ Compte</button>
          <button className="btn btn-primary" disabled={!competitors.length} title={competitors.length ? undefined : 'Ajoute d’abord un compte'}
            onClick={() => setEditing({ kind: 'spot', competitorId: filter !== 'tous' ? filter : undefined })}>+ Repérage</button>
        </div>
      </div>

      <div className="grid g-4">
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Comptes suivis</span><b>{competitors.length}</b><span className="sub">TikTok, Instagram, YouTube, Facebook</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Vidéos repérées</span><b>{shown.length}</b><span className="sub">{filter === 'tous' ? 'tous comptes' : byId[filter]?.name}</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Format qui marche le mieux</span><b className="metric-txt">{best ? formatById(best.formatId)?.label : '—'}</b><span className="sub">{best ? `${formatViews(best.avgViews)} vues en moyenne` : 'note les vues pour le savoir'}</span></GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}><span className="muted">Meilleure vidéo</span><b>{formatViews(top[0]?.views ?? null)}</b><span className="sub">{top[0] ? byId[top[0].competitorId]?.name : 'aucune vue notée'}</span></GlassPanel>
      </div>

      <div className="grid g-main">
        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h">
            <h2>Repérages</h2>
            {competitors.length > 0 && (
              <select className="input input-sm" aria-label="Filtrer par compte" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="tous">Tous les comptes</option>
                {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {shown.length ? (
            <div className="spots">
              {shown.map(s => <SpotCard key={s.id} s={s} c={byId[s.competitorId]} onEdit={() => setEditing({ kind: 'spot', item: s })} />)}
            </div>
          ) : (
            <div className="empty">
              {competitors.length ? (
                <><p>Quand une vidéo d’un concurrent cartonne, note-la ici : le format, l’accroche, les vues. Tu pourras en faire un concept en un clic.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ kind: 'spot', competitorId: filter !== 'tous' ? filter : undefined })}>Noter une vidéo</button></>
              ) : (
                <><p>Commence par ajouter les comptes qui font des personnages IA proches des tiens.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ kind: 'competitor' })}>Ajouter un compte</button></>
              )}
            </div>
          )}
        </GlassPanel>

        <div className="stack">
          <GlassPanel tone="dark" className="panel" radius={22}>
            <div className="panel-h"><h2>Comptes suivis</h2></div>
            {competitors.length ? (
              <ul className="rivals">
                {competitors.map(c => {
                  const sum = summarize(c, spots);
                  const url = safeUrl(c.url);
                  return (
                    <li key={c.id} className={filter === c.id ? 'is-on' : undefined}>
                      <button className="rival" onClick={() => setFilter(f => (f === c.id ? 'tous' : c.id))} aria-pressed={filter === c.id}>
                        <span className={`rival-av net-${c.network}`} aria-hidden="true">{NETWORK_SHORT[c.network]}</span>
                        <span className="rival-tx">
                          <strong>{c.name}</strong>
                          <small>{[c.handle !== c.name ? c.handle : '', c.niche].filter(Boolean).join(' · ') || NETWORK_LABEL[c.network]}</small>
                        </span>
                        <span className="rival-n"><b>{sum.count}</b><small>{sum.lastDate ? shortDate(sum.lastDate) : 'vidéos'}</small></span>
                      </button>
                      <div className="rival-act">
                        {url && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noopener noreferrer">Profil</a>}
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ kind: 'competitor', item: c })}>Modifier</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">Aucun compte pour l’instant.</p>}
          </GlassPanel>

          <GlassPanel tone="dark" className="panel" radius={22}>
            <div className="panel-h"><h2>Ce qui marche</h2><span className="muted" style={{ fontSize: 12 }}>vues moyennes par format</span></div>
            {stats.length ? (
              <div className="fstats">
                {stats.map(s => (
                  <div key={s.formatId} className="fstat">
                    <span className="fstat-l">{formatById(s.formatId)?.label ?? s.formatId}<small>{s.count} vidéo{s.count > 1 ? 's' : ''}</small></span>
                    <div className="ramp-bar"><i style={{ width: `${((s.avgViews ?? 0) / maxAvg) * 100}%` }} /></div>
                    <b>{formatViews(s.avgViews)}</b>
                  </div>
                ))}
              </div>
            ) : <p className="muted">Les formats apparaîtront ici dès tes premiers repérages.</p>}
          </GlassPanel>
        </div>
      </div>

      {editing?.kind === 'competitor' && <CompetitorModal item={editing.item} onClose={() => setEditing(null)} onDeleted={() => setFilter('tous')} />}
      {editing?.kind === 'spot' && <SpotModal item={editing.item} competitorId={editing.competitorId} competitors={competitors} today={today} onClose={() => setEditing(null)} />}
    </>
  );
}

function SpotCard({ s, c, onEdit }: { s: Spot; c?: Competitor; onEdit: () => void }) {
  const url = safeUrl(s.url);
  return (
    <article className="spot">
      <header className="spot-h">
        <span className="spot-who">{c && <span className={`net-dot net-${c.network}`} title={NETWORK_LABEL[c.network]}>{NETWORK_SHORT[c.network]}</span>}<strong>{c?.name ?? 'Compte supprimé'}</strong><span className="muted">{formatLongFr(s.date)}</span></span>
        <span className="spot-views" title="Vues">{formatViews(s.views)}<small>vues</small></span>
      </header>
      <h3>{s.title}</h3>
      <div className="concept-meta"><span className="tag">{formatById(s.formatId)?.label ?? s.formatId}</span></div>
      {s.hook && <p className="hook">« {s.hook} »</p>}
      {s.note && <p className="spot-note">{s.note}</p>}
      <footer className="row concept-actions">
        <Link className="btn btn-primary btn-sm" href={conceptLink(s)}>En faire un concept</Link>
        {url && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noopener noreferrer">Voir la vidéo</a>}
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Modifier</button>
      </footer>
    </article>
  );
}

function useModal(onClose: () => void, res: ActionResult) {
  useEffect(() => { if (res?.ok) onClose(); }, [res, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

function DeleteRow({ label, onDelete }: { label: string; onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  if (!confirm) return <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>Supprimer</button>;
  return (
    <>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => start(onDelete)}>Oui, supprimer</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Non</button>
    </>
  );
}

function CompetitorModal({ item, onClose, onDeleted }: { item?: Competitor; onClose: () => void; onDeleted: () => void }) {
  const [res, action, pending] = useActionState(saveCompetitor, null);
  useModal(onClose, res);
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <GlassPanel tone="dark" className="modal" radius={22} role="dialog" aria-modal="true" aria-labelledby="rival-title">
        <h2 id="rival-title" style={{ fontSize: 20 }}>{item ? 'Modifier le compte' : 'Suivre un compte'}</h2>
        <form action={action} className="form">
          {item && <input type="hidden" name="id" value={item.id} />}
          <label className="field"><span>Lien du profil</span><input className="input" name="url" type="url" defaultValue={item?.url} placeholder="https://www.tiktok.com/@…" autoFocus={!item} /></label>
          <div className="row-2">
            <label className="field"><span>Nom</span><input className="input" name="name" defaultValue={item?.name} placeholder="ex. Le Moine IA" /></label>
            <label className="field"><span>@</span><input className="input" name="handle" defaultValue={item?.handle} placeholder="déduit du lien si vide" /></label>
          </div>
          <div className="row-2">
            <label className="field"><span>Réseau</span>
              <select className="input" name="network" defaultValue={item?.network ?? ''}>
                {!item && <option value="">Déduit du lien</option>}
                {NETWORKS.map(n => <option key={n} value={n}>{NETWORK_LABEL[n]}</option>)}
              </select></label>
            <label className="field"><span>Niche</span><input className="input" name="niche" defaultValue={item?.niche} placeholder="ex. personnage religieux absurde" /></label>
          </div>
          <label className="field"><span>Notes</span><textarea className="input" name="notes" defaultValue={item?.notes} placeholder="Ce qui te plaît, ce qui marche chez eux…" /></label>
          {res && !res.ok && <p className="notice err" role="alert">{res.message}</p>}
          <div className="modal-actions">
            <div className="row">{item && <DeleteRow label="Supprimer le compte et ses repérages ?" onDelete={async () => { await deleteCompetitor(item.id); onDeleted(); onClose(); }} />}</div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" disabled={pending}>{pending ? 'Enregistrement…' : item ? 'Enregistrer' : 'Suivre'}</button>
            </div>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}

function SpotModal({ item, competitorId, competitors, today, onClose }: { item?: Spot; competitorId?: string; competitors: Competitor[]; today: string; onClose: () => void }) {
  const [res, action, pending] = useActionState(saveSpot, null);
  useModal(onClose, res);
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <GlassPanel tone="dark" className="modal" radius={22} role="dialog" aria-modal="true" aria-labelledby="spot-title">
        <h2 id="spot-title" style={{ fontSize: 20 }}>{item ? 'Modifier le repérage' : 'Noter une vidéo'}</h2>
        <form action={action} className="form">
          {item && <input type="hidden" name="id" value={item.id} />}
          <div className="row-2">
            <label className="field"><span>Compte</span>
              <select className="input" name="competitorId" defaultValue={item?.competitorId ?? competitorId ?? competitors[0]?.id}>
                {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label className="field"><span>Date</span><input className="input" name="date" type="date" max={today} defaultValue={item?.date ?? today} required /></label>
          </div>
          <label className="field"><span>De quoi ça parle</span><input className="input" name="title" defaultValue={item?.title} required maxLength={200} placeholder="ex. le moine qui découvre le Wi-Fi" autoFocus /></label>
          <div className="row-2">
            <label className="field"><span>Format</span>
              <select className="input" name="formatId" defaultValue={item?.formatId ?? FORMATS[0].id}>
                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select></label>
            <label className="field"><span>Vues</span><input className="input" name="views" defaultValue={item?.views ?? ''} placeholder="ex. 1,2 M ou 45k" inputMode="text" /></label>
          </div>
          <label className="field"><span>Lien de la vidéo</span><input className="input" name="url" type="url" defaultValue={item?.url} placeholder="https://…" /></label>
          <label className="field"><span>Accroche</span><input className="input" name="hook" defaultValue={item?.hook} maxLength={400} placeholder="La phrase des 2 premières secondes" /></label>
          <label className="field"><span>Pourquoi ça marche</span><textarea className="input" name="note" defaultValue={item?.note} placeholder="Rythme, chute, son, commentaires…" /></label>
          {res && !res.ok && <p className="notice err" role="alert">{res.message}</p>}
          <div className="modal-actions">
            <div className="row">{item && <DeleteRow label="Supprimer ce repérage ?" onDelete={async () => { await deleteSpot(item.id); onClose(); }} />}</div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" disabled={pending}>{pending ? 'Enregistrement…' : item ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
