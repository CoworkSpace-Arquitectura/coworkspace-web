'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { Loading, Notice, StatusTag } from '@/components/ui';

interface Health {
  gateway: string;
  services: { service: string; status: 'UP' | 'DOWN'; httpStatus?: number; ms: number }[];
}

interface Occupancy {
  locationId: string;
  locationName: string;
  day: string;
  bookings: number;
  bookedHours: number;
}

interface Revenue {
  planName: string;
  month: string;
  currency: string;
  amount: number;
  transactions: number;
}

interface Retention {
  cohort: string;
  started: number;
  active: number;
  churned: number;
  retentionRate: number;
}

interface EtlRun {
  id: string;
  trigger: string;
  status: string;
  startedAt: string;
  error: string | null;
}

const SERVICE_LABEL: Record<string, string> = {
  space: 'Sedes y espacios',
  membership: 'Membresías',
  access: 'Control de acceso',
  booking: 'Reservas',
  billing: 'Cobros',
  currency: 'Divisas',
  notification: 'Avisos',
  community: 'Comunidad',
  analytics: 'Analítica',
};

export default function PanelPage() {
  const { token } = useApp();
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [occupancy, setOccupancy] = useState<Occupancy[]>([]);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [retention, setRetention] = useState<Retention[]>([]);
  const [runs, setRuns] = useState<EtlRun[]>([]);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [running, setRunning] = useState(false);

  const checkHealth = useCallback(() => {
    setChecking(true);
    api<Health>('/health')
      .then(setHealth)
      .catch((e: unknown) => setMessage({ tone: 'error', text: errorMessage(e) }))
      .finally(() => setChecking(false));
  }, []);

  const loadMetrics = useCallback(() => {
    if (!token) {
      return;
    }
    api<Occupancy[]>('/metrics/occupancy', { token }).then(setOccupancy).catch(() => undefined);
    api<Revenue[]>('/metrics/revenue', { token }).then(setRevenue).catch(() => undefined);
    api<Retention[]>('/metrics/retention', { token }).then(setRetention).catch(() => undefined);
    api<EtlRun[]>('/etl/runs', { token }).then(setRuns).catch(() => undefined);
  }, [token]);

  useEffect(checkHealth, [checkHealth]);
  useEffect(loadMetrics, [loadMetrics]);

  async function runEtl() {
    setRunning(true);
    setMessage({ tone: 'info', text: 'Calculando métricas con los datos de reservas, membresías y cobros…' });
    try {
      const run = await api<EtlRun>('/etl/run', { method: 'POST', token });
      setMessage(
        run.status === 'SUCCESS'
          ? { tone: 'success', text: 'Métricas actualizadas.' }
          : { tone: 'error', text: `No se pudieron actualizar: ${run.error ?? 'error desconocido'}. Se conservan las anteriores.` },
      );
      loadMetrics();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setRunning(false);
    }
  }

  const up = health?.services.filter((s) => s.status === 'UP').length ?? 0;

  return (
    <>
      <section className="section-head">
        <h1>Panel de la red</h1>
        <p className="muted">Estado de los microservicios y métricas del negocio.</p>
      </section>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="panel-block">
        <div className="panel-title">
          <h2>{health ? `${up} de ${health.services.length} servicios en línea` : 'Estado de los servicios'}</h2>
          <button type="button" className="button button-ghost button-small" disabled={checking} onClick={checkHealth}>
            {checking ? 'Revisando…' : 'Revisar de nuevo'}
          </button>
        </div>
        {!health && <Loading label="Consultando el API Gateway…" />}
        {health && (
          <ul className="health">
            {health.services.map((s) => (
              <li key={s.service} className={s.status === 'UP' ? 'up' : 'down'}>
                <span className="dot" aria-hidden="true" />
                <span>{SERVICE_LABEL[s.service] ?? s.service}</span>
                <span className="muted small">{s.status === 'UP' ? `${s.ms} ms` : `sin respuesta (${s.httpStatus ?? 'error'})`}</span>
              </li>
            ))}
          </ul>
        )}
        {health && up < health.services.length && (
          <p className="muted small">Los servicios gratuitos se duermen sin uso. Revisa de nuevo en un minuto.</p>
        )}
      </section>

      {!token ? (
        <p className="muted">Ingresa para ver las métricas del negocio.</p>
      ) : (
        <>
          <section className="panel-block">
            <div className="panel-title">
              <h2>Métricas</h2>
              <button type="button" className="button button-small" disabled={running} onClick={() => void runEtl()}>
                {running ? 'Calculando…' : 'Actualizar métricas'}
              </button>
            </div>
            {runs[0] && (
              <p className="muted small">
                Último cálculo: {dateTime(runs[0].startedAt)} ({runs[0].trigger === 'SCHEDULED' ? 'automático' : 'manual'}),{' '}
                <StatusTag tone={runs[0].status === 'SUCCESS' ? 'ok' : 'off'}>{runs[0].status === 'SUCCESS' ? 'exitoso' : 'fallido'}</StatusTag>
              </p>
            )}
          </section>

          <div className="metrics-grid">
            <section className="panel-block">
              <h3>Ocupación por sede</h3>
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Sede</th>
                    <th className="num">Reservas</th>
                    <th className="num">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancy.map((o) => (
                    <tr key={`${o.locationId}-${o.day}`}>
                      <td>{o.day}</td>
                      <td>{o.locationName}</td>
                      <td className="num">{o.bookings}</td>
                      <td className="num">{o.bookedHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {occupancy.length === 0 && <p className="muted small">Sin datos. Pulsa Actualizar métricas.</p>}
            </section>

            <section className="panel-block">
              <h3>Ingresos por plan</h3>
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Plan</th>
                    <th className="num">Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.map((r) => (
                    <tr key={`${r.planName}-${r.month}-${r.currency}`}>
                      <td>{r.month}</td>
                      <td>{r.planName}</td>
                      <td className="num">{money(r.amount, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {revenue.length === 0 && <p className="muted small">Sin datos.</p>}
            </section>

            <section className="panel-block">
              <h3>Retención de miembros</h3>
              <table>
                <thead>
                  <tr>
                    <th>Mes de ingreso</th>
                    <th className="num">Activos</th>
                    <th className="num">Retención</th>
                  </tr>
                </thead>
                <tbody>
                  {retention.map((r) => (
                    <tr key={r.cohort}>
                      <td>{r.cohort}</td>
                      <td className="num">
                        {r.active} de {r.started}
                      </td>
                      <td className="num">{r.retentionRate} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {retention.length === 0 && <p className="muted small">Sin datos.</p>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
