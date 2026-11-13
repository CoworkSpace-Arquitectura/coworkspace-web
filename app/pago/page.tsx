'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import type { Charge } from '@/lib/types';
import { Loading, Notice } from '@/components/ui';

interface PaymentResult {
  message: string;
  charge: Charge;
}

// Stripe devuelve al usuario aquí. Billing le pregunta a Stripe el estado real del pago.
function PaymentReturn() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const cancelledId = params.get('cancelled');
  const { token, ready } = useApp();
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!token) {
      setError('Ingresa de nuevo para ver el resultado de tu pago.');
      return;
    }
    const path = sessionId
      ? `/charges/return?session_id=${encodeURIComponent(sessionId)}`
      : cancelledId
        ? `/charges/${cancelledId}/cancelled`
        : null;
    if (!path) {
      setError('No llegó información del pago.');
      return;
    }
    api<PaymentResult>(path, { token })
      .then(setResult)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [ready, token, sessionId, cancelledId]);

  const tone = result?.charge.status === 'PAID' ? 'success' : result?.charge.status === 'FAILED' ? 'error' : 'info';

  return (
    <div className="narrow">
      <h1>Resultado del pago</h1>
      {!result && !error && <Loading label="Confirmando con Stripe…" />}
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <>
          <Notice tone={tone}>{result.message}</Notice>
          <p className="muted">
            Monto: {money(result.charge.amount, result.charge.currency)}
          </p>
        </>
      )}
      {result?.charge.subscriptionId ? (
        <div className="actions-row">
          <Link href="/planes/" className="button">
            Ver mi plan
          </Link>
          {result.charge.status === 'PAID' && (
            <Link href="/credencial/" className="button button-ghost">
              Generar mi credencial
            </Link>
          )}
        </div>
      ) : (
        <Link href="/reservas/" className="button">
          Ir a mis reservas
        </Link>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentReturn />
    </Suspense>
  );
}
