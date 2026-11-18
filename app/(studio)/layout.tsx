import { Sidebar } from '@/components/Sidebar';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar protectedApp={Boolean(process.env.APP_PASSWORD)} />
      <main className="main"><div className="wrap">{children}</div></main>
    </>
  );
}
