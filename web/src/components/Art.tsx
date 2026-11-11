import { useEffect, useState } from 'react';
import { isMuted, onMute, setMuted, sfx, unlock } from '../sound';

/** Degradados compartidos por todas las ilustraciones. Se monta una sola vez en App. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3B0" /><stop offset=".45" stopColor="#F5C542" /><stop offset="1" stopColor="#A86B12" /></linearGradient>
        <linearGradient id="g-goldDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E0A526" /><stop offset="1" stopColor="#7A4A08" /></linearGradient>
        <linearGradient id="g-ruby" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF7A6B" /><stop offset="1" stopColor="#B8321D" /></linearGradient>
        <linearGradient id="g-sapph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FB2FF" /><stop offset="1" stopColor="#2C4FB8" /></linearGradient>
        <linearGradient id="g-jade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8EE3C0" /><stop offset="1" stopColor="#1F8A62" /></linearGradient>
        <radialGradient id="g-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFD166" stopOpacity=".95" /><stop offset="1" stopColor="#FFD166" stopOpacity="0" /></radialGradient>
        <linearGradient id="g-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9A27A" /><stop offset="1" stopColor="#7A5536" /></linearGradient>
        <linearGradient id="g-rocket" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#E3E6F5" /><stop offset="1" stopColor="#A9AECB" /></linearGradient>
        <linearGradient id="g-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3B0" /><stop offset=".5" stopColor="#FFB020" /><stop offset="1" stopColor="#FF4D2E" stopOpacity="0" /></linearGradient>
      </defs>
    </svg>
  );
}

// Los nombres internos del servidor se mantienen; el arte define cómo se ve cada uno.
export type Sym = 'cafe' | 'fruta' | 'coin' | 'gift' | 'tesoro' | 'templo';
export const SYM_NAMES: Record<Sym, string> = {
  cafe: 'Zafiro', fruta: 'Rubí', coin: 'Moneda de oro', gift: 'Máscara de jade', tesoro: 'Pirámide de oro', templo: 'Templo (bono)',
};

export function SymbolArt({ s, size = 52 }: { s: Sym; size?: number }) {
  let inner;
  switch (s) {
    case 'tesoro':
      inner = (<>
        <polygon points="32,6 58,56 6,56" fill="url(#g-gold)" /><polygon points="32,6 58,56 32,56" fill="#000" opacity=".18" />
        <path d="M14 42h36M19 32h26M24 22h16" stroke="#7A4A08" strokeWidth="2.5" opacity=".7" />
        <polygon points="32,6 36,14 28,14" fill="#FFF8D6" /><rect x="28" y="46" width="8" height="10" fill="#5A3606" />
      </>);
      break;
    case 'templo':
      inner = (<>
        <circle cx="32" cy="32" r="31" fill="url(#g-glow)" />
        <path d="M8 56h48v-8H8z M12 48h40v-9H12z M17 39h30v-9H17z M22 30h20v-9H22z" fill="url(#g-stone)" stroke="#1B120A" strokeWidth="1.5" />
        <rect x="28" y="12" width="8" height="9" fill="url(#g-gold)" /><path d="M29 56v-8h6v8" fill="url(#g-gold)" />
        <text x="32" y="63" textAnchor="middle" fontSize="7" fontWeight="900" fill="#7A2A0E" fontFamily="Arial">BONO</text>
      </>);
      break;
    case 'gift':
      inner = (<>
        <path d="M10 14c6-6 38-6 44 0 2 22-6 40-22 44C16 54 8 36 10 14z" fill="url(#g-jade)" stroke="#0C3B2A" strokeWidth="2" />
        <path d="M8 13c8-8 40-8 48 0" stroke="url(#g-gold)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M18 28l9 3-9 3z M46 28l-9 3 9 3z" fill="#0C3B2A" /><path d="M26 44h12" stroke="#0C3B2A" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="22" cy="20" rx="6" ry="3" fill="#fff" opacity=".35" />
      </>);
      break;
    case 'coin':
      inner = (<>
        <circle cx="32" cy="32" r="26" fill="url(#g-goldDark)" /><circle cx="32" cy="30" r="25" fill="url(#g-gold)" />
        <circle cx="32" cy="30" r="19" fill="none" stroke="#A86B12" strokeWidth="2.5" />
        <path d="M32 18l5 8h-10z M24 30h16 M27 36h10 M30 42h4" stroke="#7A4A08" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="24" cy="18" rx="7" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-25 24 18)" />
      </>);
      break;
    case 'fruta':
      inner = (<>
        <polygon points="18,10 46,10 58,26 32,58 6,26" fill="url(#g-ruby)" stroke="#4A0414" strokeWidth="1.5" />
        <polygon points="18,10 46,10 40,26 24,26" fill="#fff" opacity=".35" />
        <path d="M6 26h52 M24 26l8 32 8-32" stroke="#4A0414" strokeWidth="1.2" opacity=".6" fill="none" />
        <polygon points="20,12 28,12 23,20" fill="#fff" opacity=".7" />
      </>);
      break;
    default:
      inner = (<>
        <polygon points="32,6 56,22 50,50 32,60 14,50 8,22" fill="url(#g-sapph)" stroke="#061B4A" strokeWidth="1.5" />
        <polygon points="32,14 46,24 32,34 18,24" fill="#fff" opacity=".3" />
        <path d="M8 22l24 12 24-12 M32 34v26" stroke="#061B4A" strokeWidth="1.2" opacity=".5" fill="none" />
        <polygon points="22,18 28,14 26,22" fill="#fff" opacity=".7" />
      </>);
  }
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">{inner}</svg>;
}

export function RocketArt({ size = 40, flame = true }: { size?: number; flame?: boolean }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" aria-hidden="true">
      {flame && <path className="flame" d="M14 40 Q20 62 26 40 Z" fill="url(#g-flame)" />}
      <path d="M20 2c9 7 11 20 7 34H13C9 22 11 9 20 2z" fill="url(#g-rocket)" stroke="#3B3F6B" strokeWidth="1.5" />
      <path d="M13 28l-7 9 2 4 6-3z M27 28l7 9-2 4-6-3z" fill="#C8401F" stroke="#3B3F6B" strokeWidth="1.2" />
      <circle cx="20" cy="17" r="4.5" fill="#7FB2FF" stroke="#3B3F6B" strokeWidth="1.5" />
      <circle cx="18.5" cy="15.5" r="1.4" fill="#fff" />
      <path d="M14 36h12" stroke="#3B3F6B" strokeWidth="1.5" />
    </svg>
  );
}

export function CoinArt({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="url(#g-goldDark)" /><circle cx="32" cy="30" r="26" fill="url(#g-gold)" />
      <path d="M32 18l5 8h-10z M24 30h16 M27 36h10" stroke="#7A4A08" strokeWidth="3" fill="none" />
    </svg>
  );
}

/** Lluvia de monedas para premios grandes. */
export function CoinBurst({ n = 26 }: { n?: number }) {
  const [items] = useState(() =>
    Array.from({ length: n }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.2 + Math.random() * 0.9,
      size: 18 + Math.random() * 16,
      rot: Math.random() * 360,
      key: i,
    })),
  );
  return (
    <div className="coin-burst" aria-hidden="true">
      {items.map((c) => (
        <span key={c.key} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }}>
          <CoinArt size={c.size} />
        </span>
      ))}
    </div>
  );
}

export function SoundButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMute(setM);
    return () => { off(); };
  }, []);
  return (
    <button
      type="button"
      className="icon-btn raised"
      aria-label={m ? 'Activar sonido' : 'Silenciar sonido'}
      aria-pressed={m}
      onClick={() => {
        unlock();
        setMuted(!m);
        if (m) sfx.tap();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        {m ? <path d="M17 9l5 6M22 9l-5 6" /> : <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></>}
      </svg>
    </button>
  );
}

/** Cuenta hacia arriba un número (premios). */
export function useCountUp(target: number, ms = 900, onTick?: () => void) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return setV(0);
    const start = performance.now();
    let last = 0;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
      setV(val);
      if (onTick && t - last > 70 && p < 1) {
        onTick();
        last = t;
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
