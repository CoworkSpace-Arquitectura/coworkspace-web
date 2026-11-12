export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = (d: Date) => d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${hour(start)} a ${hour(end)}`;
}

export const RESOURCE_LABEL = { ROOM: 'Sala', DESK: 'Puesto' } as const;

export const BOOKING_STATUS = {
  CONFIRMED: 'Confirmada',
  PENDING_PAYMENT: 'Pendiente de pago',
  CANCELLED: 'Cancelada',
} as const;
