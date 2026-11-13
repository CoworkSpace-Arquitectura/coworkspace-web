'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { findCheckoutUrl } from '@/lib/payments';
import { BOOKING_STATUS, money, RESOURCE_LABEL } from '@/lib/format';
import { normalizeLocation } from '@/lib/photos';
import { describeRange, DEFAULT_TIME_ZONE } from '@/lib/time';
import { bookingRefundable, BOOKING_REGRET_HOURS } from '@/lib/refunds';
import type { Booking, Charge, Location } from '@/lib/types';
import { Loading, Notice, RequireSession, StatusTag } from '@/components/ui';

const TONE = { CONFIRMED: 'ok', PENDING_PAYMENT: 'pending', CANCELLED: 'off' } as const;

function BookingsList() {
  const { token, member } = useApp();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [locations, setLocations] = useState<Record<string, Location>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [refunds, setRefunds] = useState<Record<string, Charge['status']>>({});
  const [workingId, setWorkingId] = useState('');

  const load = useCallback(() => {
    if (!token || !member) {
      return;
    }
    api<Booking[]>(`/bookings?memberId=${member.id}`, { token })
      .then((list) => {
        setBookings([...list].sort((a, b) => b.startTime.localeCompare(a.startTime)));
        // Para las reservas pagadas que se cancelaron, preguntamos a Billing si hubo reembolso
        const paidAndCancelled = list.filter((b) => b.status === 'CANCELLED' && b.extraCharge > 0);
        void Promise.all(
          paidAndCancelled.map((b) =>
            api<Charge>(`/charges/booking/${b.id}`, { token })
              .then((c) => [b.id, c.status] as const)
              .catch(() => null),
          ),
        ).then((pairs) => setRefunds(Object.fromEntries(pairs.filter((p) => p !== null))));
      })
      .catch((e: unknown) => setMessage({ tone: 'error', text: errorMessage(e) }));
  }, [token, member]);

  useEffect(() => {
    load();
    api<Location[]>('/locations')
      .then((list) => setLocations(Object.fromEntries(list.map((l) => [l.id, normalizeLocation(l)]))))
      .catch(() => undefined);
  }, [load]);

  async function pay(booking: Booking) {
    if (!token) {
      return;
    }
    setWorkingId(booking.id);
    setMessage({ tone: 'info', text: 'Preparando el pago en Stripe…' });
    try {
      window.location.href = await findCheckoutUrl(booking.id, token);
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
      setWorkingId('');
      load();
    }
  }

  async function cancel(booking: Booking) {
    if (!token) {
      return;
    }
    // Una reserva confirmada con cargo es una reserva que ya se pagó con tarjeta
    const paid = booking.status === 'CONFIRMED' && booking.extraCharge > 0;
    const refundable = paid && bookingRefundable(booking.createdAt);
    const question = !paid
      ? '¿Cancelar esta reserva?'
      : refundable
        ? `¿Cancelar esta reserva? Te devolveremos ${money(booking.extraCharge, booking.currency)} a tu tarjeta.`
        : `¿Cancelar esta reserva? Ya pasaron más de ${BOOKING_REGRET_HOURS} horas desde que la hiciste, así que no hay reembolso.`;
    if (!window.confirm(question)) {
      return;
    }
    setWorkingId(booking.id);
    setMessage(null);
    try {
      await api(`/bookings/${booking.id}/cancel`, { method: 'PATCH', token });
      const what = `${RESOURCE_LABEL[booking.resourceType].toLowerCase()} del ${when(booking).main}`;
      setMessage({
        tone: 'success',
        text: !paid
          ? `Cancelaste tu reserva de ${what}. No tenía cargo, así que no hay nada que devolver.`
          : refundable
            ? `Cancelaste tu reserva de ${what}. Te devolveremos ${money(booking.extraCharge, booking.currency)}: el reembolso se está procesando con Stripe y te llegará un aviso.`
            : `Cancelaste tu reserva de ${what}. Pasaron más de ${BOOKING_REGRET_HOURS} horas desde que la hiciste, así que el pago no se reembolsa.`,
      });
      if (refundable) {
        // Billing reembolsa al recibir el evento booking.cancelled: revisamos en unos segundos
        window.setTimeout(load, 4000);
      }
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setWorkingId('');
    }
  }

  /** Horario en la hora de la sede y, si es otra zona, su equivalencia en la hora del visitante */
  const when = (b: Booking) => {
    const site = locations[b.locationId];
    return describeRange(b.startTime, b.endTime, site?.timeZone ?? DEFAULT_TIME_ZONE, site?.city ?? 'la sede');
  };
  const placeOf = (b: Booking) => {
    const site = locations[b.locationId];
    return site ? `${site.name}, ${site.city}` : 'una sede';
  };

  const now = new Date().toISOString();
  const isUpcoming = (b: Booking) => b.status !== 'CANCELLED' && b.endTime > now;
  // Próximas: de la más cercana a la más lejana. Historial: de la más reciente a la más antigua.
  const upcoming = (bookings ?? []).filter(isUpcoming).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const history = (bookings ?? []).filter((b) => !isUpcoming(b));

  /** Qué pasó con el dinero de una reserva, en palabras del cliente */
  function moneyLine(booking: Booking) {
    if (booking.extraCharge === 0) {
      return 'Incluida en tu plan, sin cargo';
    }
    const amount = money(booking.extraCharge, booking.currency);
    if (booking.status === 'PENDING_PAYMENT') {
      return `${amount} por pagar`;
    }
    if (booking.status === 'CONFIRMED') {
      return `Pagaste ${amount}`;
    }
    if (refunds[booking.id] === 'REFUNDED') {
      return `${amount} reembolsados a tu tarjeta`;
    }
    if (refunds[booking.id] === 'PAID') {
      return `${amount} pagados, sin reembolso`;
    }
    return 'Sin cargo: no se llegó a pagar';
  }

  function renderBooking(booking: Booking) {
    const cancellable = booking.status !== 'CANCELLED' && new Date(booking.startTime) > new Date();
    return (
      <li key={booking.id} className={`booking booking-${TONE[booking.status]}`}>
        <div>
          <p className="booking-when">{when(booking).main}</p>
          {when(booking).local && <p className="small booking-local">{when(booking).local}</p>}
          <p className="muted">
            {RESOURCE_LABEL[booking.resourceType]} en {placeOf(booking)}
          </p>
          <p className="small booking-money">{moneyLine(booking)}</p>
          {booking.bookedBy && booking.bookedBy !== booking.memberId && (
            <p className="muted small">Reservada por el personal de la sede</p>
          )}
        </div>
        <div className="booking-side">
          <StatusTag tone={TONE[booking.status]}>
            {refunds[booking.id] === 'REFUNDED' ? 'Cancelada y reembolsada' : BOOKING_STATUS[booking.status]}
          </StatusTag>
          <div className="booking-actions">
            {booking.status === 'PENDING_PAYMENT' && (
              <button type="button" className="button button-small" disabled={workingId === booking.id} onClick={() => void pay(booking)}>
                Pagar ahora
              </button>
            )}
            {cancellable && (
              <button type="button" className="link-button" disabled={workingId === booking.id} onClick={() => void cancel(booking)}>
                Cancelar reserva
              </button>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <section className="section-head">
        <h1>Mis reservas</h1>
        <button type="button" className="button button-ghost button-small" onClick={load}>
          Actualizar
        </button>
        <p className="muted">
          ¿Te arrepentiste? Si cancelas una reserva pagada en las {BOOKING_REGRET_HOURS} horas siguientes a hacerla, te devolvemos el 100 %.
          Las horas se muestran en la hora local de cada sede.
        </p>
      </section>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!bookings && !message && <Loading label="Cargando tus reservas…" />}

      {bookings && bookings.length === 0 && (
        <div className="empty">
          <p>Aún no tienes reservas.</p>
          <Link href="/" className="button">
            Buscar una sede
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="booking-group">
          <h2>Próximas</h2>
          <ul className="booking-list">{upcoming.map(renderBooking)}</ul>
        </section>
      )}

      {bookings && bookings.length > 0 && upcoming.length === 0 && (
        <div className="empty">
          <p>No tienes reservas próximas.</p>
          <Link href="/" className="button">
            Buscar una sede
          </Link>
        </div>
      )}

      {history.length > 0 && (
        <section className="booking-group">
          <h2>Anteriores y canceladas</h2>
          <ul className="booking-list">{history.map(renderBooking)}</ul>
        </section>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <RequireSession reason="Ingresa para ver tus reservas.">
      <BookingsList />
    </RequireSession>
  );
}
