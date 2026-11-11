import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from './api';

interface Ctx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBalance: (b: number) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const SessionCtx = createContext<Ctx>(null!);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>('/api/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setBalance = (b: number) => setMe((m) => (m ? { ...m, user: { ...m.user, balance: b } } : m));
  const toast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <SessionCtx.Provider value={{ me, loading, refresh, setBalance, toast, toastMsg }}>{children}</SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);
