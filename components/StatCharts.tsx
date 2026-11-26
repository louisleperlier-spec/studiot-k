'use client';
import { useEffect, useRef, useState } from 'react';
import { COUNTRIES, flag } from '@/lib/geo/countries';

const regionName = (cc: string) => {
  try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(cc) ?? cc; } catch { return COUNTRIES[cc]?.name ?? cc; }
};
import type { Gender, Territory } from '@/lib/types';

const nf = new Intl.NumberFormat('fr-CA');
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
const pct = (v: number) => `${(v * 100).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round "nice" step for an axis spanning `span` with about `n` ticks. */
function niceStep(span: number, n = 4) {
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

/* ---------- Courbe des abonnés ---------- */

export function FollowersChart({ points, color }: { points: { date: string; followers: number }[]; color: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, pad = { l: 52, r: 16, t: 16, b: 28 };
  const W = Math.max(width, 280);
  const vals = points.map(p => p.followers);
  const min = Math.min(...vals), max = Math.max(...vals);
  const step = niceStep(Math.max(max - min, max * 0.1, 10));
  const lo = Math.max(0, Math.floor(min / step) * step - (min === max ? step : 0)), hi = Math.ceil(max / step) * step + (min === max ? step : 0);
  const x = (i: number) => pad.l + (points.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.followers).toFixed(1)}`).join('');
  const area = points.length > 1 ? `${line}L${x(points.length - 1)},${H - pad.b}L${x(0)},${H - pad.b}Z` : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((W - pad.l) / 70))));
  const h = hover !== null ? points[hover] : null;
  const prev = hover ? points[hover - 1] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };

  return (
    <div ref={ref} className="chart" style={{ '--series': color } as React.CSSProperties}>
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label={`Abonnés du ${shortDate(points[0].date)} au ${shortDate(points.at(-1)!.date)} : de ${nf.format(vals[0])} à ${nf.format(vals.at(-1)!)}`}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="fol-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map(t => (
            <g key={t}>
              <line className="grid-l" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text className="ax" x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end">{nf.format(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={p.date} className="ax" x={x(i)} y={H - 8} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}>{shortDate(p.date)}</text>
          ))}
          {area && <path d={area} fill="url(#fol-fill)" />}
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {h && <line className="cross" x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={H - pad.b} />}
          {points.map((p, i) => (
            <circle key={p.date} cx={x(i)} cy={y(p.followers)} r={hover === i ? 5.5 : i === points.length - 1 ? 4.5 : 0}
              fill={color} stroke="var(--bg)" strokeWidth="2" />
          ))}
          {hover === null && (
            <text className="lab" x={x(points.length - 1) - 8} y={y(vals.at(-1)!) - 12} textAnchor="end">{nf.format(vals.at(-1)!)}</text>
          )}
        </svg>
      )}
      {h && (
        <div className="tip" style={{ left: Math.min(Math.max(x(hover!), 70), W - 70), top: y(h.followers) - 12 }}>
          <span className="muted">{shortDate(h.date)}</span>
          <b>{nf.format(h.followers)} abonnés</b>
          {prev && <span className={h.followers >= prev.followers ? 'up' : 'down'}>{h.followers >= prev.followers ? '+' : ''}{nf.format(h.followers - prev.followers)} sur la veille</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Heures actives ---------- */

export function HoursChart({ hours, peak, window }: { hours: number[]; peak: number; window: { from: number; to: number } }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 170, pad = { l: 4, r: 4, t: 10, b: 24 };
  const W = Math.max(width, 260);
  const max = Math.max(...hours, 1);
  const slot = (W - pad.l - pad.r) / 24, bw = Math.max(3, slot - 2);
  const inWin = (h: number) => (window.from < window.to ? h >= window.from && h < window.to : h >= window.from || h < window.to);
  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label={`Abonnés actifs par heure, pic à ${peak} h`} onPointerLeave={() => setHover(null)}>
          <line className="grid-l" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
          {hours.map((v, h) => {
            const bh = Math.max(2, (v / max) * (H - pad.t - pad.b));
            const x0 = pad.l + h * slot + (slot - bw) / 2;
            return (
              <g key={h} onPointerEnter={() => setHover(h)}>
                <rect x={pad.l + h * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
                <path className={`bar${inWin(h) ? ' is-hot' : ''}${hover === h ? ' is-hover' : ''}`}
                  d={`M${x0},${H - pad.b}V${H - pad.b - bh + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${H - pad.b}Z`} />
                {h % (W < 420 ? 6 : 3) === 0 && <text className="ax" x={x0 + bw / 2} y={H - 8} textAnchor="middle">{h} h</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <div className="tip" style={{ left: Math.min(Math.max(pad.l + hover * slot + slot / 2, 70), W - 70), top: pad.t + 4 }}>
          <span className="muted">{hover} h – {(hover + 1) % 24} h</span>
          <b>{nf.format(hours[hover])} actifs</b>
        </div>
      )}
    </div>
  );
}

/* ---------- Genre ---------- */

export function GenderBar({ g }: { g: Gender }) {
  const parts = [
    { k: 'male', label: 'Hommes', v: g.male, cls: 's1' },
    { k: 'female', label: 'Femmes', v: g.female, cls: 's2' },
    { k: 'other', label: 'Autre', v: g.other, cls: 's3' },
  ].filter(p => p.v > 0);
  return (
    <div className="gender">
      <div className="gbar" role="img" aria-label={parts.map(p => `${p.label} ${pct(p.v)}`).join(', ')}>
        {parts.map(p => <i key={p.k} className={p.cls} style={{ flexGrow: p.v }} title={`${p.label} : ${pct(p.v)}`} />)}
      </div>
      <div className="legend">
        {parts.map(p => <span key={p.k}><i className={p.cls} />{p.label} <b>{pct(p.v)}</b></span>)}
      </div>
    </div>
  );
}

/* ---------- Pays ---------- */

export function Territories({ list }: { list: Territory[] }) {
  const max = Math.max(...list.map(t => t.share), 0.0001);
  const shown = [...list.filter(t => t.cc !== 'other').slice(0, 7), ...list.filter(t => t.cc === 'other')];
  return (
    <ul className="terr">
      {shown.map(t => (
        <li key={t.cc}>
          <span className="terr-n">{t.cc === 'other' ? '🌐' : flag(t.cc)} {t.cc === 'other' ? 'Autres pays' : regionName(t.cc)}</span>
          <span className="terr-b"><i style={{ width: `${(t.share / max) * 100}%` }} /></span>
          <b>{pct(t.share)}</b>
        </li>
      ))}
    </ul>
  );
}
