'use client';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './folder-fan.css';

export interface FanItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Up to 3 sheet covers: image URL or any CSS background (gradient, colour). */
  covers?: string[];
  /** Round avatar on the pocket: image URL or CSS background. */
  avatar?: string;
  /** Green live dot on the tab. */
  live?: boolean;
}

export interface FolderFanProps {
  items: FanItem[];
  /** Called when the focused folder changes (`viaClick` true when pressed). */
  onSelect?: (item: FanItem | null, index: number, viaClick: boolean) => void;
  initialIndex?: number;
  /** Accent of the opened folder. Default green. */
  accent?: 'green' | 'blue' | 'violet' | 'amber';
  /** Accessible name of the listbox. */
  ariaLabel?: string;
  /** Show "3 / 12" under the fan. Default true. */
  showPosition?: boolean;
  /** Stage height in px (desktop). Default 480. */
  height?: number;
}

type Geo = { w: number; h: number; step: number; baseRot: number; focusRot: number };
const DESKTOP: Geo = { w: 184, h: 226, step: 74, baseRot: -58, focusRot: -30 };
const MOBILE: Geo = { w: 128, h: 158, step: 46, baseRot: -56, focusRot: -30 };
const SPAN = 5.5, TAIL = 0.07, DETAIL_REACH = 22;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
const rad = (deg: number) => (deg * Math.PI) / 180;
const spread = (d: number, g: Geo) => g.step * (SPAN * Math.tanh(d / SPAN) + TAIL * d);
function fanExtent(n: number, g: Geo) {
  if (n <= 1) return g.w * 0.7;
  const half = (n - 1) / 2;
  return spread(half, g) - spread(-half, g) + g.w * 0.7;
}
/** Where a folder sits `d` slots from the focus: the focused one turns to the viewer and rises, the rest sink in a wave. */
function layout(d: number, g: Geo) {
  const near = Math.exp(-(d * d) / 1.3);
  const opened = g.w * (Math.cos(rad(g.focusRot)) - Math.cos(rad(g.baseRot)));
  const x = spread(d, g) + opened * smooth(d);
  const y = 14 * (1 - Math.exp(-(d * d) / 10)) - 16 * near;
  return { x, y, rot: g.baseRot + (g.focusRot - g.baseRot) * near, z: 64 * near, scale: 1 + 0.05 * near };
}
const isPaint = (v: string) => /gradient\(|^#|^rgb|^hsl|^oklch|^color\(/i.test(v.trim());
const bg = (v?: string): CSSProperties | undefined => (!v ? undefined : isPaint(v) ? { background: v } : { backgroundImage: `url("${v}")` });

/** 3D deck of folders fanned like cards. Drag, swipe, wheel or arrow keys to scrub; the focused folder opens and its sheets slide up. */
export function FolderFan({ items, onSelect, initialIndex = 0, accent = 'green', ariaLabel = 'Folders', showPosition = true, height = 480 }: FolderFanProps) {
  const count = items.length;
  const [selected, setSelected] = useState(() => clamp(initialIndex, 0, Math.max(0, count - 1)));
  const [narrow, setNarrow] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const target = useRef(clamp(initialIndex, 0, Math.max(0, count - 1)));
  const cur = useRef<number[]>([]);
  const vel = useRef<number[]>([]);
  const hov = useRef<number[]>([]);
  const hovered = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: -1, y: -1 });
  const raf = useRef<number | null>(null);
  const lastT = useRef(0);
  const reduced = useRef(false);
  const narrowRef = useRef(false);
  narrowRef.current = narrow;
  const countRef = useRef(count);
  countRef.current = count;
  const stageSize = useRef({ w: 0, h: 0 });
  const painted = useRef<{ z: string; o: string; s: string }[]>([]);
  const kTarget = useRef(1);
  const kCur = useRef<number | null>(null);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mq = window.matchMedia('(max-width: 720px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const paint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!stageSize.current.w) stageSize.current = { w: stage.clientWidth, h: stage.clientHeight };
    const { w: W, h: H } = stageSize.current;
    const g = narrowRef.current ? MOBILE : DESKTOP;
    const n = countRef.current;
    const pivot = Math.round(clamp(target.current, 0, Math.max(0, n - 1)));
    const f = cur.current[pivot] ?? target.current;
    const fitH = (H - 70) / (narrowRef.current ? 300 : 400);
    const fitW = (W - 36) / fanExtent(n, g);
    kTarget.current = clamp(Math.min(fitH, fitW), 0.5, 1);
    if (kCur.current == null) kCur.current = kTarget.current;
    const k = kCur.current;
    const first = layout(0 - f, g).x * k;
    const last = layout(Math.max(0, n - 1) - f, g).x * k;
    const cx = W / 2 - (first + last) / 2;
    const cy = H * 0.56 + 18;
    for (let i = 0; i < nodes.current.length; i += 1) {
      const el = nodes.current[i];
      if (!el) continue;
      const d = i - (cur.current[i] ?? target.current);
      const l = layout(d, g);
      const h = hov.current[i] ?? 0;
      const lean = clamp(-(vel.current[i] ?? 0) * 0.55, -5, 5);
      const x = cx + l.x * k - g.w / 2;
      const y = cy + (l.y - 28 * h - Math.abs(lean) * 0.5) * k - g.h / 2;
      const z = (l.z + 40 * h) * k;
      el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${l.rot + 8 * h}deg) rotateZ(${lean}deg) scale(${(l.scale + 0.02 * h) * k})`;
      const ad = Math.abs(d);
      const seen = (painted.current[i] ||= { z: '', o: '', s: '' });
      const zi = String(1000 - Math.round(ad * 10));
      if (seen.z !== zi) { el.style.zIndex = zi; seen.z = zi; }
      const o = clamp(1 - Math.max(0, ad - 5) * 0.08, 0.3, 1).toFixed(3);
      if (seen.o !== o) { el.style.opacity = o; seen.o = o; }
      const sh = (clamp((ad - 0.6) * 0.06, 0, 0.36) * (1 - h)).toFixed(3);
      if (seen.s !== sh) { const shade = el.lastElementChild as HTMLElement | null; if (shade) shade.style.opacity = sh; seen.s = sh; }
    }
  }, []);

  const settle = useCallback(() => {
    const idx = clamp(Math.round(target.current), 0, Math.max(0, countRef.current - 1));
    setSelected(prev => (prev === idx ? prev : idx));
  }, []);

  const tick = useCallback((now: number) => {
    const gap = now - (lastT.current || now);
    const dt = clamp(gap / 1000 || 0.016, 0.001, 0.05);
    lastT.current = now;
    const snap = reduced.current || gap > 250 || document.visibilityState === 'hidden';
    const n = countRef.current;
    const tgt = target.current;
    const pivot = Math.round(clamp(tgt, 0, Math.max(0, n - 1)));
    let active = false;
    for (let i = 0; i < n; i += 1) {
      const prev = cur.current[i] ?? tgt;
      if (snap) { cur.current[i] = tgt; vel.current[i] = 0; }
      else {
        // folders further from the pivot follow later: the move ripples like a wave
        const rate = 19 - Math.min(Math.abs(i - pivot), 6) * 1.2;
        const next = prev + (tgt - prev) * (1 - Math.exp(-rate * dt));
        vel.current[i] = (next - prev) / dt;
        cur.current[i] = Math.abs(tgt - next) < 0.0008 ? tgt : next;
      }
      const ht = hovered.current === i ? 1 : 0;
      const hp = hov.current[i] ?? 0;
      const hn = snap ? ht : hp + (ht - hp) * (1 - Math.exp(-16 * dt));
      hov.current[i] = Math.abs(ht - hn) < 0.002 ? ht : hn;
      if (cur.current[i] !== tgt || hov.current[i] !== ht) active = true;
    }
    const kt = kTarget.current, kc = kCur.current ?? kt;
    const kn = snap ? kt : kc + (kt - kc) * (1 - Math.exp(-11 * dt));
    kCur.current = Math.abs(kt - kn) < 0.0015 ? kt : kn;
    if (kCur.current !== kt) active = true;
    paint();
    if (!active) {
      for (let i = 0; i < n; i += 1) vel.current[i] = 0;
      paint();
      raf.current = null;
      lastT.current = 0;
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [paint]);

  const kick = useCallback(() => { if (raf.current == null) raf.current = requestAnimationFrame(tick); }, [tick]);
  const goTo = useCallback((idx: number) => { target.current = clamp(idx, 0, Math.max(0, countRef.current - 1)); settle(); kick(); }, [settle, kick]);

  useEffect(() => {
    target.current = clamp(target.current, 0, Math.max(0, count - 1));
    for (let i = 0; i < count; i += 1) {
      if (cur.current[i] == null) cur.current[i] = target.current;
      if (hov.current[i] == null) hov.current[i] = 0;
    }
    cur.current.length = count; vel.current.length = count; hov.current.length = count;
    settle(); kick();
  }, [count, settle, kick]);

  useLayoutEffect(() => { paint(); }, [selected, narrow, paint]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      stageSize.current = { w: box?.width || stage.clientWidth, h: box?.height || stage.clientHeight };
      paint(); kick();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [paint, kick]);

  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null; lastT.current = 0; }, []);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const clicked = useRef(false);
  const current = items[selected] ?? null;
  useEffect(() => { onSelectRef.current?.(current, selected, clicked.current); clicked.current = false; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  /* Pointer: press a folder to select, drag to scrub with a fling. */
  const drag = useRef<{ x: number; start: number; moved: boolean; lastX: number; lastT: number; v: number; index: number | null } | null>(null);
  const cleanupDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupDrag.current?.(), []);

  function setHover(i: number | null) { if (hovered.current === i) return; hovered.current = i; kick(); }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const folder = (e.target as HTMLElement).closest<HTMLElement>('.tk-ff-folder');
    const index = folder ? Number(folder.dataset.index) : null;
    drag.current = { x: e.clientX, start: target.current, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0, index };
    dragging.current = true;
    setHover(null);
    const g = narrowRef.current ? MOBILE : DESKTOP;
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 5) d.moved = true;
      if (!d.moved) return;
      const now = performance.now();
      d.v = (ev.clientX - d.lastX) / Math.max(1, now - d.lastT);
      d.lastX = ev.clientX; d.lastT = now;
      target.current = clamp(d.start + dx / g.step, -0.35, countRef.current - 0.65);
      settle(); kick();
    };
    const up = () => {
      off();
      dragging.current = false;
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (!d.moved) {
        if (d.index != null) {
          clicked.current = true;
          goTo(d.index);
          if (d.index === Math.round(target.current)) onSelectRef.current?.(itemsRef.current[d.index] ?? null, d.index, true);
          clicked.current = false;
        }
        return;
      }
      goTo(Math.round(target.current + (d.v * 90) / g.step));
    };
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cleanupDrag.current = null;
    };
    cleanupDrag.current?.();
    cleanupDrag.current = off;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragging.current) return;
    if (e.clientX === lastMouse.current.x && e.clientY === lastMouse.current.y) return;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const folder = (e.target as HTMLElement).closest<HTMLElement>('.tk-ff-folder');
    setHover(folder ? Number(folder.dataset.index) : null);
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let idle: number | null = null;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const g = narrowRef.current ? MOBILE : DESKTOP;
      target.current = clamp(target.current + e.deltaX / (g.step * 1.4), -0.35, countRef.current - 0.65);
      settle(); kick();
      if (idle != null) window.clearTimeout(idle);
      idle = window.setTimeout(() => goTo(Math.round(target.current)), 110);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => { stage.removeEventListener('wheel', onWheel); if (idle != null) window.clearTimeout(idle); };
  }, [kick, settle, goTo]);

  function onKeyDown(e: React.KeyboardEvent) {
    const at = Math.round(target.current);
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(count - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRef.current?.(current, selected, true); }
  }

  const register = useCallback((index: number, el: HTMLDivElement | null) => {
    nodes.current[index] = el;
    painted.current[index] = { z: '', o: '', s: '' };
  }, []);

  return (
    <section className={`tk-ff tk-ff--${accent}`}>
      <div ref={stageRef} className="tk-ff-stage" style={{ '--tk-ff-h': `${height}px` } as CSSProperties} tabIndex={0} role="listbox" aria-label={ariaLabel}
        aria-activedescendant={current ? `tk-ff-${current.id}` : undefined}
        onPointerDown={onPointerDown} onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)} onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <Folder key={item.id} item={item} index={i} selected={i === selected} detail={Math.abs(i - selected) <= DETAIL_REACH} register={register} />
        ))}
      </div>
      {showPosition && count > 1 && <p className="tk-ff-pos" role="status">{selected + 1} / {count}</p>}
    </section>
  );
}

const Folder = memo(function Folder({ item, index, selected, detail, register }: { item: FanItem; index: number; selected: boolean; detail: boolean; register: (i: number, el: HTMLDivElement | null) => void }) {
  const covers = (item.covers ?? []).slice(0, 3);
  return (
    <div id={`tk-ff-${item.id}`} data-index={index} ref={el => register(index, el)} role="option" aria-selected={selected}
      aria-label={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
      className={`tk-ff-folder${selected ? ' is-selected' : ''}${item.live ? ' is-live' : ''}`}>
      {detail && <div className="tk-ff-glow" aria-hidden="true" />}
      <div className="tk-ff-back" />
      {detail ? (
        <>
          <div className="tk-ff-back-accent" aria-hidden="true" />
          <div className="tk-ff-tab" />
          <div className="tk-ff-docs" aria-hidden="true">
            {[0, 1, 2].map(n => (
              <div key={n} className={`tk-ff-doc${covers[n] ? ' has-cover' : ''}`} style={bg(covers[n])}>
                {!covers[n] && <><i style={{ width: '62%' }} /><i style={{ width: '84%' }} /><i style={{ width: '48%' }} /></>}
              </div>
            ))}
          </div>
        </>
      ) : <div className="tk-ff-tab" />}
      <div className="tk-ff-front">
        {detail && (
          <>
            <div className="tk-ff-front-accent" aria-hidden="true" />
            {item.avatar && <span className="tk-ff-avatar" style={bg(item.avatar)} aria-hidden="true" />}
            {item.subtitle && <div className="tk-ff-sub">{item.subtitle}</div>}
            <div className="tk-ff-label">{item.title}</div>
          </>
        )}
      </div>
      <i className="tk-ff-shade" aria-hidden="true" />
    </div>
  );
});
