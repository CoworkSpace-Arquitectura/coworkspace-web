import { API_URL } from './api';
import { COUNTRY_TIME_ZONE, DEFAULT_TIME_ZONE } from './time';
import type { Location } from './types';

/** Las fotos subidas vienen como ruta relativa; las servimos a través del Gateway. */
export function photoSrc(src: string) {
  return src.startsWith('/') ? `${API_URL}${src}` : src;
}

export function coverOf(location: Pick<Location, 'photos'>) {
  const first = location.photos?.[0];
  return first ? photoSrc(first.src) : null;
}

/**
 * Reduce la imagen en el navegador antes de enviarla (máximo 1600 px, JPEG).
 * Una foto de celular de 4 MB queda en unos 200-400 KB: la base de datos de Space no se llena.
 */
export function resizeImage(file: File, maxSide = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('El navegador no pudo procesar la imagen'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    image.src = url;
  });
}

/**
 * Completa los campos nuevos de una sede si el servicio aún no los envía
 * (por ejemplo, si Space en producción todavía tiene la versión anterior).
 * Así la página nunca se rompe por un campo ausente.
 */
export function normalizeLocation(location: Location): Location {
  return {
    ...location,
    description: location.description ?? '',
    timeZone: location.timeZone ?? COUNTRY_TIME_ZONE[location.country] ?? DEFAULT_TIME_ZONE,
    amenities: location.amenities ?? [],
    photos: location.photos ?? [],
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    managerId: location.managerId ?? null,
    rooms: location.rooms?.map((r) => ({ ...r, kind: r.kind ?? 'MEETING_ROOM' })),
  };
}
