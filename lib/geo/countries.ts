/** Centre approximatif des pays (lat, lng) pour placer les faisceaux de ventes. Codes ISO 3166-1 alpha-2. */
export const COUNTRIES: Record<string, { name: string; lat: number; lng: number }> = {
  FR: { name: 'France', lat: 46.6, lng: 2.4 }, BE: { name: 'Belgique', lat: 50.6, lng: 4.6 }, CH: { name: 'Suisse', lat: 46.8, lng: 8.2 },
  LU: { name: 'Luxembourg', lat: 49.8, lng: 6.1 }, MC: { name: 'Monaco', lat: 43.7, lng: 7.4 }, CA: { name: 'Canada', lat: 56.1, lng: -106.3 },
  US: { name: 'États-Unis', lat: 39.8, lng: -98.6 }, MX: { name: 'Mexique', lat: 23.6, lng: -102.5 }, BR: { name: 'Brésil', lat: -10.3, lng: -53.2 },
  AR: { name: 'Argentine', lat: -34.6, lng: -64.0 }, CL: { name: 'Chili', lat: -33.5, lng: -70.7 }, CO: { name: 'Colombie', lat: 4.6, lng: -74.1 },
  PE: { name: 'Pérou', lat: -9.2, lng: -75.0 }, GB: { name: 'Royaume-Uni', lat: 54.0, lng: -2.5 }, IE: { name: 'Irlande', lat: 53.2, lng: -8.2 },
  DE: { name: 'Allemagne', lat: 51.2, lng: 10.4 }, NL: { name: 'Pays-Bas', lat: 52.2, lng: 5.3 }, ES: { name: 'Espagne', lat: 40.2, lng: -3.7 },
  PT: { name: 'Portugal', lat: 39.6, lng: -8.0 }, IT: { name: 'Italie', lat: 42.8, lng: 12.6 }, AT: { name: 'Autriche', lat: 47.6, lng: 14.1 },
  PL: { name: 'Pologne', lat: 52.1, lng: 19.4 }, SE: { name: 'Suède', lat: 62.2, lng: 15.6 }, NO: { name: 'Norvège', lat: 61.4, lng: 9.0 },
  DK: { name: 'Danemark', lat: 56.0, lng: 10.0 }, FI: { name: 'Finlande', lat: 64.5, lng: 26.0 }, GR: { name: 'Grèce', lat: 39.1, lng: 22.0 },
  RO: { name: 'Roumanie', lat: 45.9, lng: 24.9 }, CZ: { name: 'Tchéquie', lat: 49.8, lng: 15.5 }, UA: { name: 'Ukraine', lat: 49.0, lng: 31.4 },
  TR: { name: 'Turquie', lat: 39.0, lng: 35.2 }, RU: { name: 'Russie', lat: 61.5, lng: 99.0 }, MA: { name: 'Maroc', lat: 31.8, lng: -7.1 },
  DZ: { name: 'Algérie', lat: 28.0, lng: 2.6 }, TN: { name: 'Tunisie', lat: 34.0, lng: 9.5 }, SN: { name: 'Sénégal', lat: 14.5, lng: -14.5 },
  CI: { name: "Côte d'Ivoire", lat: 7.5, lng: -5.5 }, CM: { name: 'Cameroun', lat: 5.7, lng: 12.4 }, CD: { name: 'RD Congo', lat: -2.9, lng: 23.7 },
  NG: { name: 'Nigeria', lat: 9.1, lng: 8.7 }, EG: { name: 'Égypte', lat: 26.8, lng: 30.8 }, ZA: { name: 'Afrique du Sud', lat: -30.6, lng: 22.9 },
  KE: { name: 'Kenya', lat: 0.2, lng: 37.9 }, MG: { name: 'Madagascar', lat: -18.8, lng: 46.9 }, AE: { name: 'Émirats arabes unis', lat: 23.4, lng: 53.8 },
  SA: { name: 'Arabie saoudite', lat: 23.9, lng: 45.1 }, IL: { name: 'Israël', lat: 31.0, lng: 34.9 }, IN: { name: 'Inde', lat: 21.1, lng: 78.7 },
  CN: { name: 'Chine', lat: 35.9, lng: 104.2 }, JP: { name: 'Japon', lat: 36.2, lng: 138.3 }, KR: { name: 'Corée du Sud', lat: 36.5, lng: 127.9 },
  TH: { name: 'Thaïlande', lat: 15.9, lng: 100.9 }, VN: { name: 'Viêt Nam', lat: 14.1, lng: 108.3 }, ID: { name: 'Indonésie', lat: -2.5, lng: 118.0 },
  PH: { name: 'Philippines', lat: 12.9, lng: 121.8 }, SG: { name: 'Singapour', lat: 1.35, lng: 103.8 }, AU: { name: 'Australie', lat: -25.3, lng: 133.8 },
  NZ: { name: 'Nouvelle-Zélande', lat: -41.8, lng: 172.8 }, RE: { name: 'La Réunion', lat: -21.1, lng: 55.5 }, GP: { name: 'Guadeloupe', lat: 16.2, lng: -61.6 },
  MQ: { name: 'Martinique', lat: 14.6, lng: -61.0 }, HT: { name: 'Haïti', lat: 19.0, lng: -72.3 },
};

export function flag(cc: string) {
  return cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';
}
