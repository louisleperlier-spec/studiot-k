import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { LiquidGlassDefs } from '@/components/process/web-liquid-glass/LiquidGlass';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Studio T&K', template: '%s · Studio T&K' },
  description: 'Le studio de contenu de St Tarbanouche et Kevun.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#07080B', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <div className="atmo" aria-hidden="true"><i /><i /><i /><i /></div>
        <LiquidGlassDefs />
        {children}
      </body>
    </html>
  );
}
