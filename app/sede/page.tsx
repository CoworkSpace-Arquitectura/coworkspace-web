'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../providers';
import { api, ApiError, errorMessage } from '@/lib/api';
import { findCheckoutUrl } from '@/lib/payments';
import { money, RESOURCE_LABEL, ROOM_KIND, ROOM_KINDS, timeRange } from '@/lib/format';
import { normalizeLocation, photoSrc } from '@/lib/photos';
import { directionsUrl } from '@/lib/geo';
import type { Booking, Desk, Location, Member, ResourceType, Room, Subscription } from '@/lib/types';
import { DualPrice, Loading, Notice } from '@/components/ui';
import { SpacePicture } from '@/components/SpacePicture';
import { LocationMap } from '@/components/LocationMap';

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
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!id) {
      setError('Falta el identificador de la sede. Vuelve a la lista y elige una.');
      return;
    }
    api<Location>(`/locations/${id}`)
      .then((l) => setLocation(normalizeLocation(l)))
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
  const photos = location.photos;
  const canManage = member?.role === 'OWNER' || (member?.role === 'MANAGER' && location.managerId === member.id);
  const hasPin = location.latitude !== null && location.longitude !== null;

  const choose = (item: Selected) => {
    setSelected(item);
    // En pantallas pequeñas el formulario queda debajo: lo llevamos a la vista
    window.setTimeout(() => document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="detail">
      <div className="detail-top">
        <Link href="/" className="back">
          Todas las sedes
        </Link>
        {canManage && (
          <Link href={`/gestion/sede/?id=${location.id}`} className="button button-ghost button-small">
            Editar esta sede
          </Link>
        )}
      </div>

      <section className="detail-head">
        <h1>{location.name}</h1>
        <p className="detail-meta">
          {location.address}, {location.city}, {countryName}
        </p>
      </section>

      <section className={photos.length > 1 ? 'gallery' : 'gallery gallery-single'} aria-label="Fotos de la sede">
        <div className="gallery-main">
          <SpacePicture src={photos[photoIndex] ? photoSrc(photos[photoIndex].src) : null} seed={location.id} alt={location.name} />
        </div>
        {photos.length > 1 && (
          <ul className="gallery-thumbs">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <button type="button" aria-pressed={index === photoIndex} onClick={() => setPhotoIndex(index)} aria-label={`Ver foto ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSrc(photo.src)} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="detail-body">
        <div className="resources">
          {location.description && <p className="description">{location.description}</p>}

          {location.amenities.length > 0 && (
            <>
              <h2>Lo que ofrece</h2>
              <ul className="amenities">
                {location.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}

          {ROOM_KINDS.map((kind) => {
            const ofKind = rooms.filter((r) => r.kind === kind);
            if (ofKind.length === 0) {
              return null;
            }
            return (
              <section key={kind}>
                <h2>{ROOM_KIND[kind].many}</h2>
                <ul className="resource-list">
                  {ofKind.map((room: Room) => (
                    <li key={room.id} className={selected?.id === room.id ? 'resource selected' : 'resource'}>
                      <div className="resource-info">
                        <h3>{room.name}</h3>
                        <p className="muted">
                          Hasta {room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}
                          {Object.keys(room.equipment ?? {}).length > 0 && `, con ${Object.keys(room.equipment).join(', ')}`}
                        </p>
                      </div>
                      <DualPrice amount={room.hourlyRate} currency={location.currency} unit="por hora" />
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => choose({ id: room.id, type: 'ROOM', label: room.name, hourlyRate: room.hourlyRate })}
                      >
                        {selected?.id === room.id ? 'Elegido' : 'Elegir'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {desks.length > 0 && (
            <section>
              <h2>Puestos de trabajo</h2>
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
                      onClick={() => choose({ id: desk.id, type: 'DESK', label: `Puesto ${desk.code}`, hourlyRate: desk.hourlyRate })}
                    >
                      {selected?.id === desk.id ? 'Elegido' : 'Elegir'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rooms.length === 0 && desks.length === 0 && <p className="muted">Esta sede todavía no tiene espacios publicados.</p>}

          <section className="where">
            <h2>Dónde queda</h2>
            <p>
              {location.address}, {location.city}, {countryName}
            </p>
            {hasPin ? (
              <>
                <LocationMap
                  points={[{ id: location.id, latitude: location.latitude as number, longitude: location.longitude as number, title: location.name }]}
                  label={`Mapa con la ubicación de ${location.name}`}
                />
                <a href={directionsUrl(location.latitude as number, location.longitude as number)} target="_blank" rel="noreferrer">
                  Cómo llegar (abre OpenStreetMap)
                </a>
              </>
            ) : (
              <p className="muted small">La ubicación exacta en el mapa aún no está registrada.</p>
            )}
          </section>
        </div>

        <aside className="booking-panel" id="reserva">
          {selected ? (
            <BookingForm key={selected.id} selected={selected} location={location} subscription={subscription} canManage={canManage} />
          ) : (
            <div className="booking-empty">
              <h2>Reserva</h2>
              <p className="muted">Elige un espacio para ver su disponibilidad y reservar.</p>
              <p className="muted small">Precios en {location.currency}, la moneda de esta sede.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface BookingFormProps {
  selected: Selected;
  location: Location;
  subscription: Subscription | null;
  /** Gerente de esta sede o jefe: puede reservar a nombre de un cliente. */
  canManage: boolean;
}

function BookingForm({ selected, location, subscription, canManage }: BookingFormProps) {
  const { token, member } = useApp();
  const [day, setDay] = useState(todayPlus(1));
  const [hour, setHour] = useState(9);
  const [duration, setDuration] = useState(2);
  const [busy, setBusy] = useState<{ startTime: string; endTime: string }[]>([]);
  const [state, setState] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [pendingPayment, setPendingPayment] = useState('');

  // Reserva a nombre de un cliente (solo personal de la sede)
  const [forClient, setForClient] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [client, setClient] = useState<Member | null>(null);
  const [clientPlan, setClientPlan] = useState<Subscription | null>(null);

  const start = useMemo(() => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`), [day, hour]);
  const end = useMemo(() => new Date(start.getTime() + duration * 3_600_000), [start, duration]);
  const plan = forClient ? clientPlan : subscription;
  const included = plan?.plan.resourceAccess.includes(selected.type) ?? false;
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

  async function findClient(event: FormEvent) {
    event.preventDefault();
    setClient(null);
    setClientPlan(null);
    setState(null);
    try {
      const email = clientEmail.trim().toLowerCase();
      const found = (await api<Member[]>(`/members?email=${encodeURIComponent(email)}`, { token })).filter((m) => m.email === email);
      if (found.length === 0) {
        setState({ tone: 'error', text: 'No hay ningún socio con ese correo. Debe crear su cuenta primero.' });
        return;
      }
      setClient(found[0]);
      const active = await api<Subscription>(`/subscriptions/member/${found[0].id}/active`, { token }).catch(() => null);
      setClientPlan(active);
    } catch (e) {
      setState({ tone: 'error', text: errorMessage(e) });
    }
  }

  async function book() {
    if (!token || !member || (forClient && !client)) {
      return;
    }
    setWorking(true);
    setState(null);
    try {
      const booking = await api<Booking>('/bookings', {
        method: 'POST',
        token,
        body: {
          memberId: forClient && client ? client.id : member.id,
          resourceId: selected.id,
          resourceType: selected.type,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      if (booking.status === 'PENDING_PAYMENT') {
        if (forClient) {
          setPendingPayment(booking.id);
          setState({ tone: 'info', text: `Reserva creada a nombre de ${client?.name}. Falta el pago: ábrelo aquí o el cliente puede pagar desde Mis reservas.` });
          return;
        }
        setState({ tone: 'info', text: 'Reserva creada. Preparando el pago en Stripe…' });
        window.location.href = await findCheckoutUrl(booking.id, token);
        return;
      }
      setState({
        tone: 'success',
        text: forClient ? `Reserva confirmada a nombre de ${client?.name}. Está incluida en su plan.` : 'Reserva confirmada. Está incluida en tu plan.',
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && /membres/i.test(e.message)) {
        setState({
          tone: 'error',
          text: forClient ? 'El cliente no tiene un plan activo. Debe suscribirse antes de reservar.' : 'Necesitas un plan activo para reservar. Elige uno en Planes.',
        });
      } else {
        setState({ tone: 'error', text: errorMessage(e) });
      }
    } finally {
      setWorking(false);
    }
  }

  async function openPayment() {
    if (!token) {
      return;
    }
    setWorking(true);
    try {
      window.location.href = await findCheckoutUrl(pendingPayment, token);
    } catch (e) {
      setState({ tone: 'error', text: errorMessage(e) });
      setWorking(false);
    }
  }

  return (
    <div className="booking-form">
      <h2>{selected.label}</h2>
      <p className="muted">
        {RESOURCE_LABEL[selected.type]} en {location.name}
      </p>

      {member && canManage && (
        <div className="segmented" role="group" aria-label="Para quién es la reserva">
          <button type="button" aria-pressed={!forClient} onClick={() => setForClient(false)}>
            Para mí
          </button>
          <button type="button" aria-pressed={forClient} onClick={() => setForClient(true)}>
            Para un cliente
          </button>
        </div>
      )}

      {forClient && (
        <form className="client-lookup" onSubmit={(e) => void findClient(e)}>
          <label className="field">
            <span>Correo del cliente</span>
            <input type="email" required value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </label>
          <button type="submit" className="button button-ghost button-small">
            Buscar
          </button>
          {client && (
            <p className="client-found">
              {client.name}: {clientPlan ? `plan ${clientPlan.plan.name}` : 'sin plan activo'}
            </p>
          )}
        </form>
      )}

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
          <p className="included">Incluido en el plan {plan?.plan.name}. Sin costo adicional.</p>
        ) : (
          <>
            <p className="muted">
              {duration} {duration === 1 ? 'hora' : 'horas'} × {money(selected.hourlyRate, location.currency)}
            </p>
            <DualPrice amount={total} currency={location.currency} size="lg" />
            {member && (
              <p className="muted small">
                El plan no incluye este tipo de espacio: se cobra con tarjeta. Cancelación con reembolso total hasta 24 horas antes.
              </p>
            )}
          </>
        )}
      </div>

      {overlaps && <Notice tone="warning">Ese horario se cruza con otra reserva.</Notice>}
      {state && <Notice tone={state.tone}>{state.text}</Notice>}
      {state?.tone === 'success' && !forClient && (
        <Link href="/reservas/" className="button button-ghost">
          Ver mis reservas
        </Link>
      )}

      {pendingPayment ? (
        <button type="button" className="button button-block" disabled={working} onClick={() => void openPayment()}>
          Abrir el pago en Stripe
        </button>
      ) : member ? (
        <button
          type="button"
          className="button button-block"
          disabled={working || overlaps || (forClient && !client)}
          onClick={() => void book()}
        >
          {working ? 'Reservando…' : forClient ? 'Reservar para el cliente' : included ? 'Confirmar reserva' : 'Reservar y pagar'}
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
