'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useApp } from '../providers';
import { api, ApiError, errorMessage } from '@/lib/api';
import { findCheckoutUrl } from '@/lib/payments';
import { money, RESOURCE_LABEL, timeRange } from '@/lib/format';
import type { Booking, Desk, Location, ResourceType, Room, Subscription } from '@/lib/types';
import { DualPrice, Loading, Notice } from '@/components/ui';

interface Selected {
  id: string;
  type: ResourceType;
  label: string;
  hourlyRate: number;
}

const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i);

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function LocationDetail() {
  const id = useSearchParams().get('id') ?? '';
  const { token, member, countries } = useApp();
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Falta el identificador de la sede.');
      return;
    }
    api<Location>(`/locations/${id}`)
      .then(setLocation)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [id]);

  useEffect(() => {
    if (!token || !member) {
      setSubscription(null);
      return;
    }
    api<Subscription>(`/subscriptions/member/${member.id}/active`, { token })
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [token, member]);

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }
  if (!location) {
    return <Loading label="Cargando la sede…" />;
  }

  const countryName = countries.find((c) => c.code === location.country)?.name ?? location.country;
  const rooms = location.rooms ?? [];
  const desks = location.desks ?? [];

  return (
    <div className="detail">
      <section className="detail-head">
        <Link href="/" className="back">
          Todas las sedes
        </Link>
        <h1>{location.name}</h1>
        <p className="detail-meta">
          {location.address}, {location.city}, {countryName}. Los precios de esta sede están en {location.currency}.
        </p>
      </section>

      <div className="detail-body">
        <div className="resources">
          <h2>Salas</h2>
          {rooms.length === 0 && <p className="muted">Esta sede aún no tiene salas.</p>}
          <ul className="resource-list">
            {rooms.map((room: Room) => (
              <li key={room.id} className={selected?.id === room.id ? 'resource selected' : 'resource'}>
                <div className="resource-info">
                  <h3>{room.name}</h3>
                  <p className="muted">
                    Hasta {room.capacity} personas
                    {Object.keys(room.equipment ?? {}).length > 0 && `, con ${Object.keys(room.equipment).join(', ')}`}
                  </p>
                </div>
                <DualPrice amount={room.hourlyRate} currency={location.currency} unit="por hora" />
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => setSelected({ id: room.id, type: 'ROOM', label: room.name, hourlyRate: room.hourlyRate })}
                >
                  {selected?.id === room.id ? 'Seleccionada' : 'Reservar'}
                </button>
              </li>
            ))}
          </ul>

          <h2>Puestos de trabajo</h2>
          {desks.length === 0 && <p className="muted">Esta sede aún no tiene puestos.</p>}
          <ul className="resource-list">
            {desks.map((desk: Desk) => (
              <li key={desk.id} className={selected?.id === desk.id ? 'resource selected' : 'resource'}>
                <div className="resource-info">
                  <h3>Puesto {desk.code}</h3>
                  <p className="muted">{desk.isDedicated ? 'Escritorio dedicado' : 'Puesto flexible'}</p>
                </div>
                <DualPrice amount={desk.hourlyRate} currency={location.currency} unit="por hora" />
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => setSelected({ id: desk.id, type: 'DESK', label: `Puesto ${desk.code}`, hourlyRate: desk.hourlyRate })}
                >
                  {selected?.id === desk.id ? 'Seleccionado' : 'Reservar'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="booking-panel">
          {selected ? (
            <BookingForm key={selected.id} selected={selected} location={location} subscription={subscription} />
          ) : (
            <div className="booking-empty">
              <h2>Reserva</h2>
              <p className="muted">Elige una sala o un puesto para ver su disponibilidad y reservar.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BookingForm({ selected, location, subscription }: { selected: Selected; location: Location; subscription: Subscription | null }) {
  const { token, member } = useApp();
  const [day, setDay] = useState(todayPlus(1));
  const [hour, setHour] = useState(9);
  const [duration, setDuration] = useState(2);
  const [busy, setBusy] = useState<{ startTime: string; endTime: string }[]>([]);
  const [state, setState] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [working, setWorking] = useState(false);

  const start = useMemo(() => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`), [day, hour]);
  const end = useMemo(() => new Date(start.getTime() + duration * 3_600_000), [start, duration]);
  const included = subscription?.plan.resourceAccess.includes(selected.type) ?? false;
  const total = selected.hourlyRate * duration;

  // Disponibilidad del día elegido (Booking Service, consulta pública)
  useEffect(() => {
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(from.getTime() + 24 * 3_600_000);
    api<{ startTime: string; endTime: string }[]>(
      `/bookings/availability?resourceId=${selected.id}&from=${from.toISOString()}&to=${to.toISOString()}`,
    )
      .then(setBusy)
      .catch(() => setBusy([]));
  }, [day, selected.id]);

  const overlaps = busy.some((b) => new Date(b.startTime) < end && new Date(b.endTime) > start);

  async function book() {
    if (!token || !member) {
      return;
    }
    setWorking(true);
    setState(null);
    try {
      const booking = await api<Booking>('/bookings', {
        method: 'POST',
        token,
        body: {
          memberId: member.id,
          resourceId: selected.id,
          resourceType: selected.type,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      if (booking.status === 'PENDING_PAYMENT') {
        setState({ tone: 'info', text: 'Reserva creada. Preparando el pago en Stripe…' });
        window.location.href = await findCheckoutUrl(booking.id, token);
        return;
      }
      setState({ tone: 'success', text: 'Reserva confirmada. Está incluida en tu plan.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setState({ tone: 'error', text: 'Necesitas un plan activo para reservar. Elige uno en Planes.' });
      } else {
        setState({ tone: 'error', text: errorMessage(e) });
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="booking-form">
      <h2>{selected.label}</h2>
      <p className="muted">{RESOURCE_LABEL[selected.type]} en {location.name}</p>

      <div className="field-row">
        <label className="field">
          <span>Día</span>
          <input type="date" value={day} min={todayPlus(0)} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field">
          <span>Desde</span>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Horas</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[1, 2, 3, 4, 6, 8].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {busy.length > 0 && (
        <div className="busy">
          <p>Ocupado ese día:</p>
          <ul>
            {busy.map((b) => (
              <li key={b.startTime}>{timeRange(b.startTime, b.endTime)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="total">
        {member && included ? (
          <p className="included">Incluido en tu plan {subscription?.plan.name}. No tiene costo adicional.</p>
        ) : (
          <>
            <p className="muted">
              {duration} {duration === 1 ? 'hora' : 'horas'} × {money(selected.hourlyRate, location.currency)}
            </p>
            <DualPrice amount={total} currency={location.currency} size="lg" />
            {member && <p className="muted small">Tu plan no incluye este tipo de espacio: se cobra con tarjeta.</p>}
          </>
        )}
      </div>

      {overlaps && <Notice tone="warning">Ese horario se cruza con otra reserva.</Notice>}
      {state && <Notice tone={state.tone}>{state.text}</Notice>}
      {state?.tone === 'success' && (
        <Link href="/reservas/" className="button button-ghost">
          Ver mis reservas
        </Link>
      )}

      {member ? (
        <button type="button" className="button button-block" disabled={working || overlaps} onClick={() => void book()}>
          {working ? 'Reservando…' : included ? 'Confirmar reserva' : 'Reservar y pagar'}
        </button>
      ) : (
        <Link href="/ingresar/" className="button button-block">
          Ingresa para reservar
        </Link>
      )}
    </div>
  );
}

export default function LocationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LocationDetail />
    </Suspense>
  );
}
