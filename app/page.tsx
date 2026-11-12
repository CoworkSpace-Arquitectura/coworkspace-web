'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from './providers';
import { api, errorMessage } from '@/lib/api';
import type { Location } from '@/lib/types';
import { Loading, Notice } from '@/components/ui';

export default function HomePage() {
  const { countries, countryCode, myCurrency } = useApp();
  const [destination, setDestination] = useState('');
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setLocations(null);
    setError('');
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 4000);
    api<Location[]>(destination ? `/locations?country=${destination}` : '/locations')
      .then(setLocations)
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => window.clearTimeout(timer));
    return () => window.clearTimeout(timer);
  }, [destination]);

  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  return (
    <>
      <section className="hero">
        <h1>Un escritorio listo en cada ciudad a la que vayas.</h1>
        <p className="hero-sentence">
          Estás en <strong>{countryName(countryCode)}</strong> y ves los precios también en <strong>{myCurrency}</strong>. Busco espacio
          en{' '}
          <select className="inline-select" value={destination} onChange={(e) => setDestination(e.target.value)} aria-label="País de destino">
            <option value="">cualquier país</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          .
        </p>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {!locations && !error && <Loading label={slow ? 'Despertando los servicios, puede tardar hasta un minuto…' : 'Buscando sedes…'} />}

      {locations && locations.length === 0 && (
        <div className="empty">
          <p>No hay sedes en {countryName(destination)} todavía.</p>
          <button type="button" className="button button-ghost" onClick={() => setDestination('')}>
            Ver todas las sedes
          </button>
        </div>
      )}

      {locations && locations.length > 0 && (
        <ul className="location-list">
          {locations.map((location) => (
            <li key={location.id}>
              <Link href={`/sede/?id=${location.id}`} className="location-row">
                <span className="location-city">{location.city}</span>
                <span className="location-name">{location.name}</span>
                <span className="location-meta">
                  {location.address}, {countryName(location.country)}
                </span>
                <span className="location-currency">Cobra en {location.currency}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
