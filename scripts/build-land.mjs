// Génère lib/geo/land.json : points des terres (lat, lng aplatis) pour la planète des ventes.
// Usage : node scripts/build-land.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);
const out = [];
const STEP = 1.7; // degrés de latitude entre deux rangées
for (let lat = -58; lat <= 82; lat += STEP) {
  // Même espacement réel partout : moins de points vers les pôles.
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i < n; i++) {
    const lng = -180 + (i + 0.5) * (360 / n);
    if (geoContains(land, [lng, lat])) out.push(+lat.toFixed(2), +lng.toFixed(2));
  }
}
writeFileSync(new URL('../lib/geo/land.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length / 2} points`);
