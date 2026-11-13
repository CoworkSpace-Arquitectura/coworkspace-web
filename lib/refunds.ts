// Misma política que aplica Billing (el servicio dueño del dinero decide; aquí solo se informa).
export const BOOKING_REFUND_HOURS = 24;
export const PLAN_GUARANTEE_DAYS = 7;
const HOUR = 3_600_000;

/** ¿Una reserva pagada que se cancela ahora recibe reembolso? */
export function bookingRefundable(startTime: string, now = new Date()) {
  return new Date(startTime).getTime() - now.getTime() >= BOOKING_REFUND_HOURS * HOUR;
}

/** ¿Un plan pagado en esta fecha está dentro de la garantía de 7 días? */
export function planRefundable(paidAt: string, now = new Date()) {
  return now.getTime() - new Date(paidAt).getTime() <= PLAN_GUARANTEE_DAYS * 24 * HOUR;
}
