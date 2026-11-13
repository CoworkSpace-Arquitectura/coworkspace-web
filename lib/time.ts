// Horas en la zona horaria de cada sede.
// Las reservas se guardan en UTC (un instante exacto). Para mostrarlas o elegirlas,
// se convierten a la hora local de la sede con la API Intl del navegador.

export const DEFAULT_TIME_ZONE = 'America/Bogota';

/** Zona horaria del visitante, según su navegador. */
export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Diferencia en milisegundos entre la hora de una zona y UTC en un instante dado. */
function offsetMs(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant;
}

/**
 * "El 2026-11-14 a las 9:00 en Madrid" → instante exacto (Date).
 * Se corrige dos veces para acertar también en los días de cambio de horario.
 */
export function zonedDate(day: string, hour: number, timeZone: string) {
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, 0, 0);
  let instant = wall - offsetMs(wall, timeZone);
  instant = wall - offsetMs(instant, timeZone);
  return new Date(instant);
}

/** Fecha de hoy (AAAA-MM-DD) en una zona, sumando días. */
export function dayInZone(timeZone: string, plusDays = 0) {
  const date = new Date(Date.now() + plusDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const hourFormat = (timeZone: string) =>
  new Intl.DateTimeFormat('es-CO', { timeZone, hour: '2-digit', minute: '2-digit' });

const dayFormat = (timeZone: string) =>
  new Intl.DateTimeFormat('es-CO', { timeZone, weekday: 'long', day: 'numeric', month: 'long' });

/** "sábado, 14 de noviembre, 09:00 a 11:00" en la zona indicada. */
export function rangeInZone(startIso: string, endIso: string, timeZone: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const hour = hourFormat(timeZone);
  return `${dayFormat(timeZone).format(start)}, ${hour.format(start)} a ${hour.format(end)}`;
}

/** Hora corta en una zona: "02:00 a. m." */
export function hourInZone(iso: string | Date, timeZone: string) {
  return hourFormat(timeZone).format(new Date(iso));
}

/** ¿Dos zonas marcan la misma hora en este instante? (Bogotá y Lima, por ejemplo) */
export function sameClock(a: string, b: string, at = new Date()) {
  return offsetMs(at.getTime(), a) === offsetMs(at.getTime(), b);
}

/**
 * Texto para el visitante: si la sede está en otra zona, agrega la equivalencia.
 * "sábado, 14 de noviembre, 09:00 a 11:00 (hora de Madrid) · 03:00 a 05:00 en tu hora"
 */
export function describeRange(startIso: string, endIso: string, siteZone: string, siteCity: string) {
  const main = rangeInZone(startIso, endIso, siteZone);
  const mine = viewerTimeZone();
  if (sameClock(siteZone, mine, new Date(startIso))) {
    return { main, local: null };
  }
  return {
    main: `${main} (hora de ${siteCity})`,
    local: `${hourInZone(startIso, mine)} a ${hourInZone(endIso, mine)} en tu hora`,
  };
}

/** Zonas sugeridas por país (el jefe o gerente puede elegir otra). */
export const COUNTRY_TIME_ZONE: Record<string, string> = {
  AR: 'America/Argentina/Buenos_Aires',
  BR: 'America/Sao_Paulo',
  CA: 'America/Toronto',
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  CR: 'America/Costa_Rica',
  DE: 'Europe/Berlin',
  EC: 'America/Guayaquil',
  ES: 'Europe/Madrid',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  IT: 'Europe/Rome',
  JP: 'Asia/Tokyo',
  MX: 'America/Mexico_City',
  PA: 'America/Panama',
  PE: 'America/Lima',
  PT: 'Europe/Lisbon',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  VE: 'America/Caracas',
};

/** Todas las zonas que conoce el navegador, para el selector del editor. */
export function allTimeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return Object.values(COUNTRY_TIME_ZONE);
  }
}
