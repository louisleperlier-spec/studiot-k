import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { SalesGlobe, type GlobeSpot } from '@/components/SalesGlobe';

export const metadata = { title: 'Revenus' };

// Exemple affiché tant que Whop et Shopify ne sont pas branchés (étape 3).
const now = new Date().toISOString();
const EXAMPLE: GlobeSpot[] = [
  { cc: 'FR', value: 1240, lastSale: now }, { cc: 'CA', value: 860 }, { cc: 'BE', value: 410 },
  { cc: 'CH', value: 290 }, { cc: 'US', value: 260, lastSale: now }, { cc: 'MA', value: 150 },
  { cc: 'SN', value: 90 }, { cc: 'CI', value: 70 }, { cc: 'RE', value: 55 }, { cc: 'GB', value: 40 },
];

export default function RevenusPage() {
  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Ventes de produits digitaux</div><h1>Revenus</h1></div>
        <span className="demo-flag">Exemple : branche Whop et Shopify pour voir tes vraies ventes</span>
      </div>
      <div className="srcs">
        <GlassPanel tone="dark" className="src" radius={18}>
          <span className="src-logo" style={{ background: 'linear-gradient(140deg,#ff6a3d,#ff3d7f)' }}>W</span>
          <span><b>Whop</b><small>Produits digitaux, abonnements, club privé</small></span>
          <button className="btn btn-ghost btn-sm" disabled title="Arrive à l'étape 3">Connecter (étape 3)</button>
        </GlassPanel>
        <GlassPanel tone="dark" className="src" radius={18}>
          <span className="src-logo" style={{ background: 'linear-gradient(140deg,#95bf47,#5e8e3e)' }}>S</span>
          <span><b>Shopify</b><small>Boutique, packs et produits physiques</small></span>
          <button className="btn btn-ghost btn-sm" disabled title="Arrive à l'étape 3">Connecter (étape 3)</button>
        </GlassPanel>
      </div>
      <GlassPanel tone="dark" className="panel" radius={22}>
        <div className="panel-h"><h2>Planète des ventes</h2><span className="muted">Fais-la tourner, touche un pays</span></div>
        <SalesGlobe spots={EXAMPLE} />
      </GlassPanel>
    </>
  );
}
