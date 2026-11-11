import { useEffect, useRef, useState } from 'react';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { CoinArt, CoinBurst, RocketArt, SoundButton } from '../components/Art';
import { engineStart, engineStop, engineUpdate, sfx, unlock } from '../sound';

const MIN = 100, MAX = 50000;

interface Round { id: string; hash: string; startedAt: number; offset: number; growth: number; bet: number }
interface Outcome { status: 'cashed' | 'crashed'; cashoutAt: number | null; payout: number; crashPoint: number; seed: string }

const multAt = (ms: number, g: number) => Math.floor(Math.exp(g * Math.max(0, ms)) * 100) / 100;

export default function Cohete() {
  const { me, setBalance, toast, refresh } = useSession();
  const nav = useNavigate();
  const [bet, setBet] = useState('1000');
  const [autoOn, setAutoOn] = useState(false);
  const [auto, setAuto] = useState('2.00');
  const [round, setRound] = useState<Round | null>(null);
  const [mult, setMult] = useState(1);
  const [out, setOut] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const poll = useRef<number | undefined>(undefined);

  useEffect(() => {
    api('/api/crash/history').then((r) => setHistory(r.history)).catch(() => {});
    return () => {
      cancelAnimationFrame(raf.current!);
      window.clearInterval(poll.current);
      engineStop();
      refresh();
    };
  }, []);

  const finish = (o: Outcome & { balance?: number }) => {
    cancelAnimationFrame(raf.current!);
    window.clearInterval(poll.current);
    engineStop();
    if (o.status === 'crashed') sfx.explosion();
    else sfx.cashout();
    setOut(o);
    setMult(o.status === 'cashed' ? o.cashoutAt! : o.crashPoint);
    setHistory((h) => [o.crashPoint, ...h].slice(0, 8));
    if (o.balance !== undefined) setBalance(o.balance);
    else refresh();
    setBusy(false);
  };

  const start = async () => {
    const b = Math.floor(Number(bet.replace(/,/g, '')));
    if (!(b >= MIN && b <= MAX)) return toast(`La apuesta va de ${fmt(MIN)} a ${fmt(MAX)}.`);
    const a = autoOn ? Number(auto) : null;
    if (autoOn && !(a! >= 1.01)) return toast('El retiro automático debe ser x1.01 o más.');
    unlock();
    sfx.tap();
    setBusy(true);
    setOut(null);
    try {
      const r = await api('/api/crash/start', { body: { bet: b, autoCashout: a } });
      setBalance(r.balance);
      const rd: Round = {
        id: r.id, hash: r.hash, bet: b, growth: r.growthPerMs,
        startedAt: new Date(r.startedAt).getTime(), offset: r.serverNow - Date.now(),
      };
      setRound(rd);
      setBusy(false);
      engineStart();
      const tick = () => {
        const m = multAt(Date.now() + rd.offset - rd.startedAt, rd.growth);
        setMult(m);
        engineUpdate(m);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      poll.current = window.setInterval(async () => {
        try {
          const s = await api(`/api/crash/status?id=${rd.id}`);
          if (s.status !== 'flying') finish(s);
        } catch { /* reintenta en el siguiente ciclo */ }
      }, 250);
    } catch (e: any) {
      setBusy(false);
      toast(e.message);
    }
  };

  const cashout = async () => {
    if (!round || busy) return;
    setBusy(true);
    try {
      const s = await api('/api/crash/cashout', { body: { id: round.id } });
      if (s.status !== 'flying') finish(s);
    } catch (e: any) {
      setBusy(false);
      toast(e.message);
    }
  };

  const flying = !!round && !out;
  const potential = round ? Math.floor(round.bet * mult) : 0;
  const quick = (k: string) => {
    const b = Number(bet.replace(/,/g, '')) || MIN;
    const v = k === '½' ? b / 2 : k === '×2' ? b * 2 : k === '1K' ? 1000 : k === '5K' ? 5000 : Math.min(MAX, me?.user.balance ?? MAX);
    setBet(String(Math.max(MIN, Math.min(MAX, Math.floor(v)))));
  };

  // Curva: tiempo en x, multiplicador en escala log en y
  const elapsed = round ? Math.log(mult) / round.growth : 0;
  const tMax = Math.max(8000, elapsed * 1.15);
  const yMax = Math.log(Math.max(2, mult * 1.25));
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (elapsed * i) / 40;
    const m = Math.exp((round?.growth ?? 0) * t);
    pts.push(`${(t / tMax) * 340},${210 - (Math.log(m) / yMax) * 190}`);
  }
  const [lx, ly] = (pts.at(-1) ?? '0,210').split(',').map(Number);
  const color = out?.status === 'crashed' ? 'var(--pink)' : 'var(--mint)';

  return (
    <div className="screen screen-game">
      <header className="topbar">
        <button type="button" className="icon-btn raised" aria-label="Volver" onClick={() => { sfx.tap(); nav(-1); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <strong className="topbar-title">Cohete</strong>
        <SoundButton />
        <span className="coins"><CoinArt size={22} />{fmt(me?.user.balance ?? 0)}</span>
      </header>
      {history.length > 0 && (
        <div className="hist px20" aria-label="Rondas anteriores">
          {history.map((h, i) => <span key={i} className={`chip-x light ${h >= 2 ? 'good' : ''}`}>x{h.toFixed(2)}</span>)}
        </div>
      )}

      <section className={`rocket-stage2 ${flying ? 'flying' : ''}`} aria-live="polite">
        <div className="stars" aria-hidden="true" />
        <svg width="100%" height="250" viewBox="0 0 350 230" preserveAspectRatio="none" aria-hidden="true">
          {round && (
            <>
              <polygon points={`0,230 ${pts.join(' ')} ${lx},230`} fill={color} opacity=".12" />
              <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {(!round || flying) && (
          <span className="rocket-sprite" style={round ? { left: `calc(${(lx / 350) * 100}% - 18px)`, top: Math.max(0, (ly / 230) * 250 - 46), transform: 'rotate(40deg)' } : { left: 'calc(50% - 18px)', top: 120 }}>
            <RocketArt size={36} flame={flying} />
          </span>
        )}
        {out?.status === 'crashed' && (
          <span className="boom" style={{ left: `calc(${(lx / 350) * 100}% - 50px)`, top: Math.max(0, (ly / 230) * 250 - 60) }} aria-hidden="true" />
        )}
        {out?.status === 'cashed' && <CoinBurst n={18} />}
        <div className="rocket-readout">
          <span className="rocket-x" style={{ color }}>x{mult.toFixed(2)}</span>
          <span className="rocket-sub">
            {!round && 'Apuesta y retira antes de que explote'}
            {flying && 'El cohete sigue subiendo…'}
            {out?.status === 'crashed' && `Explotó en x${out.crashPoint.toFixed(2)}`}
            {out?.status === 'cashed' && `Retiraste a tiempo · explotó en x${out.crashPoint.toFixed(2)}`}
          </span>
        </div>
      </section>

      {out?.status === 'cashed' && <p className="result-banner good pop">¡Ganaste {fmt(out.payout)} monedas!</p>}
      {out?.status === 'crashed' && <p className="result-banner bad">Perdiste {fmt(round!.bet)} monedas</p>}

      <section className="card col gap12">
        <div className="two-cols">
          <label className="field">
            <span>APUESTA</span>
            <input inputMode="numeric" value={bet} disabled={flying} onChange={(e) => setBet(e.target.value.replace(/[^\d]/g, ''))} />
          </label>
          <label className="field">
            <span className="row-between">
              RETIRO AUTOMÁTICO
              <input type="checkbox" checked={autoOn} disabled={flying} onChange={(e) => setAutoOn(e.target.checked)} aria-label="Activar retiro automático" />
            </span>
            <input inputMode="decimal" value={autoOn ? auto : 'Manual'} disabled={!autoOn || flying} onChange={(e) => setAuto(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
        </div>
        <div className="row gap8">
          {['½', '×2', '1K', '5K', 'MÁX'].map((k) => (
            <button key={k} type="button" className="btn btn-raised btn-sm grow" disabled={flying} onClick={() => { sfx.tap(); quick(k); }}>{k}</button>
          ))}
        </div>
        {flying ? (
          <button type="button" className="btn btn-cash btn-xl" onClick={cashout} disabled={busy}>Retirar {fmt(potential)}</button>
        ) : (
          <button type="button" className="btn btn-launch btn-xl" onClick={start} disabled={busy}>
            {out ? 'Jugar otra vez' : 'Despegar'} · {fmt(Number(bet) || 0)}
          </button>
        )}
      </section>

      <section className="card small col gap6">
        <div className="row gap8"><Icon name="shield" size={20} color="var(--acc)" /><strong>Ronda verificable</strong></div>
        <p className="muted">Antes de despegar te damos el hash de la semilla secreta. Al terminar la revelamos: su SHA-256 debe coincidir y de ahí sale el punto de explosión.</p>
        {round && <code className="hash">Hash: {round.hash}</code>}
        {out && <code className="hash">Semilla: {out.seed}</code>}
      </section>

      <p className="disclaimer center">Monedas virtuales sin valor monetario. Solo entretenimiento, +18.</p>
    </div>
  );
}
