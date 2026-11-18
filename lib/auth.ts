export const SESSION_COOKIE = 'studio_session';

/** Session token derived from the password, so changing APP_PASSWORD logs everyone out. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`studio-tk:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
