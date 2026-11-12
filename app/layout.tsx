import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'CoworkSpace',
  description: 'Reserva salas y puestos de trabajo en sedes de varios países.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main className="page">{children}</main>
          <footer className="site-footer">
            CoworkSpace, proyecto de microservicios. Tasas de cambio de{' '}
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">
              ExchangeRate-API
            </a>
            . Pagos en modo de prueba de Stripe.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
