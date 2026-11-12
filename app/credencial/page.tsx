'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useApp } from '../providers';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Location } from '@/lib/types';
import { Notice, RequireSession } from '@/components/ui';

interface Credential {
  token: string;
  expiresAt: string;
}

interface AccessResult {
  granted: boolean;
  reason: string;
}

const REASONS: Record<string, string> = {
  OK: 'Acceso permitido. Bienvenido.',
  CREDENTIAL_REVOKED: 'Acceso negado: la credencial fue desactivada porque la membresía terminó o se generó una nueva.',
  CREDENTIAL_EXPIRED: 'Acceso negado: la credencial venció. Genera una nueva.',
  CREDENTIAL_NOT_FOUND: 'Acceso negado: la credencial no existe.',
};

function CredentialView() {
  const { token, member } = useApp();
  const [credential, setCredential] = useState<Credential | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [access, setAccess] = useState<AccessResult | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
    const storageKey = member ? `cw.credential.${member.id}` : '';

  // La credencial se guarda en el navegador para que siga ahí al cambiar de página
  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        setCredential(JSON.parse(saved) as Credential);
      }
    } catch {
      // el navegador no permite leer el almacenamiento
    }
  }, [storageKey]);

  useEffect(() => {
    api<Location[]>('/locations')
      .then((list) => {
        setLocations(list);
        setLocationId(list[0]?.id ?? '');
      })
      .catch(() => undefined);
  }, []);

  async function issue() {
    if (!token || !member) {
      return;
    }
    setWorking(true);
    setError('');
    setAccess(null);
    try {
      const issued = await api<Credential>('/credentials', { method: 'POST', token, body: { memberId: member.id } });
      setCredential(issued);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(issued));
      } catch {
        // el navegador no permite guardar: la credencial vive solo en esta página
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 403 ? 'Necesitas un plan activo para tener credencial de acceso.' : errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  async function tryDoor() {
    if (!token || !credential || !locationId) {
      return;
    }
    setWorking(true);
    setError('');
    try {
      setAccess(await api<AccessResult>('/access/validate', { method: 'POST', token, body: { token: credential.token, locationId } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <section className="section-head">
        <h1>Tu credencial de acceso</h1>
        <p className="muted">Un código QR que abre las puertas de las sedes. Dura 12 horas y se desactiva sola si tu plan termina.</p>
      </section>

      {error && (
        <Notice tone="error">
          {error} {error.includes('plan') && <Link href="/planes/">Ver planes</Link>}
        </Notice>
      )}

      <div className="credential-layout">
        <div className="credential-card">
          {credential ? (
            <>
              <QRCodeSVG value={credential.token} size={220} level="M" marginSize={2} />
              <p className="muted small">Válida hasta {dateTime(credential.expiresAt)}</p>
            </>
          ) : (
            <p className="muted">Aún no has generado una credencial en este dispositivo.</p>
          )}
          <button type="button" className="button" disabled={working} onClick={() => void issue()}>
            {credential ? 'Generar una nueva' : 'Generar mi credencial'}
          </button>
        </div>

        <div className="door">
          <h2>Simular el lector de la puerta</h2>
          <p className="muted">Así se valida en la entrada de una sede: el lector envía el código y Access Control responde al instante.</p>
          <label className="field">
            <span>Sede</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}, {l.city}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button button-ghost" disabled={!credential || working} onClick={() => void tryDoor()}>
            Pasar por la puerta
          </button>
          {access && (
            <div className={access.granted ? 'door-result granted' : 'door-result denied'} role="status">
              <strong>{access.granted ? 'Puerta abierta' : 'Puerta cerrada'}</strong>
              <span>{REASONS[access.reason] ?? access.reason}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function CredentialPage() {
  return (
    <RequireSession reason="Ingresa para generar tu credencial de acceso.">
      <CredentialView />
    </RequireSession>
  );
}
