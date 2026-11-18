'use client';
import { useEffect, type CSSProperties, type ElementType, type ReactNode } from 'react';
import './liquid-glass.css';

/* Displacement map: red = x, green = y, neutral (#808000) in the centre so
   only the rim refracts, like a real lens edge. Stretched to each element. */
const MAP =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'>" +
      '<defs>' +
      "<linearGradient id='r' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#f00'/></linearGradient>" +
      "<linearGradient id='g' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#0f0'/></linearGradient>" +
      "<filter id='b'><feGaussianBlur stdDeviation='5'/></filter>" +
      '</defs>' +
      "<rect width='100' height='100' fill='url(#r)'/>" +
      "<rect width='100' height='100' fill='url(#g)' style='mix-blend-mode:screen'/>" +
      "<rect x='7' y='7' width='86' height='86' rx='28' fill='#808000' filter='url(#b)'/>" +
      '</svg>',
  );

export interface LiquidGlassDefsProps {
  /** Displacement strength of the rim refraction (negative bends inward). Default -28. */
  scale?: number;
  /** Blur applied inside the lens filter, in px. Default 5. */
  blur?: number;
}

/**
 * Global SVG filter for Liquid Glass edge refraction, plus the engine gate.
 * Render once near the root. Only Chromium renders SVG filters inside
 * backdrop-filter; WebKit and Gecko drop the whole backdrop, so the
 * `tk-lg-refract` class is added to <html> only where it works. Elsewhere the
 * panels keep a clean blur + saturate glass.
 */
export function LiquidGlassDefs({ scale = -28, blur = 5 }: LiquidGlassDefsProps) {
  useEffect(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrom(e|ium)\//.test(ua) && !/CriOS|FxiOS/.test(ua);
    let ok = false;
    try {
      ok = chromium && CSS.supports('backdrop-filter', 'url(#tk-lg-lens)');
    } catch {
      ok = false;
    }
    const root = document.documentElement;
    root.classList.toggle('tk-lg-refract', ok);
    return () => root.classList.remove('tk-lg-refract');
  }, []);

  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id="tk-lg-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" href={MAP} />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feGaussianBlur in="disp" stdDeviation={blur} />
        </filter>
      </defs>
    </svg>
  );
}

export interface GlassPanelProps {
  /** Content of the panel. */
  children?: ReactNode;
  /**
   * `lens`: full material with rim refraction on Chromium (default).
   * `raised`: same material, blur only. `flat`: bar/rail style, hairlines only.
   */
  variant?: 'lens' | 'raised' | 'flat';
  /** Corner radius (any CSS length). Default 24px. */
  radius?: number | string;
  /** Squash slightly when pressed, like an iOS control. Default false. */
  pressable?: boolean;
  /** Force a palette regardless of the page theme. Default `auto` (follows the theme). */
  tone?: 'auto' | 'light' | 'dark';
  /** Element to render. Default `div`. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Extra props forwarded to the element (aria-*, onClick…). */
  [key: string]: unknown;
}

/** iOS 26-style Liquid Glass surface: tint, backdrop blur, specular rims, soft shade. */
export function GlassPanel({ children, variant = 'lens', radius = 24, pressable = false, tone = 'auto', as, className, style, ...rest }: GlassPanelProps) {
  const Tag: ElementType = as ?? 'div';
  const cls = ['tk-lg', `tk-lg--${variant}`, pressable ? 'tk-lg-press' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Tag className={cls} data-tone={tone === 'auto' ? undefined : tone} style={{ borderRadius: typeof radius === 'number' ? `${radius}px` : radius, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
