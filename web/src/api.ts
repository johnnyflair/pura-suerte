export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Algo salió mal.', data);
  return data as T;
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export interface Me {
  user: { id: number; display_name: string; email: string; balance: number; daily_spend_limit_cents: number | null };
  wheelAvailableAt: string | null;
  giftAvailableAt: string | null;
  adsLeft: number;
  freeSpins: number;
  freeSpinBet: number;
  mission: { id: string; title: string; coins: number; progress: number; goal: number; claimed: boolean };
  welcomeOfferAvailable: boolean;
}

export function timeLeft(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
