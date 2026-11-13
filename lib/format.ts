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

/** Tipos de espacio que ofrece una sede. Para Booking todos son "ROOM" salvo los puestos. */
export const ROOM_KIND = {
  MEETING_ROOM: { one: 'Sala de reuniones', many: 'Salas de reuniones' },
  PRIVATE_OFFICE: { one: 'Oficina privada', many: 'Oficinas privadas' },
  AUDITORIUM: { one: 'Auditorio', many: 'Auditorios' },
  PHONE_BOOTH: { one: 'Cabina telefónica', many: 'Cabinas telefónicas' },
} as const;

export const ROOM_KINDS = Object.keys(ROOM_KIND) as (keyof typeof ROOM_KIND)[];

/** Servicios sugeridos al crear una sede; también se pueden escribir otros. */
export const AMENITY_SUGGESTIONS = [
  'Wi-Fi de alta velocidad',
  'Café y agua',
  'Aire acondicionado',
  'Recepción',
  'Parqueadero',
  'Lockers',
  'Impresora',
  'Terraza',
  'Acceso 24 horas',
  'Cocina',
];

export const ROLE_LABEL = { MEMBER: 'Socio', MANAGER: 'Gerente', OWNER: 'Jefe' } as const;

export const BOOKING_STATUS = {
  CONFIRMED: 'Confirmada',
  PENDING_PAYMENT: 'Pendiente de pago',
  CANCELLED: 'Cancelada',
} as const;
