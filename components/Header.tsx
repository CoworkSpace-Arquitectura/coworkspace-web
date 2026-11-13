'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { api } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Sedes' },
  { href: '/planes/', label: 'Planes' },
  { href: '/reservas/', label: 'Mis reservas' },
  { href: '/credencial/', label: 'Credencial' },
  { href: '/comunidad/', label: 'Comunidad' },
];

// Solo para gerentes y el jefe
const STAFF_LINKS = [
  { href: '/gestion/', label: 'Gestión' },
  { href: '/panel/', label: 'Métricas' },
];

export function Header() {
  const { member, token, signOut, countries, countryCode, setCountryCode, myCurrency } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Avisos sin leer: Notification Service, consultado cada 30 segundos
  useEffect(() => {
    if (!token || !member) {
      setUnread(0);
      return;
    }
    const load = () =>
      api<{ unread: number }>(`/notifications/unread-count?memberId=${member.id}`, { token })
        .then((data) => setUnread(data.unread))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [token, member, pathname]);

  return (
    <header className="site-header">
      <div className={member && member.role !== 'MEMBER' ? 'header-inner compact' : 'header-inner'}>
        <Link href="/" className="brand">
          Cowork<span>Space</span>
        </Link>

        <nav className="main-nav" aria-label="Principal">
          {[...LINKS, ...(member && member.role !== 'MEMBER' ? STAFF_LINKS : [])].map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href)) ? 'active' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-tools">
          <label className="country-picker">
            <span>Estoy en</span>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Tu país">
              {countries.length === 0 && <option value={countryCode}>{countryCode}</option>}
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="currency-chip">{myCurrency}</span>
          </label>

          {member ? (
            <>
              <Link href="/notificaciones/" className="bell" aria-label={`Avisos: ${unread} sin leer`}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    d="M12 3a6 6 0 0 0-6 6v3.5L4.5 15v1.5h15V15L18 12.5V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <span className="who">{member.name.split(' ')[0]}</span>
              {(member.role === 'OWNER' || member.role === 'MANAGER') && <span className="role-chip">{member.role === 'OWNER' ? 'Jefe' : 'Gerente'}</span>}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  signOut();
                  router.push('/');
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link href="/ingresar/" className="button button-small">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
