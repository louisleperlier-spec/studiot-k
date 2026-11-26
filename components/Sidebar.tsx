'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/app/connexion/actions';

const LINKS = [
  { href: '/', label: 'Accueil', icon: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></> },
  { href: '/personnages', label: 'Personnages', icon: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M15 14.6c2.6.1 4.5 2 5 5.4" /></> },
  { href: '/calendrier', label: 'Calendrier', icon: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { href: '/concepts', label: 'Générateur de concepts', icon: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></> },
  { href: '/stats', label: 'Stats', icon: <><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></> },
  { href: '/revenus', label: 'Revenus', icon: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /> },
  { href: '/concurrents', label: 'Concurrents', soon: true, icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 6" /></> },
];

export function Sidebar({ protectedApp }: { protectedApp: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <button className="burger tk-lg tk-lg--lens" data-tone="dark" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && <button className="scrim" aria-label="Fermer le menu" onClick={() => setOpen(false)} />}
      <aside className={`side tk-lg tk-lg--flat${open ? ' is-open' : ''}`} data-tone="dark" style={{ borderRadius: 0 }}>
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">T·K</span>
          <span className="brand-name lbl">Studio T&amp;K<small>St Tarbanouche · Kevun</small></span>
        </Link>
        <nav className="nav" aria-label="Navigation principale">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{l.icon}</svg>
              <span className="lbl">{l.label}</span>
              {l.soon && <span className="soon lbl">bientôt</span>}
            </Link>
          ))}
        </nav>
        {protectedApp && (
          <div className="side-foot">
            <form action={logout}>
              <button className="nav-out btn btn-ghost btn-sm" style={{ width: '100%', overflow: 'hidden' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
                <span className="lbl">Se déconnecter</span>
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
}
