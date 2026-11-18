import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';

export function ComingSoon({ eyebrow, title, text, step }: { eyebrow: string; title: string; text: string; step: string }) {
  return (
    <>
      <div className="head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div><span className="chip">{step}</span></div>
      <GlassPanel tone="dark" className="coming" radius={22}>
        <div className="orb" aria-hidden="true" />
        <h2>Bientôt ici</h2>
        <p className="muted" style={{ maxWidth: '60ch' }}>{text}</p>
      </GlassPanel>
    </>
  );
}
