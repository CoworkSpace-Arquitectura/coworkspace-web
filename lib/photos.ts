import { API_URL } from './api';
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
