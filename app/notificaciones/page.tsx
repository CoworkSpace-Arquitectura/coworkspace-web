'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { Loading, Notice, RequireSession } from '@/components/ui';

function NotificationsList() {
  const { token, member } = useApp();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token || !member) {
      return;
    }
    api<Notification[]>(`/notifications?memberId=${member.id}`, { token })
      .then(setItems)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [token, member]);

  useEffect(load, [load]);

  async function markAll() {
    if (!token || !member) {
      return;
    }
    await api(`/notifications/read-all?memberId=${member.id}`, { method: 'PATCH', token }).catch(() => undefined);
    load();
  }

  return (
    <>
      <section className="section-head">
        <h1>Avisos</h1>
        <button type="button" className="button button-ghost button-small" onClick={() => void markAll()}>
          Marcar todo como leído
        </button>
      </section>
      {error && <Notice tone="error">{error}</Notice>}
      {!items && !error && <Loading />}
      {items && items.length === 0 && <p className="muted">No tienes avisos todavía.</p>}
      {items && (
        <ul className="notifications">
          {items.map((n) => (
            <li key={n.id} className={n.readAt ? 'read' : 'unread'}>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                {n.link && (
                  <a href={n.link} className="small">
                    Ir a pagar
                  </a>
                )}
              </div>
              <span className="muted small">{dateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <RequireSession reason="Ingresa para ver tus avisos.">
      <NotificationsList />
    </RequireSession>
  );
}
