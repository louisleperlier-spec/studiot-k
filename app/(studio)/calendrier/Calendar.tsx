'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { deletePost, movePost, savePost } from '@/app/actions';
import { thumb } from '@/components/bits';
import { parseYmd, ymd } from '@/lib/date';
import { NETWORKS, NETWORK_LABEL, STATUS_LABEL, type Character, type Post, type PostStatus } from '@/lib/types';

interface Props {
  month: string; // YYYY-MM
  today: string;
  posts: Post[];
  characters: Character[];
  filter: string; // 'tous' | character id
}

type Editing = { post?: Post; date: string } | null;

export function Calendar({ month, today, posts, characters, filter }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startMove] = useTransition();
  const [shown, moveOptimistic] = useOptimistic(posts, (list: Post[], m: { id: string; date: string }) =>
    list.map(p => (p.id === m.id ? { ...p, date: m.date } : p)));

  const byId = useMemo(() => Object.fromEntries(characters.map(c => [c.id, c])), [characters]);
  const first = parseYmd(`${month}-01`);
  const days = useMemo(() => {
    const start = new Date(first); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const span = Math.round((last.getTime() - start.getTime()) / 864e5) + 1;
    return Array.from({ length: Math.ceil(span / 7) * 7 }, (_, i) => ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = shown.filter(p => filter === 'tous' || p.characterId === filter);
  const inMonth = visible.filter(p => p.date.startsWith(month));
  const count = (s: PostStatus) => inMonth.filter(p => p.status === s).length;
  const prev = ymd(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7);
  const next = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7);
  const q = (m: string, f = filter) => `/calendrier?mois=${m}${f !== 'tous' ? `&perso=${f}` : ''}`;
  const label = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  function drop(date: string) {
    const id = dragId;
    setDragId(null); setOver(null);
    if (!id || date < today) return;
    const p = shown.find(x => x.id === id);
    if (!p || p.date === date) return;
    startMove(async () => { moveOptimistic({ id, date }); await movePost(id, date); });
  }

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Programmation</div><h1>Calendrier</h1></div>
        <button className="btn btn-primary" onClick={() => setEditing({ date: today })}>+ Nouveau post</button>
      </div>
      <GlassPanel tone="dark" className="panel" radius={22}>
        <div className="cc-bar">
          <div className="cc-nav">
            <Link className="cc-arrow" href={q(prev)} aria-label="Mois précédent">‹</Link>
            <span className="cc-label" aria-live="polite">{label}</span>
            <Link className="cc-arrow" href={q(next)} aria-label="Mois suivant">›</Link>
          </div>
          <div className="cc-stats">
            <span className="chip is-published">{count('published')} publiés</span>
            <span className="chip is-scheduled">{count('scheduled')} programmés</span>
            <span className="chip is-draft">{count('draft')} brouillons</span>
            {count('failed') > 0 && <span className="chip is-failed">{count('failed')} en échec</span>}
          </div>
          <nav className="seg" aria-label="Filtrer par personnage">
            <Link href={q(month, 'tous')} aria-current={filter === 'tous'}>Tous</Link>
            {characters.map(c => <Link key={c.id} href={q(month, c.id)} aria-current={filter === c.id}>{c.name}</Link>)}
          </nav>
        </div>
        <div className="cc-grid">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="cc-dow">{d}</div>)}
          {days.map(d => {
            const list = visible.filter(p => p.date === d);
            const past = d < today;
            const cls = ['cc-day', !d.startsWith(month) && 'is-out', d === today && 'is-today', past && 'is-past', over === d && 'is-drop'].filter(Boolean).join(' ');
            return (
              <div key={d} className={cls}
                onDragOver={e => { if (dragId && !past) { e.preventDefault(); setOver(d); } }}
                onDragLeave={() => setOver(o => (o === d ? null : o))}
                onDrop={e => { e.preventDefault(); drop(d); }}>
                <div className="cc-head">
                  <span className="cc-n" aria-current={d === today ? 'date' : undefined}>{parseYmd(d).getDate()}</span>
                  {!past && <button className="cc-add" aria-label={`Nouveau post le ${d}`} onClick={() => setEditing({ date: d })}>+</button>}
                </div>
                {list.slice(0, 3).map(p => (
                  <button key={p.id} className={`cc-post is-${p.status}${dragId === p.id ? ' is-dragging' : ''}`}
                    draggable={p.status !== 'published'} onDragStart={e => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragId(null); setOver(null); }}
                    onClick={() => setEditing({ post: p, date: p.date })} title={`${p.time} · ${STATUS_LABEL[p.status]} · ${byId[p.characterId]?.name ?? ''}`}>
                    <span className="bar" />
                    <span className="th" style={{ '--t': thumb(p.mediaUrl || byId[p.characterId]?.assets.find(a => a.kind === 'image')?.url, byId[p.characterId]?.color ?? '#555') } as React.CSSProperties} />
                    <span className="tx"><small>{p.time}</small><span className="t">{p.title}</span></span>
                  </button>
                ))}
                {list.length > 3 && <button className="cc-more" onClick={() => setEditing({ post: list[3], date: d })}>+{list.length - 3} autres</button>}
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Heures en heure de Toronto. Glisse un post sur un autre jour pour le déplacer.</p>
      </GlassPanel>
      {editing && <PostModal key={editing.post?.id ?? editing.date} editing={editing} characters={characters} today={today} onClose={() => setEditing(null)} />}
    </>
  );
}

function PostModal({ editing, characters, today, onClose }: { editing: NonNullable<Editing>; characters: Character[]; today: string; onClose: () => void }) {
  const p = editing.post;
  const [res, action, pending] = useActionState(savePost, null);
  const [deleting, startDelete] = useTransition();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { if (res?.ok) onClose(); }, [res, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const defaultTime = p?.time ?? '18:00';
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <GlassPanel tone="dark" className="modal" radius={22} role="dialog" aria-modal="true" aria-labelledby="post-modal-title">
        <h2 id="post-modal-title" style={{ fontSize: 20 }}>{p ? 'Modifier le post' : 'Nouveau post'}</h2>
        <form action={action} className="form">
          {p && <input type="hidden" name="id" value={p.id} />}
          <input type="hidden" name="mediaUrl" value={p?.mediaUrl ?? ''} />
          <label className="field"><span>Titre</span><input className="input" id="post-title" name="title" defaultValue={p?.title} required autoFocus placeholder="ex. Tarbanouche rate sa messe" /></label>
          <div className="row-2">
            <label className="field"><span>Personnage</span>
              <select className="input" id="post-character" name="characterId" defaultValue={p?.characterId ?? characters[0]?.id}>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label className="field"><span>Statut</span>
              <select className="input" id="post-status" name="status" defaultValue={p?.status ?? 'scheduled'}>
                {(Object.keys(STATUS_LABEL) as PostStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select></label>
          </div>
          <div className="row-2">
            <label className="field"><span>Date</span><input className="input" id="post-date" name="date" type="date" min={p ? undefined : today} defaultValue={editing.date} required /></label>
            <label className="field"><span>Heure (Toronto)</span><input className="input" id="post-time" name="time" type="time" defaultValue={defaultTime} required /></label>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <span>Réseaux</span>
            <div className="checks">
              {NETWORKS.map(n => (
                <label key={n} className="check"><input type="checkbox" name="networks" value={n} defaultChecked={p ? p.networks.includes(n) : true} /><span>{NETWORK_LABEL[n]}</span></label>
              ))}
            </div>
          </fieldset>
          <label className="field"><span>Légende</span><textarea className="input" id="post-caption" name="caption" defaultValue={p?.caption} placeholder="Texte, hashtags…" /></label>
          <label className="field"><span>Vidéo ou visuel {p?.mediaUrl ? '(déjà ajouté, remplace-le si besoin)' : ''}</span>
            <input className="input" id="post-media" name="media" type="file" accept="video/*,image/*" /></label>
          {res && !res.ok && <p className="notice err" role="alert">{res.message}</p>}
          <div className="modal-actions">
            <div className="row">
              {p && !confirm && <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>Supprimer</button>}
              {p && confirm && <>
                <span className="muted" style={{ fontSize: 12 }}>Supprimer ce post ?</span>
                <button type="button" className="btn btn-danger btn-sm" disabled={deleting} onClick={() => startDelete(async () => { await deletePost(p.id); onClose(); })}>Oui, supprimer</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Non</button>
              </>}
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" disabled={pending}>{pending ? 'Enregistrement…' : p ? 'Enregistrer' : 'Programmer'}</button>
            </div>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}

