'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import LAND_FLAT from '@/lib/geo/land.json';
import { COUNTRIES, flag } from '@/lib/geo/countries';

/**
 * Planète des ventes en points (port web du composant SwiftUI MMGlobe) :
 * rotation à inertie autour des pôles, faisceaux par pays proportionnels au revenu,
 * terres qui chauffent autour des ventes, onde sur les ventes de moins de 10 minutes.
 */

export interface GlobeSpot {
  /** Code pays ISO alpha-2. */
  cc: string;
  /** Revenu, dans la devise affichée. */
  value: number;
  /** Date ISO de la dernière vente, pour l'onde des ventes récentes. */
  lastSale?: string | null;
}

type V3 = { x: number; y: number; z: number };
const unit = (lat: number, lng: number): V3 => {
  const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
  return { x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo) };
};
const LAND: V3[] = (() => {
  const f = LAND_FLAT as number[];
  const out: V3[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push(unit(f[i], f[i + 1]));
  return out;
})();

const TILT = 0.32;
const K_DRAG = 0.0085;
const ACCENT = [179, 175, 255]; // violet Process
const HEAT = [94, 234, 212];    // turquoise

/** Chaleur de chaque point de terre : somme gaussienne (~9°) des ventes voisines, normalisée 0–1. */
function computeHeat(spots: GlobeSpot[]): Float32Array {
  const out = new Float32Array(LAND.length);
  const maxV = Math.max(0, ...spots.map(s => s.value));
  if (maxV <= 0) return out;
  const src = spots.flatMap(s => {
    const c = COUNTRIES[s.cc];
    return s.value > 0 && c ? [{ v: unit(c.lat, c.lng), w: s.value / maxV }] : [];
  });
  const spread = 2 * 0.16 * 0.16;
  let top = 0;
  for (let i = 0; i < LAND.length; i++) {
    const p = LAND[i];
    let acc = 0;
    for (const s of src) {
      const d = p.x * s.v.x + p.y * s.v.y + p.z * s.v.z;
      if (d <= 0.9) continue;
      const a = Math.acos(Math.min(1, d));
      acc += s.w * Math.exp((-a * a) / spread);
    }
    out[i] = acc;
    if (acc > top) top = acc;
  }
  if (top > 0) for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / top);
  return out;
}

function GlobeCanvas({ spots, highlight, onSelect }: { spots: GlobeSpot[]; highlight: string | null; onSelect: (cc: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heat = useMemo(() => computeHeat(spots), [spots]);
  const state = useRef({ spin: -0.35, velocity: 0, dragging: false, dragStart: 0, startX: 0, startY: 0, lastX: 0, lastT: 0, vx: 0, moved: false });
  const live = useRef({ spots, heat, highlight });
  live.current = { spots, heat, highlight };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = performance.now(), visible = true, W = 0, H = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: 0.05 });
    io.observe(canvas);

    const project = (v: V3, lift = 1) => {
      const s = state.current, r = Math.min(W, H) / 2 * 0.86;
      const cs = Math.cos(s.spin), sn = Math.sin(s.spin), ct = Math.cos(TILT), st = Math.sin(TILT);
      const x1 = v.x * cs - v.z * sn, z1 = v.x * sn + v.z * cs;
      const y2 = v.y * ct - z1 * st, z2 = v.y * st + z1 * ct;
      return { x: W / 2 + x1 * r * lift, y: H / 2 - y2 * r * lift, z: z2 };
    };

    const draw = (now: number) => {
      const s = state.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.dragging) {
        const cruise = reduce ? 0 : -0.09;
        s.velocity += (cruise - s.velocity) * Math.min(1, dt * 1.6);
        s.spin += s.velocity * dt;
      }
      const { spots, heat, highlight } = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const r = Math.min(W, H) / 2 * 0.86, cx = W / 2, cy = H / 2;

      // Océan
      const og = ctx.createRadialGradient(cx, cy - r * 0.35, 0, cx, cy - r * 0.35, r * 1.1);
      og.addColorStop(0, 'rgb(9 9 12)'); og.addColorStop(1, 'rgb(0 0 0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

      // Terres
      const dot = Math.max(1.1, r / 150);
      const cs = Math.cos(s.spin), sn = Math.sin(s.spin), ct = Math.cos(TILT), st = Math.sin(TILT);
      for (let i = 0; i < LAND.length; i++) {
        const v = LAND[i];
        const z1 = v.x * sn + v.z * cs;
        const z = v.y * st + z1 * ct;
        if (z <= 0.02) continue;
        const x = cx + (v.x * cs - v.z * sn) * r, y = cy - (v.y * ct - z1 * st) * r;
        const depth = Math.min(1, z), edge = Math.min(1, depth / 0.22), w = heat[i] ?? 0;
        const size = dot * (0.45 + 0.55 * Math.sqrt(depth)) * (1 + 0.45 * w);
        if (w > 0.04) ctx.fillStyle = `rgb(${HEAT.join(' ')} / ${((0.3 + 0.7 * w) * (0.35 + 0.65 * depth) * edge * edge).toFixed(3)})`;
        else ctx.fillStyle = `rgb(255 255 255 / ${((0.10 + 0.40 * depth) * edge * edge).toFixed(3)})`;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }

      // Faisceaux, de l'arrière vers l'avant
      const maxV = Math.max(0.0001, ...spots.map(p => p.value));
      const t = now / 1000;
      const placed = spots.flatMap(p => {
        const c = COUNTRIES[p.cc];
        if (!c || p.value <= 0) return [];
        const g = unit(c.lat, c.lng), base = project(g);
        return base.z > -0.05 ? [{ p, g, base }] : [];
      }).sort((a, b) => a.base.z - b.base.z);
      for (const { p, g, base } of placed) {
        const norm = p.value / maxV, fade = Math.max(0, Math.min(1, base.z * 3)), sel = p.cc === highlight;
        const top = project(g, 1.04 + 0.34 * norm + (sel ? 0.06 : 0));
        const tint = sel ? [244, 245, 248] : ACCENT;
        const grad = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
        grad.addColorStop(0, `rgb(${tint.join(' ')} / ${0.95 * fade})`); grad.addColorStop(1, `rgb(${tint.join(' ')} / ${0.05 * fade})`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5 + 3 * norm; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        const gr = 3 + 7 * norm;
        const bg = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, gr);
        bg.addColorStop(0, `rgb(${tint.join(' ')} / ${0.9 * fade})`); bg.addColorStop(1, `rgb(${tint.join(' ')} / 0)`);
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(base.x, base.y, gr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgb(244 245 248 / ${0.9 * fade})`; ctx.beginPath(); ctx.arc(top.x, top.y, 2, 0, Math.PI * 2); ctx.fill();
        if (p.lastSale && Date.now() - new Date(p.lastSale).getTime() < 600_000 && fade > 0) {
          const breath = 0.5 + 0.5 * Math.sin(t * 3), pr = gr * (1.4 + 0.8 * breath);
          const pg = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, pr);
          pg.addColorStop(0, `rgb(${HEAT.join(' ')} / ${0.55 * fade * (0.6 + 0.4 * breath)})`); pg.addColorStop(1, `rgb(${HEAT.join(' ')} / 0)`);
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(base.x, base.y, pr, 0, Math.PI * 2); ctx.fill();
        }
      }

      raf = 0;
      if (visible && !document.hidden && (!reduce || s.dragging || Math.abs(s.velocity) > 0.001)) raf = requestAnimationFrame(draw);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };
    kick();
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);

    // Glissé horizontal : la surface suit le doigt, lancer avec inertie. Un geste vertical laisse défiler la page.
    const down = (e: PointerEvent) => {
      const s = state.current;
      Object.assign(s, { dragging: false, moved: false, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastT: performance.now(), dragStart: s.spin, vx: 0 });
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (!canvas.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
      if (!s.moved) {
        if (Math.hypot(dx, dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { canvas.releasePointerCapture(e.pointerId); return; }
        s.moved = true; s.dragging = true; kick();
      }
      const now = performance.now();
      s.vx = (e.clientX - s.lastX) / Math.max(1, now - s.lastT) * 1000;
      s.lastX = e.clientX; s.lastT = now;
      s.spin = s.dragStart - dx * K_DRAG;
    };
    const up = (e: PointerEvent) => {
      const s = state.current;
      if (s.dragging) {
        s.velocity = Math.max(-6, Math.min(6, -s.vx * K_DRAG));
        s.dragging = false; kick();
      } else if (!s.moved) {
        // Toucher : le pays visible le plus proche (28 px)
        const rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
        let best: { cc: string; d: number } | null = null;
        for (const p of live.current.spots) {
          const c = COUNTRIES[p.cc]; if (!c) continue;
          const q = project(unit(c.lat, c.lng)); if (q.z <= 0.1) continue;
          const d = Math.hypot(q.x - px, q.y - py);
          if (!best || d < best.d) best = { cc: p.cc, d };
        }
        if (best && best.d < 28) onSelectRef.current(best.cc);
      }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  return <canvas ref={canvasRef} className="globe-canvas" role="img" aria-label={`Planète des ventes : ${spots.filter(s => s.value > 0).length} pays`} />;
}

export function SalesGlobe({ spots, currency = 'EUR' }: { spots: GlobeSpot[]; currency?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const total = Math.max(0.0001, spots.reduce((a, s) => a + s.value, 0));
  const ranked = [...spots].filter(s => s.value > 0).sort((a, b) => b.value - a.value);
  const money = (v: number, compact = false) => v.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: compact ? 0 : 2 });
  const cur = ranked.find(s => s.cc === selected);

  return (
    <div className="globe-grid">
      <div className="globe-stage">
        <div className="globe-halo" aria-hidden="true"><i /><i /><i /></div>
        <GlobeCanvas spots={spots} highlight={selected} onSelect={cc => setSelected(cc)} />
        {cur && (
          <div className="globe-pill tk-lg tk-lg--lens" data-tone="dark" role="status">
            <span className="globe-flag" aria-hidden="true">{flag(cur.cc)}</span>
            <span style={{ minWidth: 0 }}><b>{COUNTRIES[cur.cc]?.name ?? cur.cc}</b><small>{Math.round((cur.value / total) * 100)} % du revenu</small></span>
            <span className="mono">{money(cur.value)}</span>
          </div>
        )}
      </div>
      <div className="globe-rank">
        <div className="eyebrow" style={{ padding: '0 4px 8px' }}>Classement</div>
        {ranked.slice(0, 20).map(s => (
          <button key={s.cc} className="rank-row" aria-pressed={selected === s.cc} onClick={() => setSelected(s.cc)}>
            <span className="globe-flag" aria-hidden="true">{flag(s.cc)}</span>
            <span className="rank-main">
              <span className="rank-top"><span>{COUNTRIES[s.cc]?.name ?? s.cc}</span><span className="mono">{money(s.value, true)}</span></span>
              <span className="rank-bar"><i style={{ width: `${Math.max(2, (s.value / ranked[0].value) * 100)}%` }} /></span>
            </span>
          </button>
        ))}
        {!ranked.length && <p className="muted" style={{ padding: 12 }}>Tes premières ventes apparaîtront ici, pays par pays.</p>}
      </div>
    </div>
  );
}
