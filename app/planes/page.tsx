'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Plan, Subscription } from '@/lib/types';
import { DualPrice, Loading, Notice } from '@/components/ui';

const ACCESS_LABEL = { DESK: 'Puestos de trabajo', ROOM: 'Salas de reuniones' } as const;

export default function PlansPage() {
  const { token, member } = useApp();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [working, setWorking] = useState(false);

  const loadSubscription = useCallback(() => {
    if (!token || !member) {
      setSubscription(null);
      return;
    }
    api<Subscription>(`/subscriptions/member/${member.id}/active`, { token })
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [token, member]);

  useEffect(() => {
    api<Plan[]>('/plans')
      .then(setPlans)
      .catch((e: unknown) => setMessage({ tone: 'error', text: errorMessage(e) }));
  }, []);

  useEffect(loadSubscription, [loadSubscription]);

  async function subscribe(plan: Plan) {
    if (!token || !member) {
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      await api('/subscriptions', { method: 'POST', token, body: { memberId: member.id, planId: plan.id } });
      setMessage({ tone: 'success', text: `Te suscribiste al plan ${plan.name}. Ya puedes reservar y generar tu credencial.` });
      loadSubscription();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setWorking(false);
    }
  }

  async function cancel() {
    if (!token || !subscription) {
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      await api(`/subscriptions/${subscription.id}/cancel`, { method: 'PATCH', token });
      setMessage({ tone: 'success', text: 'Cancelaste tu plan. Tu credencial de acceso quedó desactivada.' });
      setSubscription(null);
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <section className="section-head">
        <h1>Planes</h1>
        <p className="muted">Lo que incluye tu plan se reserva sin costo. Lo demás se paga por horas.</p>
      </section>

      {subscription && (
        <div className="current-plan">
          <div>
            <p className="muted small">Tu plan actual</p>
            <h2>{subscription.plan.name}</h2>
            <p className="muted">Se renueva el {dateTime(subscription.renewsAt)}</p>
          </div>
          <button type="button" className="button button-danger" disabled={working} onClick={() => void cancel()}>
            Cancelar plan
          </button>
        </div>
      )}

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!plans && !message && <Loading label="Cargando planes…" />}

      {plans && (
        <ul className="plan-list">
          {plans.map((plan) => (
            <li key={plan.id} className={subscription?.planId === plan.id ? 'plan current' : 'plan'}>
              <h3>{plan.name}</h3>
              <DualPrice amount={plan.price} currency="COP" unit="al mes" size="lg" />
              <ul className="checks">
                {(['DESK', 'ROOM'] as const).map((type) => (
                  <li key={type} className={plan.resourceAccess.includes(type) ? 'yes' : 'no'}>
                    {ACCESS_LABEL[type]}
                    {plan.resourceAccess.includes(type) ? ' incluidos' : ' con costo por hora'}
                  </li>
                ))}
              </ul>
              {!member ? (
                <Link href="/ingresar/" className="button button-ghost">
                  Ingresa para suscribirte
                </Link>
              ) : subscription ? (
                <span className="muted small">{subscription.planId === plan.id ? 'Es tu plan actual' : 'Cancela tu plan actual para cambiar'}</span>
              ) : (
                <button type="button" className="button" disabled={working} onClick={() => void subscribe(plan)}>
                  Suscribirme
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
