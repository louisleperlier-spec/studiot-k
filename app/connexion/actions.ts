'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, sessionToken } from '@/lib/auth';

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  const given = String(form.get('password') ?? '');
  const next = String(form.get('suite') ?? '/');
  if (!password) redirect('/');
  if (given !== password) return 'Mot de passe incorrect.';
  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60,
  });
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/connexion');
}
