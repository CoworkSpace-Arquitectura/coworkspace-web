export interface GeoPoint {
  latitude: number;
  longitude: number;
  label: string;
}

/**
 * Busca una dirección en Nominatim (el buscador gratuito de OpenStreetMap).
 * Sus reglas de uso piden pocas consultas: solo se llama cuando el gerente pulsa "Buscar".
 */
export async function geocode(query: string, countryCode?: string): Promise<GeoPoint[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': 'es' });
  if (countryCode) {
    params.set('countrycodes', countryCode.toLowerCase());
  }
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('El buscador de direcciones no respondió. Ubica el punto haciendo clic en el mapa.');
  }
  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  return results.map((r) => ({ latitude: Number(r.lat), longitude: Number(r.lon), label: r.display_name }));
}

/** Enlace para abrir la ubicación en OpenStreetMap y pedir la ruta desde ahí. */
export function directionsUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}#map=17/${latitude}/${longitude}`;
}
