'use client';
import Link from 'next/link';
import { startTransition, useActionState, useMemo, useState, useTransition } from 'react';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { Who } from '@/components/bits';
import { deleteConcept, generateAction, removeTrend, scheduleConcept, setConceptStatus } from '@/app/actions';
import { FORMATS, formatById, postCaption } from '@/lib/concepts';
import { formatLongFr } from '@/lib/date';
import { CONCEPT_STATUS_LABEL, type Character, type Concept, type ConceptStatus, type Trend } from '@/lib/types';

interface Props {
  characters: Character[];
  concepts: Concept[];
  trends: Trend[];
  postDate: Record<string, string>;
  claude: boolean;
}

type Filter = 'all' | ConceptStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'kept', label: 'Gardés' },
  { id: 'scheduled', label: 'Au calendrier' },
];

export function ConceptLab({ characters, concepts, trends, postDate, claude }: Props) {
  const [res, action, pending] = useActionState(generateAction, null);
  const [trend, setTrend] = useState('');
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [filter, setFilter] = useState<Filter>('all');
  const [, startTrend] = useTransition();
  const byId = useMemo(() => Object.fromEntries(characters.map(c => [c.id, c])), [characters]);
  const fresh = new Set(res?.ok ? res.ids : []);
  const shown = concepts.filter(c => filter === 'all' || c.status === filter);
  const format = formatById(formatId);

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Atelier</div><h1>Générateur de concepts</h1></div>
        <span className={`chip ${claude ? 'is-scheduled' : 'is-draft'}`} title={claude ? 'Les idées sont écrites par Claude.' : 'Ajoute ANTHROPIC_API_KEY pour que Claude écrive les idées.'}>
          {claude ? 'Écrit par Claude' : 'Mixeur intégré'}
        </span>
      </div>

      <div className="grid g-lab">
        <GlassPanel tone="dark" className="panel lab-form" radius={22}>
          {/* onSubmit instead of action= so the form isn't reset: Louis can tweak and mix again. */}
          <form className="form" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
            <fieldset className="field bare">
              <span>Personnages</span>
              <div className="checks">
                {characters.map((c, i) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" name="characterIds" value={c.id} defaultChecked={i === 0} />
                    <span><Who c={c} /></span>
                  </label>
                ))}
              </div>
              <small className="muted">Coche les deux pour un crossover.</small>
            </fieldset>

            <label className="field"><span>Tendance</span>
              <input className="input" name="trend" value={trend} onChange={e => setTrend(e.target.value)} required maxLength={200}
                placeholder="ex. le son « c’est pas moi c’est mon jumeau »" list="trend-list" autoComplete="off" />
            </label>
            <datalist id="trend-list">{trends.map(t => <option key={t.id} value={t.label} />)}</datalist>
            {trends.length > 0 && (
              <div className="trend-chips" aria-label="Tendances enregistrées">
                {trends.slice(0, 12).map(t => (
                  <span key={t.id} className={`tchip${t.label === trend ? ' is-on' : ''}`}>
                    <button type="button" onClick={() => setTrend(t.label)}>{t.label}</button>
                    <button type="button" className="x" aria-label={`Retirer ${t.label}`} onClick={() => startTrend(() => removeTrend(t.id))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <label className="check-line"><input type="checkbox" name="saveTrend" defaultChecked /> Garder cette tendance dans la liste</label>

            <fieldset className="field bare">
              <span>Format</span>
              <div className="checks">
                {FORMATS.map(f => (
                  <label key={f.id} className="check">
                    <input type="radio" name="formatId" value={f.id} checked={formatId === f.id} onChange={() => setFormatId(f.id)} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
              {format && <small className="muted">{format.hint}</small>}
            </fieldset>

            <label className="field"><span>Contrainte (facultatif)</span>
              <input className="input" name="twist" maxLength={300} placeholder="ex. sans un seul mot, ou dans une laverie" />
            </label>

            <div className="row lab-submit">
              <label className="field count"><span>Idées</span>
                <select className="input" name="count" defaultValue="3">{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select>
              </label>
              <button className="btn btn-primary" disabled={pending}>{pending ? 'Ça mixe…' : 'Mixer'}</button>
            </div>
            {res && <p className={`notice ${res.ok ? 'ok' : 'err'}`} role={res.ok ? 'status' : 'alert'}>{res.message}</p>}
          </form>
        </GlassPanel>

        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h">
            <h2>Idées</h2>
            <nav className="seg" aria-label="Filtrer les idées">
              {FILTERS.map(f => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
            </nav>
          </div>
          {pending && (
            <div className="lab-thinking" role="status"><div className="orb sm" aria-hidden="true" /><span className="muted">{claude ? 'Claude écrit tes concepts…' : 'Mélange en cours…'}</span></div>
          )}
          {shown.length ? (
            <div className="concepts">
              {shown.map(c => <ConceptCard key={c.id} c={c} byId={byId} fresh={fresh.has(c.id)} postDate={postDate[c.postId]} />)}
            </div>
          ) : !pending && (
            <div className="empty">
              <p>{filter === 'all' ? 'Pas encore d’idées. Choisis un personnage, une tendance et un format, puis clique sur Mixer.' : 'Rien ici pour l’instant.'}</p>
            </div>
          )}
        </GlassPanel>
      </div>
    </>
  );
}

function ConceptCard({ c, byId, fresh, postDate }: { c: Concept; byId: Record<string, Character>; fresh: boolean; postDate?: string }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = [c.title, '', c.hook, '', ...c.beats.map((b, i) => `${i + 1}. ${b}`), '', postCaption(c)].join('\n');
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => undefined);
  }

  return (
    <article className={`concept${fresh ? ' is-fresh' : ''}`} aria-busy={busy}>
      <header className="concept-h">
        <div className="concept-meta">
          {c.characterIds.map(id => <Who key={id} c={byId[id]} />)}
          <span className="tag">{formatById(c.formatId)?.label ?? c.formatId}</span>
          <span className="tag tag-trend">{c.trend}</span>
        </div>
        <span className={`chip ${c.status === 'scheduled' ? 'is-scheduled' : c.status === 'kept' ? 'is-published' : 'is-draft'}`}>{CONCEPT_STATUS_LABEL[c.status]}</span>
      </header>
      <h3>{c.title}</h3>
      <p className="hook">« {c.hook} »</p>
      <ol className="beats">{c.beats.map((b, i) => <li key={i}>{b}</li>)}</ol>
      <p className="cap">{c.caption} <span className="muted">{c.hashtags.join(' ')}</span></p>
      {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
      <footer className="row concept-actions">
        {c.status === 'scheduled' ? (
          <Link className="btn btn-ghost btn-sm" href={`/calendrier?mois=${(postDate ?? '').slice(0, 7)}`}>
            {postDate ? `Voir le ${formatLongFr(postDate)}` : 'Voir le calendrier'}
          </Link>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy}
              onClick={() => start(async () => { const r = await scheduleConcept(c.id); setMsg(r ? { ok: r.ok, text: r.ok ? `Ajouté en brouillon : ${r.message}.` : r.message } : null); })}>
              Envoyer au calendrier
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-pressed={c.status === 'kept'}
              onClick={() => start(() => setConceptStatus(c.id, c.status === 'kept' ? 'idea' : 'kept'))}>
              {c.status === 'kept' ? 'Ne plus garder' : 'Garder'}
            </button>
          </>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Copié' : 'Copier'}</button>
        <span className="spacer" />
        {!confirm ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>Supprimer</button>
        ) : (
          <>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => start(() => deleteConcept(c.id))}>Oui, supprimer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Non</button>
          </>
        )}
      </footer>
    </article>
  );
}
