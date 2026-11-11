import { useEffect, useState } from 'react';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { Modal } from './Chrome';

const SEG_COLORS = ['#FFD166', '#F59AB0', '#7AD3C0', '#9DB8FF', '#FFB38A', '#C9B6FF'];
const SEG_VALUES = [1000, 2000, 5000, 10000, 25000, 50000];

export function WheelSvg({ size, rotation = 0, animate = false }: { size: number; rotation?: number; animate?: boolean }) {
  const r = 46;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: '50px 50px',
          transition: animate ? 'transform 4s cubic-bezier(.12,.8,.18,1)' : 'none',
        }}
      >
        {SEG_VALUES.map((v, i) => {
          const a0 = ((i * 60 - 90) * Math.PI) / 180, a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
          const mid = ((i * 60 + 30 - 90) * Math.PI) / 180;
          return (
            <g key={i}>
              <path
                d={`M50 50 L${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)} Z`}
                fill={SEG_COLORS[i]} stroke="#2A1A12" strokeWidth="1.5"
              />
              {size > 140 && (
                <text x={50 + 30 * Math.cos(mid)} y={50 + 30 * Math.sin(mid)} fontSize="6.5" fontWeight="800" fill="#2A1A12"
                  textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * 60 + 30} ${50 + 30 * Math.cos(mid)} ${50 + 30 * Math.sin(mid)})`}>
                  {v >= 1000 ? `${v / 1000}K` : v}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <circle cx="50" cy="50" r="8" fill="#fff" stroke="#2A1A12" strokeWidth="1.5" />
      <path d="M50 1 L45 11 H55 Z" fill="#2A1A12" />
    </svg>
  );
}

export function WheelModal({ onClose }: { onClose: () => void }) {
  const { setBalance, refresh, toast } = useSession();
  const [rot, setRot] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const spin = async () => {
    setBusy(true);
    try {
      const r = await api<{ segment: number; coins: number; balance: number }>('/api/bonus/wheel', { method: 'POST' });
      // el segmento i queda arriba (bajo el puntero) cuando la rueda gira -(i*60+30)
      setRot(360 * 6 - (r.segment * 60 + 30));
      window.setTimeout(() => {
        setResult(r.coins);
        setBalance(r.balance);
        refresh();
      }, 4100);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Rueda diaria" onClose={onClose}>
      <div className="wheel-modal">
        <WheelSvg size={260} rotation={rot} animate />
        {result === null ? (
          <button type="button" className="btn btn-acc btn-lg" disabled={busy} onClick={spin}>
            {busy ? 'Girando…' : 'Girar'}
          </button>
        ) : (
          <>
            <strong className="big-win">¡Ganaste {fmt(result)} monedas!</strong>
            <button type="button" className="btn btn-dark" onClick={onClose}>Seguir jugando</button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function AdModal({ onClose }: { onClose: () => void }) {
  const { setBalance, refresh, toast } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [left, setLeft] = useState(30);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    api<{ token: string; seconds: number }>('/api/ads/start', { method: 'POST' })
      .then((r) => {
        setToken(r.token);
        setLeft(r.seconds);
      })
      .catch((e) => {
        toast(e.message);
        onClose();
      });
  }, []);

  useEffect(() => {
    if (!token || left <= 0) return;
    const t = window.setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => window.clearTimeout(t);
  }, [token, left]);

  const claim = async () => {
    try {
      const r = await api<{ coins: number; balance: number }>('/api/ads/claim', { body: { token } });
      setBalance(r.balance);
      setDone(r.coins);
      refresh();
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <Modal title="Anuncio" onClose={onClose}>
      <div className="ad-box">
        {done !== null ? (
          <>
            <strong className="big-win">+{fmt(done)} monedas</strong>
            <button type="button" className="btn btn-dark" onClick={onClose}>Listo</button>
          </>
        ) : (
          <>
            <div className="ad-placeholder">
              <span>Espacio del anuncio</span>
              <small>Aquí se mostrará el video de la red de anuncios</small>
            </div>
            {left > 0 ? (
              <p className="muted">Tu recompensa estará lista en {left} s</p>
            ) : (
              <button type="button" className="btn btn-acc btn-lg" onClick={claim}>Reclamar 1,000 monedas</button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
