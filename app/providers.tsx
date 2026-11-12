'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Country, Member, Session } from '@/lib/types';

interface AppState {
  token: string | null;
  member: Member | null;
  ready: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  countries: Country[];
  countryCode: string;
  setCountryCode: (code: string) => void;
  myCurrency: string;
  rates: Record<string, Record<string, number>>;
  loadRates: (base: string) => void;
}

const AppContext = createContext<AppState | null>(null);

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // el navegador no permite guardar: la sesión vive solo en memoria
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryState] = useState('CO');
  const [rates, setRates] = useState<Record<string, Record<string, number>>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const storedToken = readStorage('cw.token');
    const storedMember = readStorage('cw.member');
    const storedCountry = readStorage('cw.country');
    if (storedToken && storedMember) {
      setToken(storedToken);
      setMember(JSON.parse(storedMember) as Member);
    }
    if (storedCountry) {
      setCountryState(storedCountry);
    }
    setReady(true);
    api<Country[]>('/countries')
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  const signIn = useCallback((session: Session) => {
    setToken(session.accessToken);
    setMember(session.member);
    writeStorage('cw.token', session.accessToken);
    writeStorage('cw.member', JSON.stringify(session.member));
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setMember(null);
    writeStorage('cw.token', null);
    writeStorage('cw.member', null);
  }, []);

  const setCountryCode = useCallback((code: string) => {
    setCountryState(code);
    writeStorage('cw.country', code);
  }, []);

  // Las tasas se piden una sola vez por moneda; Currency Service las guarda en caché
  const loadRates = useCallback((base: string) => {
    if (requested.current.has(base)) {
      return;
    }
    requested.current.add(base);
    api<{ rates: Record<string, number> }>(`/rates?base=${base}`)
      .then((data) => setRates((current) => ({ ...current, [base]: data.rates })))
      .catch(() => requested.current.delete(base));
  }, []);

  const myCurrency = countries.find((c) => c.code === countryCode)?.currency ?? 'COP';

  const value = useMemo<AppState>(
    () => ({
      token,
      member,
      ready,
      signIn,
      signOut,
      countries,
      countryCode,
      setCountryCode,
      myCurrency,
      rates,
      loadRates,
    }),
    [token, member, ready, signIn, signOut, countries, countryCode, setCountryCode, myCurrency, rates, loadRates],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de <Providers>');
  }
  return context;
}

// Convierte un monto de la moneda de la sede a la moneda del visitante
export function useConverted(amount: number, from: string) {
  const { myCurrency, rates, loadRates } = useApp();
  useEffect(() => {
    if (from !== myCurrency) {
      loadRates(from);
    }
  }, [from, myCurrency, loadRates]);

  if (from === myCurrency) {
    return { value: amount, currency: myCurrency, same: true };
  }
  const rate = rates[from]?.[myCurrency];
  return { value: rate === undefined ? null : amount * rate, currency: myCurrency, same: false };
}
