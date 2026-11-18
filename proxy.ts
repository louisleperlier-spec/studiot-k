import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(password))) return NextResponse.next();
  const url = new URL('/connexion', request.url);
  if (request.nextUrl.pathname !== '/') url.searchParams.set('suite', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!connexion|_next/static|_next/image|favicon.ico).*)'],
};
