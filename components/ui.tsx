'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useApp, useConverted } from '@/app/providers';
import { money } from '@/lib/format';

// El precio en la moneda de la sede, y debajo lo que equivale en la moneda del visitante
export function DualPrice({ amount, currency, unit, size = 'md' }: { amount: number; currency: string; unit?: string; size?: 'md' | 'lg' }) {
  const converted = useConverted(amount, currency);
  return (
    <div className={`price price-${size}`}>
      <span className="price-main">
        {money(amount, currency)}
        {unit && <span className="price-unit"> {unit}</span>}
      </span>
      {!converted.same && (
        <span className="price-mine">
          {converted.value === null ? 'Calculando tu moneda…' : `≈ ${money(converted.value, converted.currency)} en tu moneda`}
        </span>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}

export function RequireSession({ children, reason }: { children: ReactNode; reason: string }) {
  const { token, ready } = useApp();
  if (!ready) {
    return <Loading />;
  }
  if (!token) {
    return (
      <div className="empty">
        <p>{reason}</p>
        <Link className="button" href="/ingresar/">
          Ingresar
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

export function StatusTag({ tone, children }: { tone: 'ok' | 'pending' | 'off'; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
