'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { findCheckoutUrl } from '@/lib/payments';
import { BOOKING_STATUS, money, RESOURCE_LABEL, timeRange } from '@/lib/format';
import { bookingRefundable, BOOKING_REFUND_HOURS } from '@/lib/refunds';
import type { Booking, Charge, Location } from '@/lib/types';
import { Loading, Notice, RequireSession, StatusTag } from '@/components/ui';

const TONE = { CONFIRMED: 'ok', PENDING_PAYMENT: 'pending', CANCELLED: 'off' } as const;

function BookingsList() {
  const { token, member } = useApp();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
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
      .then((list) => setLocations(Object.fromEntries(list.map((l) => [l.id, `${l.name}, ${l.city}`]))))
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
    const refundable = paid && bookingRefundable(booking.startTime);
    const question = !paid
      ? '¿Cancelar esta reserva?'
      : refundable
        ? `¿Cancelar esta reserva? Te devolveremos ${money(booking.extraCharge, booking.currency)} a tu tarjeta.`
        : `¿Cancelar esta reserva? Faltan menos de ${BOOKING_REFUND_HOURS} horas, así que no hay reembolso.`;
    if (!window.confirm(question)) {
      return;
    }
    setWorkingId(booking.id);
    setMessage(null);
    try {
      await api(`/bookings/${booking.id}/cancel`, { method: 'PATCH', token });
      if (refundable) {
        setMessage({ tone: 'success', text: 'Reserva cancelada. El reembolso se está procesando con Stripe.' });
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

  return (
    <>
      <section className="section-head">
        <h1>Mis reservas</h1>
        <button type="button" className="button button-ghost button-small" onClick={load}>
          Actualizar
        </button>
        <p className="muted">
          Si cancelas una reserva pagada con {BOOKING_REFUND_HOURS} horas o más de anticipación, te devolvemos el 100 %.
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

      {bookings && bookings.length > 0 && (
        <ul className="booking-list">
          {bookings.map((booking) => {
            const upcoming = new Date(booking.startTime) > new Date();
            return (
              <li key={booking.id} className={`booking booking-${TONE[booking.status]}`}>
                <div>
                  <p className="booking-when">{timeRange(booking.startTime, booking.endTime)}</p>
                  <p className="muted">
                    {RESOURCE_LABEL[booking.resourceType]} en {locations[booking.locationId] ?? 'una sede'}
                  </p>
                  {booking.bookedBy && booking.bookedBy !== booking.memberId && (
                    <p className="muted small">Reservada por el personal de la sede</p>
                  )}
                </div>
                <div className="booking-side">
                  <StatusTag tone={TONE[booking.status]}>{BOOKING_STATUS[booking.status]}</StatusTag>
                  {refunds[booking.id] === 'REFUNDED' && <StatusTag tone="ok">Reembolsada</StatusTag>}
                  {booking.extraCharge > 0 && <span className="muted small">{money(booking.extraCharge, booking.currency)}</span>}
                  <div className="booking-actions">
                    {booking.status === 'PENDING_PAYMENT' && (
                      <button type="button" className="button button-small" disabled={workingId === booking.id} onClick={() => void pay(booking)}>
                        Pagar ahora
                      </button>
                    )}
                    {booking.status !== 'CANCELLED' && upcoming && (
                      <button
                        type="button"
                        className="link-button"
                        disabled={workingId === booking.id}
                        onClick={() => void cancel(booking)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
