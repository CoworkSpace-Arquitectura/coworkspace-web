import { api, ApiError } from './api';
import type { Charge } from './types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Saga: Booking publica la reserva, Billing crea el pago en Stripe.
// Ese paso es asíncrono, así que esperamos hasta que el enlace de pago exista.
export async function findCheckoutUrl(bookingId: string, token: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const charge = await api<Charge>(`/charges/booking/${bookingId}`, { token });
      if (charge.status === 'PENDING' && charge.checkoutUrl) {
        return charge.checkoutUrl;
      }
      if (charge.status !== 'PENDING') {
        throw new ApiError(409, charge.status === 'PAID' ? 'Esta reserva ya está pagada.' : 'El pago de esta reserva ya no está disponible.');
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
    await wait(1500);
  }
  throw new ApiError(504, 'El pago tardó demasiado en prepararse. Intenta de nuevo desde Mis reservas.');
}
