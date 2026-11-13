'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from './providers';
import { api, errorMessage } from '@/lib/api';
import { ROOM_KIND, ROOM_KINDS } from '@/lib/format';
import { coverOf, normalizeLocation } from '@/lib/photos';
import type { Desk, Location, Room, RoomKind } from '@/lib/types';
import { DualPrice, Loading, Notice } from '@/components/ui';
import { SpacePicture } from '@/components/SpacePicture';
import { LocationMap } from '@/components/LocationMap';

type SpaceFilter = '' | 'DESK' | RoomKind;

interface Catalog {
  locations: Location[];
  rooms: Room[];
  desks: Desk[];
}

export default function HomePage() {
  const { countries, countryCode, myCurrency } = useApp();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const [view, setView] = useState<'grid' | 'map'>('grid');

  // Lo que el visitante escribe en el buscador
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [space, setSpace] = useState<SpaceFilter>('');
  const [people, setPeople] = useState(1);

  // Tres consultas públicas a Space (sedes, salas y puestos) y el filtro se hace aquí
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000);
    Promise.all([api<Location[]>('/locations'), api<Room[]>('/rooms'), api<Desk[]>('/desks')])
      .then(([locations, rooms, desks]) =>
        setCatalog({
          locations: locations.map(normalizeLocation),
          rooms: rooms.map((r) => ({ ...r, kind: r.kind ?? 'MEETING_ROOM' })),
          desks,
        }),
      )
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => window.clearTimeout(timer));
    return () => window.clearTimeout(timer);
  }, []);

  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  const cities = useMemo(
    () => [...new Set((catalog?.locations ?? []).filter((l) => !country || l.country === country).map((l) => l.city))].sort(),
    [catalog, country],
  );

  const results = useMemo(() => {
    if (!catalog) {
      return [];
    }
    return catalog.locations
      .filter((l) => !country || l.country === country)
      .filter((l) => !city || l.city === city)
      .map((location) => {
        const rooms = catalog.rooms.filter(
          (r) => r.locationId === location.id && r.capacity >= people && (!space || space === 'DESK' || r.kind === space),
        );
        const desks = catalog.desks.filter((d) => d.locationId === location.id);
        const offered = space === 'DESK' ? desks : space ? rooms : [...rooms, ...(people <= 1 ? desks : [])];
        const from = offered.length > 0 ? Math.min(...offered.map((o) => o.hourlyRate)) : null;
        return { location, offered: offered.length, from, rooms, desks };
      })
      .filter((r) => r.offered > 0 || (!space && people <= 1));
  }, [catalog, country, city, space, people]);

  const mapPoints = results
    .filter((r) => r.location.latitude !== null && r.location.longitude !== null)
    .map((r) => ({
      id: r.location.id,
      latitude: r.location.latitude as number,
      longitude: r.location.longitude as number,
      title: r.location.name,
      subtitle: `${r.location.city}, ${countryName(r.location.country)}`,
      href: `/sede/?id=${r.location.id}`,
    }));

  return (
    <>
      <section className="search-hero">
        <h1>Oficinas y salas listas para trabajar, en cada ciudad a la que vayas.</h1>
        <form className="search-bar" onSubmit={(e) => e.preventDefault()} aria-label="Buscar espacios">
          <label className="search-field">
            <span>País</span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setCity('');
              }}
            >
              <option value="">Todos los países</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>Ciudad</span>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Todas las ciudades</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>Tipo de espacio</span>
            <select value={space} onChange={(e) => setSpace(e.target.value as SpaceFilter)}>
              <option value="">Cualquiera</option>
              <option value="DESK">Puesto de trabajo</option>
              {ROOM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ROOM_KIND[k].one}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field search-field-narrow">
            <span>Personas</span>
            <input type="number" min={1} max={200} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} />
          </label>
        </form>
        <p className="search-note">
          Navegas desde {countryName(countryCode)}: junto a cada precio verás cuánto es en {myCurrency}.
        </p>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {!catalog && !error && <Loading label={slow ? 'Despertando los servicios, puede tardar hasta un minuto…' : 'Buscando sedes…'} />}

      {catalog && (
        <div className="results-head">
          <h2>
            {results.length === 0
              ? 'Ninguna sede coincide con tu búsqueda'
              : `${results.length} ${results.length === 1 ? 'sede disponible' : 'sedes disponibles'}`}
          </h2>
          <div className="view-switch" role="group" aria-label="Forma de ver los resultados">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
              Lista
            </button>
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
              Mapa
            </button>
          </div>
        </div>
      )}

      {catalog && results.length === 0 && (
        <div className="empty">
          <p>Prueba con otra ciudad, otro tipo de espacio o menos personas.</p>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setCountry('');
              setCity('');
              setSpace('');
              setPeople(1);
            }}
          >
            Quitar filtros
          </button>
        </div>
      )}

      {catalog && view === 'map' && results.length > 0 && (
        <>
          <LocationMap points={mapPoints} height={480} label="Mapa de las sedes encontradas" />
          {mapPoints.length < results.length && (
            <p className="muted small">
              {results.length - mapPoints.length} {results.length - mapPoints.length === 1 ? 'sede aún no tiene' : 'sedes aún no tienen'} ubicación
              en el mapa.
            </p>
          )}
        </>
      )}

      {catalog && view === 'grid' && results.length > 0 && (
        <ul className="card-grid">
          {results.map(({ location, from, rooms, desks }) => (
            <li key={location.id}>
              <Link href={`/sede/?id=${location.id}`} className="space-card">
                <div className="space-card-picture">
                  <SpacePicture src={coverOf(location)} seed={location.id} alt={location.name} />
                  {location.photos.length > 1 && <span className="photo-count">{location.photos.length} fotos</span>}
                </div>
                <div className="space-card-body">
                  <p className="space-card-place">
                    {location.city}, {countryName(location.country)}
                  </p>
                  <h3>{location.name}</h3>
                  <p className="space-card-offer">{offerLine(rooms, desks)}</p>
                  {location.amenities.length > 0 && (
                    <p className="space-card-amenities">{location.amenities.slice(0, 3).join(' / ')}</p>
                  )}
                  {from !== null && (
                    <div className="space-card-price">
                      <span className="muted small">Desde</span>
                      <DualPrice amount={from} currency={location.currency} unit="por hora" />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function offerLine(rooms: Room[], desks: Desk[]) {
  const parts: string[] = [];
  for (const kind of ROOM_KINDS) {
    const count = rooms.filter((r) => r.kind === kind).length;
    if (count > 0) {
      parts.push(`${count} ${count === 1 ? ROOM_KIND[kind].one.toLowerCase() : ROOM_KIND[kind].many.toLowerCase()}`);
    }
  }
  if (desks.length > 0) {
    parts.push(`${desks.length} ${desks.length === 1 ? 'puesto' : 'puestos'}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Aún sin espacios publicados';
}
