'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../providers';
import { api, errorMessage } from '@/lib/api';
import { BOOKING_STATUS, money, RESOURCE_LABEL, ROLE_LABEL, timeRange } from '@/lib/format';
import { coverOf, normalizeLocation } from '@/lib/photos';
import type { Booking, Location, Member, Plan, ResourceType, Role } from '@/lib/types';
import { Loading, Notice, RequireStaff, StatusTag } from '@/components/ui';
import { SpacePicture } from '@/components/SpacePicture';

type Tab = 'sedes' | 'reservas' | 'equipo' | 'planes';
type StaffMember = Member & { createdAt?: string };

const TONE = { CONFIRMED: 'ok', PENDING_PAYMENT: 'pending', CANCELLED: 'off' } as const;

function Management() {
  const { member, token } = useApp();
  const isOwner = member?.role === 'OWNER';
  const [tab, setTab] = useState<Tab>('sedes');
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [people, setPeople] = useState<StaffMember[]>([]);
  const [error, setError] = useState('');

  // El jefe ve todas las sedes; un gerente, solo las que tiene a cargo
  const loadLocations = useCallback(() => {
    if (!member) {
      return;
    }
    api<Location[]>(isOwner ? '/locations' : `/locations?managerId=${member.id}`)
      .then((list) => setLocations(list.map(normalizeLocation)))
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [member, isOwner]);

  const loadPeople = useCallback(() => {
    api<StaffMember[]>('/members', { token })
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [token]);

  useEffect(loadLocations, [loadLocations]);
  useEffect(loadPeople, [loadPeople]);

  const names = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sedes', label: isOwner ? 'Sedes' : 'Mis sedes' },
    { id: 'reservas', label: 'Reservas' },
    ...(isOwner ? ([{ id: 'equipo', label: 'Equipo' }, { id: 'planes', label: 'Planes' }] as const) : []),
  ];

  return (
    <>
      <section className="section-head">
        <h1>Gestión</h1>
        <p className="muted">
          {isOwner
            ? 'Como jefe puedes administrar todas las sedes, asignar gerentes, cambiar roles y crear planes.'
            : 'Administra las sedes a tu cargo: datos, ubicación, fotos, espacios y reservas.'}
        </p>
      </section>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!locations && !error && <Loading label="Cargando sedes…" />}

      {locations && tab === 'sedes' && <LocationsTab locations={locations} names={names} isOwner={isOwner} />}
      {locations && tab === 'reservas' && <BookingsTab locations={locations} names={names} />}
      {tab === 'equipo' && isOwner && <TeamTab people={people} reload={loadPeople} />}
      {tab === 'planes' && isOwner && <PlansTab />}
    </>
  );
}

function LocationsTab({ locations, names, isOwner }: { locations: Location[]; names: Record<string, string>; isOwner: boolean }) {
  return (
    <>
      <div className="panel-title">
        <h2>
          {locations.length} {locations.length === 1 ? 'sede' : 'sedes'}
        </h2>
        <Link href="/gestion/sede/" className="button button-small">
          Nueva sede
        </Link>
      </div>
      {locations.length === 0 && (
        <p className="muted">
          {isOwner ? 'Aún no hay sedes.' : 'No tienes sedes a cargo. Crea una o pide al jefe que te asigne alguna.'}
        </p>
      )}
      <ul className="admin-list">
        {locations.map((location) => (
          <li key={location.id}>
            <div className="admin-thumb">
              <SpacePicture src={coverOf(location)} seed={location.id} alt={location.name} />
            </div>
            <div>
              <h3>{location.name}</h3>
              <p className="muted small">
                {location.city} ({location.country}), cobra en {location.currency}
              </p>
              <p className="small checklist">
                <span className={location.latitude !== null ? 'done' : 'todo'}>Ubicación en el mapa</span>
                <span className={location.photos.length > 0 ? 'done' : 'todo'}>
                  {location.photos.length} {location.photos.length === 1 ? 'foto' : 'fotos'}
                </span>
                {isOwner && (
                  <span className={location.managerId ? 'done' : 'todo'}>
                    {location.managerId ? `Gerente: ${names[location.managerId] ?? 'asignado'}` : 'Sin gerente'}
                  </span>
                )}
              </p>
            </div>
            <div className="admin-actions">
              <Link href={`/sede/?id=${location.id}`} className="link-button">
                Ver
              </Link>
              <Link href={`/gestion/sede/?id=${location.id}`} className="button button-ghost button-small">
                Editar
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookingsTab({ locations, names }: { locations: Location[]; names: Record<string, string> }) {
  const { token } = useApp();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(() => {
    if (!locationId) {
      return;
    }
    setBookings(null);
    api<Booking[]>(`/bookings?locationId=${locationId}`, { token })
      .then((list) => setBookings([...list].sort((a, b) => a.startTime.localeCompare(b.startTime))))
      .catch((e: unknown) => setMessage({ tone: 'error', text: errorMessage(e) }));
  }, [locationId, token]);

  useEffect(load, [load]);

  async function cancel(booking: Booking) {
    const paid = booking.status === 'CONFIRMED' && booking.extraCharge > 0;
    const refundNote = paid ? ` Como la cancela el personal, se le devuelven ${money(booking.extraCharge, booking.currency)} completos.` : '';
    if (!window.confirm(`¿Cancelar la reserva de ${names[booking.memberId] ?? 'este socio'}? Se le enviará un aviso.${refundNote}`)) {
      return;
    }
    try {
      await api(`/bookings/${booking.id}/cancel`, { method: 'PATCH', token });
      setMessage({ tone: 'success', text: 'Reserva cancelada.' });
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  if (locations.length === 0) {
    return <p className="muted">Cuando tengas sedes a cargo, aquí verás sus reservas.</p>;
  }

  const now = new Date().toISOString();
  const visible = (bookings ?? []).filter((b) => showPast || b.endTime >= now);
  const location = locations.find((l) => l.id === locationId);

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span>Sede</span>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.city})
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Incluir reservas pasadas
        </label>
        {location && (
          <Link href={`/sede/?id=${location.id}`} className="button button-small">
            Reservar para un cliente
          </Link>
        )}
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!bookings && <Loading label="Cargando reservas…" />}
      {bookings && visible.length === 0 && <p className="muted">No hay reservas {showPast ? '' : 'próximas '}en esta sede.</p>}

      {visible.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cuándo</th>
              <th>Socio</th>
              <th>Espacio</th>
              <th>Estado</th>
              <th className="num">Cargo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => (
              <tr key={b.id}>
                <td>{timeRange(b.startTime, b.endTime)}</td>
                <td>
                  {names[b.memberId] ?? 'Socio'}
                  {b.bookedBy && b.bookedBy !== b.memberId && (
                    <span className="muted small block">Reservó {names[b.bookedBy] ?? 'el personal'}</span>
                  )}
                </td>
                <td>{RESOURCE_LABEL[b.resourceType as ResourceType]}</td>
                <td>
                  <StatusTag tone={TONE[b.status]}>{BOOKING_STATUS[b.status]}</StatusTag>
                </td>
                <td className="num">{b.extraCharge > 0 ? money(b.extraCharge, b.currency) : 'Incluida'}</td>
                <td>
                  {b.status !== 'CANCELLED' && b.startTime > now && (
                    <button type="button" className="link-button danger" onClick={() => void cancel(b)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function TeamTab({ people, reload }: { people: StaffMember[]; reload: () => void }) {
  const { token, member } = useApp();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function changeRole(person: StaffMember, role: Role) {
    setMessage(null);
    try {
      await api(`/members/${person.id}/role`, { method: 'PATCH', token, body: { role } });
      setMessage({
        tone: 'success',
        text: `${person.name} ahora es ${ROLE_LABEL[role].toLowerCase()}. Verá el cambio la próxima vez que inicie sesión.`,
      });
      reload();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.includes(q));
  const order: Record<Role, number> = { OWNER: 0, MANAGER: 1, MEMBER: 2 };

  return (
    <>
      <p className="muted">
        Un gerente administra solo las sedes que crea o que le asignas en cada sede. Nadie puede cambiar su propio rol.
      </p>
      <div className="toolbar">
        <label className="field">
          <span>Buscar persona</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o correo" />
        </label>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
          </tr>
        </thead>
        <tbody>
          {[...filtered]
            .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
            .map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td className="muted">{person.email}</td>
                <td>
                  {person.id === member?.id ? (
                    <span className="role-chip role-chip-light">{ROLE_LABEL[person.role]} (tú)</span>
                  ) : (
                    <select
                      value={person.role}
                      aria-label={`Rol de ${person.name}`}
                      onChange={(e) => void changeRole(person, e.target.value as Role)}
                    >
                      <option value="MEMBER">Socio</option>
                      <option value="MANAGER">Gerente</option>
                      <option value="OWNER">Jefe</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}

function PlansTab() {
  const { token } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(250000);
  const [access, setAccess] = useState<ResourceType[]>(['DESK']);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    api<Plan[]>('/plans').then(setPlans).catch(() => setPlans([]));
  }, []);
  useEffect(load, [load]);

  function toggle(type: ResourceType) {
    setAccess((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      await api('/plans', { method: 'POST', token, body: { name, price, resourceAccess: access } });
      setMessage({ tone: 'success', text: `Plan ${name} creado.` });
      setName('');
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="two-columns">
      <form className="form panel-block" onSubmit={(e) => void create(e)}>
        <h2>Nuevo plan</h2>
        <label className="field">
          <span>Nombre</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Precio mensual (COP)</span>
          <input type="number" required min={0} step={1000} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <fieldset className="field">
          <legend>Qué incluye sin costo adicional</legend>
          <label className="check">
            <input type="checkbox" checked={access.includes('DESK')} onChange={() => toggle('DESK')} />
            Puestos de trabajo
          </label>
          <label className="check">
            <input type="checkbox" checked={access.includes('ROOM')} onChange={() => toggle('ROOM')} />
            Salas, oficinas, auditorios y cabinas
          </label>
        </fieldset>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <button type="submit" className="button" disabled={working || access.length === 0}>
          {working ? 'Creando…' : 'Crear plan'}
        </button>
      </form>
      <div>
        <h2>Planes publicados</h2>
        <ul className="plain-list">
          {plans.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <span className="muted">
                {money(p.price, 'COP')} al mes. Incluye {p.resourceAccess.map((r) => (r === 'DESK' ? 'puestos' : 'salas')).join(' y ')}.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  return (
    <RequireStaff>
      <Management />
    </RequireStaff>
  );
}
