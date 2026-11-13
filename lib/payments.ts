import { api, ApiError } from './api';
import type { Charge } from './types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Saga: Booking (o Membership) publica el evento y Billing crea el pago en Stripe.
// Ese paso es asíncrono, así que esperamos hasta que el enlace de pago exista.
async function waitForCheckout(path: string, token: string, what: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const charge = await api<Charge>(path, { token });
      if (charge.status === 'PENDING' && charge.checkoutUrl) {
        return charge.checkoutUrl;
      }
      if (charge.status !== 'PENDING') {
        throw new ApiError(409, charge.status === 'PAID' ? `${what} ya está pagado.` : `El pago de ${what.toLowerCase()} ya no está disponible.`);
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
    await wait(1500);
  }
  throw new ApiError(504, 'El pago tardó demasiado en prepararse. Intenta de nuevo en un momento.');
}

/** Enlace de pago de una reserva fuera del plan. */
export function findCheckoutUrl(bookingId: string, token: string) {
  return waitForCheckout(`/charges/booking/${bookingId}`, token, 'Esta reserva');
}

/** Enlace de pago del primer mes de un plan. */
export function findPlanCheckoutUrl(subscriptionId: string, token: string) {
  return waitForCheckout(`/charges/subscription/${subscriptionId}`, token, 'Este plan');
}
