import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  return (
    <main className="login">
      <GlassPanel tone="dark" radius={24}>
        <div className="brand-mark" aria-hidden="true">T·K</div>
        <div>
          <div className="eyebrow">Studio privé</div>
          <h1 style={{ fontSize: 26 }}>St Tarbanouche &amp; Kevun</h1>
        </div>
        <LoginForm next={suite ?? '/'} />
      </GlassPanel>
    </main>
  );
}
