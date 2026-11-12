'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../providers';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { CommunityEvent, Location, Profile } from '@/lib/types';
import { Loading, Notice, RequireSession } from '@/components/ui';

function CommunityView() {
  const { token } = useApp();
  const [profile, setProfile] = useState<Profile>({ memberId: '', displayName: '', profession: '', bio: '', visible: true });
  const [directory, setDirectory] = useState<Profile[] | null>(null);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(() => {
    if (!token) {
      return;
    }
    api<Profile>('/directory/me', { token })
      .then(setProfile)
      .catch(() => undefined);
    api<Profile[]>('/directory', { token })
      .then((list) => {
        setDirectory(list);
        setBlocked(false);
      })
      .catch((e: unknown) => {
        setDirectory([]);
        setBlocked(e instanceof ApiError && e.status === 403);
      });
    api<CommunityEvent[]>('/events')
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [token]);

  useEffect(() => {
    load();
    api<Location[]>('/locations')
      .then(setLocations)
      .catch(() => undefined);
  }, [load]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api('/directory/me', {
        method: 'PUT',
        token,
        body: {
          displayName: profile.displayName,
          profession: profile.profession ?? '',
          bio: profile.bio,
          visible: profile.visible ?? true,
        },
      });
      setMessage({ tone: 'success', text: 'Guardamos tu perfil.' });
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  async function register(eventId: string) {
    setMessage(null);
    try {
      await api(`/events/${eventId}/register`, { method: 'POST', token });
      setMessage({ tone: 'success', text: 'Quedaste inscrito en el evento.' });
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? 'Sede';

  if (!directory) {
    return <Loading label="Cargando la comunidad…" />;
  }

  if (blocked) {
    return (
      <div className="empty">
        <p>La comunidad es para miembros con un plan activo.</p>
        <Link href="/planes/" className="button">
          Ver planes
        </Link>
      </div>
    );
  }

  return (
    <>
      <section className="section-head">
        <h1>Comunidad</h1>
        <p className="muted">Conoce a quienes trabajan en las sedes y súmate a los encuentros.</p>
      </section>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="community-layout">
        <form className="form profile-form" onSubmit={(e) => void saveProfile(e)}>
          <h2>Tu perfil</h2>
          <label className="field">
            <span>Nombre visible</span>
            <input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} required />
          </label>
          <label className="field">
            <span>A qué te dedicas</span>
            <input value={profile.profession ?? ''} onChange={(e) => setProfile({ ...profile, profession: e.target.value })} />
          </label>
          <label className="field">
            <span>Sobre ti</span>
            <textarea rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={profile.visible ?? true} onChange={(e) => setProfile({ ...profile, visible: e.target.checked })} />
            Aparecer en el directorio
          </label>
          <button type="submit" className="button">
            Guardar perfil
          </button>
        </form>

        <div>
          <h2>Directorio</h2>
          {directory.length === 0 && <p className="muted">Nadie ha publicado su perfil todavía. Sé el primero.</p>}
          <ul className="people">
            {directory.map((person) => (
              <li key={person.memberId}>
                <span className="avatar" aria-hidden="true">
                  {person.displayName.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{person.displayName}</strong>
                  {person.profession && <span className="muted"> · {person.profession}</span>}
                  {person.bio && <p className="muted small">{person.bio}</p>}
                </div>
              </li>
            ))}
          </ul>

          <h2>Próximos encuentros</h2>
          {events.length === 0 && <p className="muted">No hay encuentros programados.</p>}
          <ul className="events">
            {events.map((event) => {
              const full = event._count.registrations >= event.capacity;
              return (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <p className="muted small">
                      {dateTime(event.scheduledAt)} en {locationName(event.locationId)}. {event.capacity - event._count.registrations} de{' '}
                      {event.capacity} cupos libres.
                    </p>
                  </div>
                  <button type="button" className="button button-small" disabled={full} onClick={() => void register(event.id)}>
                    {full ? 'Sin cupos' : 'Inscribirme'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

export default function CommunityPage() {
  return (
    <RequireSession reason="Ingresa para ver la comunidad.">
      <CommunityView />
    </RequireSession>
  );
}
