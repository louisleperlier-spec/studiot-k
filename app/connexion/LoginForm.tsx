'use client';
import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="form">
      <input type="hidden" name="suite" value={next} />
      <label className="field">
        <span>Mot de passe</span>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </label>
      {error && <p className="notice err" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Connexion…' : 'Entrer dans le studio'}</button>
    </form>
  );
}
