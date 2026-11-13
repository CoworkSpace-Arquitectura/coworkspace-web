'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import type { Session } from '@/lib/types';
import { Notice } from '@/components/ui';

export default function SignInPage() {
  const { signIn } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setWorking(true);
    try {
      const session =
        mode === 'login'
          ? await api<Session>('/auth/login', { method: 'POST', body: { email, password } })
          : await api<Session>('/auth/register', { method: 'POST', body: { name, email, password } });
      signIn(session);
      router.push(mode === 'register' ? '/planes/' : '/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="narrow">
      <h1>{mode === 'login' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</h1>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
          Ya tengo cuenta
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
          Soy nuevo
        </button>
      </div>

      <form onSubmit={(e) => void submit(e)} className="form">
        {mode === 'register' && (
          <label className="field">
            <span>Nombre completo</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {mode === 'register' && (
          <label className="field">
            <span>Repite la contraseña</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" className="button button-block" disabled={working}>
          {working ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
        {mode === 'register' && <p className="muted small">Mínimo 8 caracteres. Se guarda cifrada: nadie puede leerla, ni siquiera el sistema.</p>}
      </form>
    </div>
  );
}