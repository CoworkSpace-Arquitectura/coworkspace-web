'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useApp } from '../../providers';
import { api, errorMessage } from '@/lib/api';
import { AMENITY_SUGGESTIONS, money, ROOM_KIND, ROOM_KINDS } from '@/lib/format';
import { normalizeLocation, photoSrc, resizeImage } from '@/lib/photos';
import { geocode } from '@/lib/geo';
import { allTimeZones, COUNTRY_TIME_ZONE, DEFAULT_TIME_ZONE } from '@/lib/time';
import type { GeoPoint } from '@/lib/geo';
import type { Location, Member, RoomKind } from '@/lib/types';
import { Loading, Notice, RequireStaff } from '@/components/ui';
import { LocationMap } from '@/components/LocationMap';

type Message = { tone: 'error' | 'success' | 'info'; text: string } | null;

interface Draft {
  name: string;
  city: string;
  address: string;
  country: string;
  currency: string;
  timeZone: string;
  description: string;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
}

const EMPTY: Draft = {
  name: '',
  city: '',
  address: '',
  country: 'CO',
  currency: 'COP',
  timeZone: DEFAULT_TIME_ZONE,
  description: '',
  amenities: [],
  latitude: null,
  longitude: null,
};

function LocationEditor() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const { token, member } = useApp();
  const isOwner = member?.role === 'OWNER';
  const [location, setLocation] = useState<Location | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) {
      return;
    }
    api<Location>(`/locations/${id}`)
      .then((raw) => {
        const l = normalizeLocation(raw);
        setLocation(l);
        setDraft({
          name: l.name,
          city: l.city,
          address: l.address,
          country: l.country,
          currency: l.currency,
          timeZone: l.timeZone,
          description: l.description,
          amenities: l.amenities,
          latitude: l.latitude,
          longitude: l.longitude,
        });
      })
      .catch((e: unknown) => setMessage({ tone: 'error', text: errorMessage(e) }))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return <Loading label="Cargando la sede…" />;
  }
  if (location && member && !isOwner && location.managerId !== member.id) {
    return <Notice tone="error">Esta sede no está a tu cargo. Solo su gerente o el jefe pueden editarla.</Notice>;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const body = {
      ...draft,
      latitude: draft.latitude ?? undefined,
      longitude: draft.longitude ?? undefined,
    };
    try {
      if (location) {
        await api(`/locations/${location.id}`, { method: 'PATCH', token, body });
        setMessage({ tone: 'success', text: 'Cambios guardados.' });
        load();
      } else {
        const created = await api<Location>('/locations', { method: 'POST', token, body });
        router.replace(`/gestion/sede/?id=${created.id}`);
        setMessage({ tone: 'success', text: 'Sede creada. Ahora agrega fotos y espacios.' });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!location || !window.confirm(`¿Eliminar "${location.name}" con todos sus espacios y fotos? No se puede deshacer.`)) {
      return;
    }
    try {
      await api(`/locations/${location.id}`, { method: 'DELETE', token });
      router.push('/gestion/');
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <div className="editor">
      <div className="detail-top">
        <Link href="/gestion/" className="back">
          Volver a gestión
        </Link>
        {location && (
          <Link href={`/sede/?id=${location.id}`} className="button button-ghost button-small">
            Ver como cliente
          </Link>
        )}
      </div>
      <h1>{location ? location.name : 'Nueva sede'}</h1>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <form onSubmit={(e) => void save(e)} className="editor-form">
        <DetailsFields draft={draft} setDraft={setDraft} />
        <LocationPicker draft={draft} setDraft={setDraft} />
        <div className="editor-save">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Guardando…' : location ? 'Guardar cambios' : 'Crear sede'}
          </button>
          {!location && <span className="muted small">Después de crearla podrás subir fotos y agregar espacios.</span>}
        </div>
      </form>

      {location && isOwner && <ManagerAssignment location={location} onChange={load} />}
      {location && <PhotosSection location={location} onChange={load} />}
      {location && <SpacesSection location={location} onChange={load} />}

      {location && isOwner && (
        <section className="editor-section danger-zone">
          <h2>Eliminar sede</h2>
          <p className="muted">Solo el jefe puede hacerlo. Se borran también sus espacios y fotos.</p>
          <button type="button" className="button button-danger" onClick={() => void remove()}>
            Eliminar esta sede
          </button>
        </section>
      )}
    </div>
  );
}

type DraftProps = { draft: Draft; setDraft: (update: (d: Draft) => Draft) => void };

function DetailsFields({ draft, setDraft }: DraftProps) {
  const { countries } = useApp();
  const [custom, setCustom] = useState('');
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (a: string) =>
    set({ amenities: draft.amenities.includes(a) ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a] });
  const extra = draft.amenities.filter((a) => !AMENITY_SUGGESTIONS.includes(a));

  return (
    <section className="editor-section">
      <h2>Datos de la sede</h2>
      <div className="grid-2">
        <label className="field">
          <span>Nombre</span>
          <input required value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Ciudad</span>
          <input required value={draft.city} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <label className="field">
          <span>Dirección</span>
          <input required value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder="Calle 27 #1-50" />
        </label>
        <div className="grid-2 tight">
          <label className="field">
            <span>País</span>
            <select
              value={draft.country}
              onChange={(e) => {
                const country = countries.find((c) => c.code === e.target.value);
                set({
                  country: e.target.value,
                  currency: country?.currency ?? draft.currency,
                  timeZone: COUNTRY_TIME_ZONE[e.target.value] ?? draft.timeZone,
                });
              }}
            >
              {countries.length === 0 && <option value={draft.country}>{draft.country}</option>}
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Moneda de cobro</span>
            <input
              required
              value={draft.currency}
              maxLength={3}
              onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            />
          </label>
        </div>
      </div>
      <label className="field narrow">
        <span>Zona horaria (las reservas se eligen en esta hora)</span>
        <select value={draft.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
          {[...new Set([draft.timeZone, ...allTimeZones()])].map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Descripción para los clientes</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Cómo es el lugar, qué hay cerca, horario de atención…"
        />
      </label>
      <fieldset className="field">
        <legend>Servicios</legend>
        <div className="chip-picker">
          {[...AMENITY_SUGGESTIONS, ...extra].map((a) => (
            <button key={a} type="button" aria-pressed={draft.amenities.includes(a)} onClick={() => toggle(a)}>
              {a}
            </button>
          ))}
        </div>
        <div className="inline-add">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otro servicio" aria-label="Otro servicio" />
          <button
            type="button"
            className="button button-ghost button-small"
            disabled={!custom.trim()}
            onClick={() => {
              if (!draft.amenities.includes(custom.trim())) {
                set({ amenities: [...draft.amenities, custom.trim()] });
              }
              setCustom('');
            }}
          >
            Agregar
          </button>
        </div>
      </fieldset>
    </section>
  );
}

function LocationPicker({ draft, setDraft }: DraftProps) {
  const [results, setResults] = useState<GeoPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const pick = useCallback(
    (latitude: number, longitude: number) =>
      setDraft((d) => ({ ...d, latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) })),
    [setDraft],
  );

  async function search() {
    setSearching(true);
    setError('');
    setResults([]);
    try {
      const found = await geocode(`${draft.address}, ${draft.city}`, draft.country);
      if (found.length === 0) {
        setError('No se encontró esa dirección. Haz clic en el mapa para ubicar el punto a mano.');
      } else if (found.length === 1) {
        pick(found[0].latitude, found[0].longitude);
      } else {
        setResults(found);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  const point =
    draft.latitude !== null && draft.longitude !== null
      ? [{ id: 'pin', latitude: draft.latitude, longitude: draft.longitude }]
      : [];

  return (
    <section className="editor-section">
      <h2>Ubicación exacta</h2>
      <p className="muted small">
        Busca la dirección o haz clic en el mapa. Puedes arrastrar el pin hasta la puerta del edificio.
      </p>
      <div className="inline-add">
        <button type="button" className="button button-ghost button-small" disabled={searching || !draft.address || !draft.city} onClick={() => void search()}>
          {searching ? 'Buscando…' : 'Buscar la dirección en el mapa'}
        </button>
        {point.length > 0 && (
          <span className="muted small">
            {draft.latitude}, {draft.longitude}
          </span>
        )}
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
      {results.length > 1 && (
        <ul className="geo-results">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  pick(r.latitude, r.longitude);
                  setResults([]);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <LocationMap points={point} onPick={pick} height={360} zoom={17} label="Mapa para ubicar la sede" />
      <p className="muted small">Direcciones y mapa de OpenStreetMap (Nominatim).</p>
    </section>
  );
}

function ManagerAssignment({ location, onChange }: { location: Location; onChange: () => void }) {
  const { token } = useApp();
  const [managers, setManagers] = useState<Member[]>([]);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    api<Member[]>('/members', { token })
      .then((all) => setManagers(all.filter((m) => m.role === 'MANAGER')))
      .catch(() => setManagers([]));
  }, [token]);

  async function assign(event: ChangeEvent<HTMLSelectElement>) {
    const managerId = event.target.value || null;
    try {
      await api(`/locations/${location.id}/manager`, { method: 'PATCH', token, body: { managerId } });
      setMessage({ tone: 'success', text: managerId ? 'Gerente asignado.' : 'La sede quedó sin gerente.' });
      onChange();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <section className="editor-section">
      <h2>Gerente a cargo</h2>
      <p className="muted small">
        El gerente podrá editar esta sede, sus fotos y espacios, y ver y hacer reservas en ella. Para que alguien aparezca aquí,
        dale el rol de gerente en Gestión, pestaña Equipo.
      </p>
      <label className="field narrow">
        <span>Gerente</span>
        <select value={location.managerId ?? ''} onChange={(e) => void assign(e)}>
          <option value="">Sin gerente (solo el jefe)</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
      </label>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </section>
  );
}

function PhotosSection({ location, onChange }: { location: Location; onChange: () => void }) {
  const { token } = useApp();
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [working, setWorking] = useState(false);
  const full = location.photos.length >= 10;

  async function add(body: { url?: string; dataUrl?: string }) {
    await api(`/locations/${location.id}/photos`, { method: 'POST', token, body });
  }

  async function addUrl(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      await add({ url: url.trim() });
      setUrl('');
      onChange();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setWorking(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 10 - location.photos.length);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    setWorking(true);
    setMessage({ tone: 'info', text: `Subiendo ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}…` });
    try {
      for (const file of files) {
        await add({ dataUrl: await resizeImage(file) });
      }
      setMessage({ tone: 'success', text: 'Fotos subidas.' });
      onChange();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
      onChange();
    } finally {
      setWorking(false);
    }
  }

  async function remove(photoId: string) {
    try {
      await api(`/locations/${location.id}/photos/${photoId}`, { method: 'DELETE', token });
      onChange();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <section className="editor-section">
      <h2>Fotos</h2>
      <p className="muted small">
        Hasta 10. La primera es la portada. Si no hay fotos, la sede se muestra con un plano ilustrado.
      </p>
      {location.photos.length > 0 && (
        <ul className="photo-grid">
          {location.photos.map((photo, index) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(photo.src)} alt={`Foto ${index + 1}`} />
              {index === 0 && <span className="photo-badge">Portada</span>}
              <button type="button" className="photo-remove" onClick={() => void remove(photo.id)} aria-label={`Quitar foto ${index + 1}`}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!full && (
        <div className="photo-add">
          <label className="button button-small upload">
            Subir desde el equipo
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={working} onChange={(e) => void upload(e)} />
          </label>
          <form className="inline-add" onSubmit={(e) => void addUrl(e)}>
            <input
              type="url"
              required
              pattern="https://.*"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… enlace a una imagen"
              aria-label="Enlace a una imagen"
            />
            <button type="submit" className="button button-ghost button-small" disabled={working}>
              Agregar enlace
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function SpacesSection({ location, onChange }: { location: Location; onChange: () => void }) {
  const { token } = useApp();
  const [message, setMessage] = useState<Message>(null);
  const [room, setRoom] = useState({ name: '', kind: 'MEETING_ROOM' as RoomKind, capacity: 6, hourlyRate: 30000, equipment: '' });
  const [desk, setDesk] = useState({ code: '', isDedicated: false, hourlyRate: 15000 });

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      onChange();
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
      return false;
    }
  }

  async function addRoom(event: FormEvent) {
    event.preventDefault();
    const equipment = Object.fromEntries(
      room.equipment
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [s, true]),
    );
    const ok = await run(
      () =>
        api('/rooms', {
          method: 'POST',
          token,
          body: { locationId: location.id, name: room.name, kind: room.kind, capacity: room.capacity, hourlyRate: room.hourlyRate, equipment },
        }),
      `${ROOM_KIND[room.kind].one} agregada.`,
    );
    if (ok) {
      setRoom((r) => ({ ...r, name: '', equipment: '' }));
    }
  }

  async function addDesk(event: FormEvent) {
    event.preventDefault();
    const ok = await run(
      () => api('/desks', { method: 'POST', token, body: { locationId: location.id, ...desk } }),
      `Puesto ${desk.code} agregado.`,
    );
    if (ok) {
      setDesk((d) => ({ ...d, code: '' }));
    }
  }

  function remove(path: string, label: string) {
    if (window.confirm(`¿Quitar ${label}? Las reservas ya hechas se conservan.`)) {
      void run(() => api(path, { method: 'DELETE', token }), `${label} quitado.`);
    }
  }

  const rooms = location.rooms ?? [];
  const desks = location.desks ?? [];

  return (
    <section className="editor-section">
      <h2>Espacios</h2>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {rooms.length + desks.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Espacio</th>
              <th>Tipo</th>
              <th className="num">Capacidad</th>
              <th className="num">Precio por hora</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{ROOM_KIND[r.kind].one}</td>
                <td className="num">{r.capacity}</td>
                <td className="num">{money(r.hourlyRate, location.currency)}</td>
                <td>
                  <button type="button" className="link-button danger" onClick={() => remove(`/rooms/${r.id}`, r.name)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {desks.map((d) => (
              <tr key={d.id}>
                <td>Puesto {d.code}</td>
                <td>{d.isDedicated ? 'Escritorio dedicado' : 'Puesto flexible'}</td>
                <td className="num">1</td>
                <td className="num">{money(d.hourlyRate, location.currency)}</td>
                <td>
                  <button type="button" className="link-button danger" onClick={() => remove(`/desks/${d.id}`, `Puesto ${d.code}`)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="two-columns">
        <form className="form panel-block" onSubmit={(e) => void addRoom(e)}>
          <h3>Agregar sala u oficina</h3>
          <label className="field">
            <span>Tipo</span>
            <select value={room.kind} onChange={(e) => setRoom({ ...room, kind: e.target.value as RoomKind })}>
              {ROOM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ROOM_KIND[k].one}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nombre</span>
            <input required value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} placeholder="Sala Sinú" />
          </label>
          <div className="grid-2 tight">
            <label className="field">
              <span>Capacidad</span>
              <input type="number" min={1} required value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>Precio por hora ({location.currency})</span>
              <input type="number" min={0} required value={room.hourlyRate} onChange={(e) => setRoom({ ...room, hourlyRate: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field">
            <span>Equipamiento (separado por comas)</span>
            <input value={room.equipment} onChange={(e) => setRoom({ ...room, equipment: e.target.value })} placeholder="proyector, pizarra" />
          </label>
          <button type="submit" className="button button-small">
            Agregar
          </button>
        </form>

        <form className="form panel-block" onSubmit={(e) => void addDesk(e)}>
          <h3>Agregar puesto de trabajo</h3>
          <label className="field">
            <span>Código</span>
            <input required value={desk.code} onChange={(e) => setDesk({ ...desk, code: e.target.value })} placeholder="M-02" />
          </label>
          <label className="field">
            <span>Precio por hora ({location.currency})</span>
            <input type="number" min={0} required value={desk.hourlyRate} onChange={(e) => setDesk({ ...desk, hourlyRate: Number(e.target.value) })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={desk.isDedicated} onChange={(e) => setDesk({ ...desk, isDedicated: e.target.checked })} />
            Escritorio dedicado
          </label>
          <button type="submit" className="button button-small">
            Agregar
          </button>
        </form>
      </div>
    </section>
  );
}

export default function LocationEditorPage() {
  return (
    <RequireStaff>
      <Suspense fallback={<Loading />}>
        <LocationEditor />
      </Suspense>
    </RequireStaff>
  );
}
