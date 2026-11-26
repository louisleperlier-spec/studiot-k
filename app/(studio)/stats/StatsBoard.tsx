'use client';
import Link from 'next/link';
import { useActionState, useMemo, useRef, useState, useTransition } from 'react';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { Who } from '@/components/bits';
import { FollowersChart, GenderBar, HoursChart, Territories } from '@/components/StatCharts';
import {
  addFollowerAction, addRevenueAction, deleteFollowerAction, deleteRevenueAction, importTikTokAction, loadStarterStats,
} from '@/app/actions';
import { bestHours, growth } from '@/lib/tiktok';
import {
  CURRENCIES, REVENUE_SOURCES, STAT_SOURCE_LABEL,
  type Audience, type Character, type FollowerPoint, type Revenue,
} from '@/lib/types';

interface Props {
  characters: Character[];
  current: Character;
  followers: FollowerPoint[];
  audience: Audience | null;
  revenues: Revenue[];
  today: string;
  syncReady: boolean;
  empty: boolean;
}

const nf = new Intl.NumberFormat('fr-CA');
const money = (v: number, cur: string) => {
  try { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: cur, currencyDisplay: 'code' }).format(v); }
  catch { return `${nf.format(v)} ${cur}`; }
};
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
const sourceLabel = (id: string) => REVENUE_SOURCES.find(s => s.id === id)?.label ?? id;

export function StatsBoard({ characters, current, followers, audience, revenues, today, syncReady, empty }: Props) {
  const g = growth(followers, 7);
  const best = audience ? bestHours(audience.hours) : null;
  const byId = useMemo(() => Object.fromEntries(characters.map(c => [c.id, c])), [characters]);
  const totals = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of revenues) t.set(r.currency, (t.get(r.currency) ?? 0) + r.amount);
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [revenues]);
  const bySource = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of revenues) { const k = `${r.source}|${r.currency}`; t.set(k, (t.get(k) ?? 0) + r.amount); }
    return [...t.entries()].map(([k, v]) => ({ source: k.split('|')[0], currency: k.split('|')[1], v })).sort((a, b) => b.v - a.v);
  }, [revenues]);
  const [starting, startSeed] = useTransition();

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Croissance</div><h1>Stats</h1></div>
        <nav className="seg" aria-label="Personnage">
          {characters.map(c => (
            <Link key={c.id} href={`/stats?perso=${c.id}`} aria-current={c.id === current.id ? 'true' : undefined}>{c.name}</Link>
          ))}
        </nav>
      </div>

      {empty && (
        <GlassPanel tone="dark" className="panel starter" radius={20}>
          <div>
            <b>Tes premiers chiffres sont prêts</b>
            <p className="muted">Compte Saint Tabarnouche : abonnés du 19 au 25 nov. (4 384 → 8 941), audience, heures actives et 97 USD de cadeaux TikTok.</p>
          </div>
          <button className="btn btn-primary" disabled={starting} onClick={() => startSeed(() => loadStarterStats())}>
            {starting ? 'Chargement…' : 'Charger ces chiffres'}
          </button>
        </GlassPanel>
      )}

      <div className="grid g-4">
        <GlassPanel tone="dark" className="panel metric" radius={20}>
          <span className="muted">Abonnés TikTok</span>
          <b>{g ? nf.format(g.last.followers) : '–'}</b>
          <span className="sub">{g ? `au ${longDate(g.last.date)}` : 'aucun relevé'}</span>
        </GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}>
          <span className="muted">Gagnés sur 7 jours</span>
          <b className={g && g.gained < 0 ? 'down' : ''}>{g && g.base !== g.last ? `${g.gained >= 0 ? '+' : ''}${nf.format(g.gained)}` : '–'}</b>
          <span className="sub">{g && g.base !== g.last ? `${g.gained >= 0 ? '+' : ''}${(g.pct * 100).toLocaleString('fr-CA', { maximumFractionDigits: 0 })} % depuis le ${longDate(g.base.date).replace(/ \d{4}$/, '')}` : 'il faut au moins 2 relevés'}</span>
        </GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}>
          <span className="muted">Revenus cumulés</span>
          <b>{totals.length ? money(totals[0][1], totals[0][0]) : '–'}</b>
          <span className="sub">{totals.length > 1 ? totals.slice(1).map(([c, v]) => `+ ${money(v, c)}`).join(' ') : `${revenues.length} entrée${revenues.length > 1 ? 's' : ''}, tous personnages`}</span>
        </GlassPanel>
        <GlassPanel tone="dark" className="panel metric" radius={20}>
          <span className="muted">Meilleure heure pour publier</span>
          <b>{best ? `${best.peak} h` : '–'}</b>
          <span className="sub">{best ? `pic d'activité de ${best.from} h à ${best.to} h` : 'importe FollowerActivity'}</span>
        </GlassPanel>
      </div>

      <div className="grid g-main">
        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h">
            <h2>Abonnés <Who c={current} /></h2>
            {followers.length > 0 && <span className="muted mono">{STAT_SOURCE_LABEL[followers.at(-1)!.source]}</span>}
          </div>
          {followers.length ? (
            <FollowersChart points={followers} color={current.color} />
          ) : (
            <div className="empty"><p>Aucun relevé pour {current.name}. Importe l&apos;export TikTok ou ajoute un chiffre ci-dessous.</p></div>
          )}
          <FollowerForm characterId={current.id} today={today} />
          {followers.length > 0 && <FollowerTable points={followers} characterId={current.id} />}
        </GlassPanel>

        <div className="stack">
          <ImportPanel current={current} />
          <SyncPanel ready={syncReady} characters={characters} />
        </div>
      </div>

      <div className="grid g-2">
        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h"><h2>Audience</h2>{audience && <span className="muted mono">{STAT_SOURCE_LABEL[audience.source]}</span>}</div>
          {audience?.gender || audience?.territories.length ? (
            <div className="aud">
              {audience.gender && <div><h3 className="h3">Genre</h3><GenderBar g={audience.gender} /></div>}
              {audience.territories.length > 0 && <div><h3 className="h3">Pays</h3><Territories list={audience.territories} /></div>}
            </div>
          ) : (
            <div className="empty"><p>Importe FollowerGender et FollowerTopTerritories pour voir qui te suit.</p></div>
          )}
        </GlassPanel>
        <GlassPanel tone="dark" className="panel" radius={22}>
          <div className="panel-h">
            <h2>Heures actives</h2>
            {audience && audience.hoursDays > 0 && <span className="muted mono">moyenne sur {audience.hoursDays} jours</span>}
          </div>
          {best && audience ? (
            <>
              <HoursChart hours={audience.hours} peak={best.peak} window={best} />
              <p className="muted small">Heures telles que TikTok les exporte. Tes posts partent à 18:00 par défaut{best.from <= 18 && 18 < best.from + 4 ? ', en plein dans le pic' : ''}.</p>
            </>
          ) : (
            <div className="empty"><p>Importe FollowerActivity pour savoir quand tes abonnés sont en ligne.</p></div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel tone="dark" className="panel" radius={22}>
        <div className="panel-h"><h2>Revenus</h2><span className="muted">Cadeaux TikTok, Whop, Shopify… saisis à la main tant que rien n&apos;est branché</span></div>
        <div className="rev-grid">
          <RevenueForm characters={characters} current={current} today={today} />
          <div className="rev-side">
            {bySource.length > 0 && (
              <div className="rev-sources">
                {bySource.map(s => (
                  <span key={`${s.source}${s.currency}`} className="rev-src"><small>{sourceLabel(s.source)}</small><b>{money(s.v, s.currency)}</b></span>
                ))}
              </div>
            )}
            {revenues.length ? (
              <table className="tbl">
                <thead><tr><th>Date</th><th>Source</th><th>Personnage</th><th className="num">Montant</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {revenues.slice(0, 50).map(r => <RevenueRow key={r.id} r={r} c={byId[r.characterId]} />)}
                </tbody>
              </table>
            ) : (
              <div className="empty"><p>Aucun revenu pour l&apos;instant.</p></div>
            )}
          </div>
        </div>
      </GlassPanel>
    </>
  );
}

function Notice({ res }: { res: { ok: boolean; message: string } | null }) {
  return res ? <p className={`notice ${res.ok ? 'ok' : 'err'}`} role="status">{res.message}</p> : null;
}

function FollowerForm({ characterId, today }: { characterId: string; today: string }) {
  const [res, action, pending] = useActionState(addFollowerAction, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="characterId" value={characterId} />
      <label className="field"><span>Date</span><input className="input" type="date" name="date" defaultValue={today} max={today} required /></label>
      <label className="field"><span>Abonnés</span><input className="input" name="followers" inputMode="numeric" pattern="[0-9 ]+" placeholder="ex. 9 120" required /></label>
      <button className="btn btn-ghost" disabled={pending}>{pending ? '…' : 'Ajouter le relevé'}</button>
      <Notice res={res} />
    </form>
  );
}

function FollowerTable({ points, characterId }: { points: FollowerPoint[]; characterId: string }) {
  const [busy, start] = useTransition();
  return (
    <details className="tbl-wrap">
      <summary>Voir les {points.length} relevés</summary>
      <table className="tbl">
        <thead><tr><th>Date</th><th className="num">Abonnés</th><th className="num">Écart</th><th>Source</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {[...points].reverse().map((p, i, arr) => {
            const prev = arr[i + 1];
            const d = prev ? p.followers - prev.followers : null;
            return (
              <tr key={p.date}>
                <td>{longDate(p.date)}</td>
                <td className="num">{nf.format(p.followers)}</td>
                <td className={`num ${d !== null && d < 0 ? 'down' : 'up'}`}>{d === null ? '' : `${d >= 0 ? '+' : ''}${nf.format(d)}`}</td>
                <td className="muted">{STAT_SOURCE_LABEL[p.source]}</td>
                <td><button className="x-btn" disabled={busy} aria-label={`Supprimer le relevé du ${longDate(p.date)}`} onClick={() => start(() => deleteFollowerAction(characterId, p.date))}>×</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function ImportPanel({ current }: { current: Character }) {
  const [res, action, pending] = useActionState(importTikTokAction, null);
  const [names, setNames] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  return (
    <GlassPanel tone="dark" className="panel" radius={22}>
      <div className="panel-h"><h2>Importer depuis TikTok</h2></div>
      <form action={action} className="form">
        <input type="hidden" name="characterId" value={current.id} />
        <label className="drop">
          <input ref={input} type="file" name="files" accept=".zip,.csv,text/csv,application/zip" multiple hidden
            onChange={e => setNames([...(e.target.files ?? [])].map(f => f.name))} />
          <b>{names.length ? names.join(', ') : 'Choisis le zip ou les CSV'}</b>
          <small>FollowerHistory, FollowerActivity, FollowerGender, FollowerTopTerritories</small>
        </label>
        <p className="muted small">Dans TikTok Studio : Analyses → Abonnés → Exporter les données. Ça s&apos;ajoute à <Who c={current} />, et un jour déjà présent est remplacé.</p>
        <button className="btn btn-primary" disabled={pending || !names.length}>{pending ? 'Import…' : 'Importer'}</button>
        <Notice res={res} />
      </form>
    </GlassPanel>
  );
}

function SyncPanel({ ready, characters }: { ready: boolean; characters: Character[] }) {
  return (
    <GlassPanel tone="dark" className="panel" radius={22}>
      <div className="panel-h">
        <h2>Synchro Process</h2>
        <span className={`chip ${ready ? 'is-scheduled' : 'is-draft'}`}>{ready ? 'Prête' : 'À activer'}</span>
      </div>
      <p className="muted small">
        Quand ton TikTok est connecté dans Process, Claude peut lire tes abonnés et tes ventes et les envoyer ici, par exemple chaque matin.
        {ready ? ' La porte est ouverte : il suffit de lancer la tâche planifiée.' : ' Pour ouvrir la porte, ajoute STATS_API_TOKEN dans les variables Vercel.'}
      </p>
      <details className="tbl-wrap">
        <summary>Détail technique</summary>
        <pre className="code">{`POST /api/stats
Authorization: Bearer <STATS_API_TOKEN>
{
  "characterId": "${characters[0]?.id ?? 'tarbanouche'}",
  "followers": [{ "date": "2026-11-26", "followers": 9100 }],
  "revenues": [{ "date": "2026-11-26", "amount": 12,
    "currency": "USD", "source": "whop", "ref": "whop_123" }]
}`}</pre>
      </details>
    </GlassPanel>
  );
}

function RevenueForm({ characters, current, today }: { characters: Character[]; current: Character; today: string }) {
  const [res, action, pending] = useActionState(addRevenueAction, null);
  return (
    <form action={action} className="form">
      <div className="row-2">
        <label className="field"><span>Montant</span><input className="input" name="amount" inputMode="decimal" placeholder="97" required /></label>
        <label className="field"><span>Devise</span>
          <select className="input" name="currency" defaultValue="USD">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
        </label>
      </div>
      <div className="row-2">
        <label className="field"><span>Source</span>
          <select className="input" name="source" defaultValue="tiktok-cadeaux">{REVENUE_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
        <label className="field"><span>Date</span><input className="input" type="date" name="date" defaultValue={today} required /></label>
      </div>
      <label className="field"><span>Personnage</span>
        <select className="input" name="characterId" defaultValue={current.id}>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">Les deux / aucun</option>
        </select>
      </label>
      <label className="field"><span>Note</span><input className="input" name="note" maxLength={300} placeholder="ex. pack d'autocollants, live du dimanche" /></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? '…' : 'Ajouter le revenu'}</button>
      <Notice res={res} />
    </form>
  );
}

function RevenueRow({ r, c }: { r: Revenue; c?: Character }) {
  const [busy, start] = useTransition();
  return (
    <tr aria-busy={busy}>
      <td>{longDate(r.date)}</td>
      <td>{sourceLabel(r.source)}{r.note && <small className="muted block">{r.note}</small>}</td>
      <td>{c ? <Who c={c} /> : <span className="muted">–</span>}</td>
      <td className="num">{money(r.amount, r.currency)}</td>
      <td><button className="x-btn" disabled={busy} aria-label="Supprimer ce revenu" onClick={() => start(() => deleteRevenueAction(r.id))}>×</button></td>
    </tr>
  );
}
