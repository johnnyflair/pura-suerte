import { useEffect, useRef, useState } from 'react';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { Icon } from '../icons';
import { Disclaimer, Modal, TopBar } from '../components/Chrome';

type Sym = 'cafe' | 'fruta' | 'coin' | 'gift' | 'tesoro' | 'templo';
const SYMS: Sym[] = ['cafe', 'fruta', 'coin', 'gift', 'tesoro', 'templo'];
const COLORS: Record<Sym, string> = {
  cafe: '#E8C39E', fruta: '#F59AB0', coin: '#FFE08A', gift: '#C9B6FF', tesoro: '#FFD166', templo: '#7AD3C0',
};
const NAMES: Record<Sym, string> = {
  cafe: 'Café', fruta: 'Fruta', coin: 'Moneda', gift: 'Regalo', tesoro: 'Pirámide', templo: 'Templo',
};

interface SpinRes {
  grid: Sym[][];
  lineWins: { line: number; symbol: Sym; count: number; amount: number; cells: [number, number][] }[];
  scatterCount: number;
  scatterWin: number;
  freeSpinsAwarded: number;
  totalWin: number;
  freeSpinsLeft: number;
  balance: number;
  wasFree: boolean;
}

const rnd = (): Sym[][] => Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => SYMS[Math.floor(Math.random() * 5)]));

export default function Slot() {
  const { me, setBalance, toast, refresh } = useSession();
  const [meta, setMeta] = useState<any>(null);
  const [grid, setGrid] = useState<Sym[][]>(() => rnd());
  const [stopped, setStopped] = useState(5);
  const [betIdx, setBetIdx] = useState(2);
  const [res, setRes] = useState<SpinRes | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [, setTick] = useState(0);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [freeSpins, setFreeSpins] = useState(me?.freeSpins ?? 0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    api('/api/slot/meta').then(setMeta);
    return () => window.clearInterval(timer.current);
  }, []);
  useEffect(() => setFreeSpins(me?.freeSpins ?? 0), [me?.freeSpins]);

  const steps: number[] = meta?.betSteps ?? [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const bet = steps[betIdx];

  const doSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setRes(null);
    setStopped(0);
    timer.current = window.setInterval(() => setTick((t) => t + 1), 70);
    try {
      const r = await api<SpinRes>('/api/slot/spin', { body: { bet } });
      const base = turbo ? 150 : 550, step = turbo ? 70 : 180;
      setGrid(r.grid);
      for (let reel = 0; reel < 5; reel++) {
        window.setTimeout(() => {
          setStopped(reel + 1);
          if (reel === 4) {
            window.clearInterval(timer.current);
            setRes(r);
            setBalance(r.balance);
            setFreeSpins(r.freeSpinsLeft);
            setSpinning(false);
            if (r.freeSpinsAwarded) toast(`¡${r.freeSpinsAwarded} giros gratis en el templo!`);
          }
        }, base + reel * step);
      }
    } catch (e: any) {
      window.clearInterval(timer.current);
      setStopped(5);
      setSpinning(false);
      setAuto(0);
      toast(e.message);
    }
  };

  // Juego automático: dispara el siguiente giro cuando termina el anterior
  useEffect(() => {
    if (auto > 0 && !spinning) {
      const t = window.setTimeout(() => {
        setAuto((a) => a - 1);
        doSpin();
      }, res && res.totalWin > 0 ? 900 : 350);
      return () => window.clearTimeout(t);
    }
  }, [auto, spinning]);

  useEffect(() => () => { refresh(); }, []);

  const winCells = new Set(res?.lineWins.flatMap((w) => w.cells.map(([a, b]) => `${a}-${b}`)) ?? []);
  const shown = spinning ? grid.map((col, i) => (i < stopped ? col : rnd()[i])) : grid;

  return (
    <div className="screen screen-game">
      <TopBar title="Tesoro Maya" />
      <section className="slot-machine">
        <div className="slot-top">
          <span>5 RODILLOS · 20 LÍNEAS</span>
          {meta && <span className="yel">RTP {meta.rtp}%</span>}
        </div>
        <div className="reels" aria-live="polite">
          {[0, 1, 2].map((row) =>
            shown.map((col, reel) => {
              const s = col[row];
              const win = !spinning && (winCells.has(`${reel}-${row}`) || (res && res.scatterCount >= 3 && s === 'templo'));
              return (
                <span key={`${reel}-${row}`} className={`cell ${win ? 'win' : ''} ${spinning && reel >= stopped ? 'blur' : ''}`}
                  style={{ background: COLORS[s], gridColumn: reel + 1, gridRow: row + 1 }} aria-label={NAMES[s]}>
                  <Icon name={s} size={30} color="var(--tx)" />
                </span>
              );
            }),
          )}
        </div>
        <div className="slot-result">
          {res && res.totalWin > 0 ? (
            <>
              <span className="small light">
                {res.lineWins.length > 0 && `${res.lineWins.length} línea${res.lineWins.length > 1 ? 's' : ''} ganadora${res.lineWins.length > 1 ? 's' : ''}`}
                {res.scatterWin > 0 && ` · ${res.scatterCount} templos`}
              </span>
              <strong className="slot-win">¡Ganaste {fmt(res.totalWin)}!</strong>
            </>
          ) : (
            <span className="light">{spinning ? 'Girando…' : res ? 'Sin premio esta vez' : 'Busca 3 pirámides o más en línea'}</span>
          )}
        </div>
      </section>

      <section className="card row gap12">
        <Icon name="templo" size={24} color="var(--acc)" />
        <span className="grow small">
          {freeSpins > 0 ? (
            <><strong>{freeSpins} giros gratis</strong><br /><span className="muted">Con apuesta de {fmt(me?.freeSpinBet || bet)} cada uno</span></>
          ) : (
            <><strong>Templo de giros gratis</strong><br /><span className="muted">3 templos en cualquier lugar = 10 giros gratis</span></>
          )}
        </span>
      </section>

      <section className="slot-controls">
        <div className="col gap6">
          <span className="label">APUESTA POR GIRO</span>
          <div className="row gap8">
            <button type="button" className="step-btn" aria-label="Bajar apuesta" disabled={spinning || betIdx === 0 || freeSpins > 0} onClick={() => setBetIdx((i) => i - 1)}>−</button>
            <strong className="bet-val">{fmt(bet)}</strong>
            <button type="button" className="step-btn" aria-label="Subir apuesta" disabled={spinning || betIdx === steps.length - 1 || freeSpins > 0} onClick={() => setBetIdx((i) => i + 1)}>+</button>
          </div>
        </div>
        <button type="button" className="spin-btn" onClick={doSpin} disabled={spinning}>
          {freeSpins > 0 ? 'GRATIS' : 'GIRAR'}
        </button>
      </section>

      <section className="row gap10 px20">
        <button type="button" className={`btn btn-outline grow ${auto > 0 ? 'on' : ''}`} onClick={() => setAuto(auto > 0 ? 0 : 10)}>
          {auto > 0 ? `Detener (${auto})` : 'Auto ×10'}
        </button>
        <button type="button" className={`btn btn-outline grow ${turbo ? 'on' : ''}`} aria-pressed={turbo} onClick={() => setTurbo(!turbo)}>Turbo</button>
        <button type="button" className="btn btn-outline grow" onClick={() => setShowPay(true)}>Pagos</button>
      </section>

      <Disclaimer />

      {showPay && meta && (
        <Modal title="Tabla de pagos" onClose={() => setShowPay(false)}>
          <p className="muted small">Pagos por línea para una apuesta de {fmt(bet)} (cada línea vale {fmt(bet / 20)}). Las combinaciones pagan de izquierda a derecha desde el primer rodillo.</p>
          <table className="pay-table">
            <thead><tr><th>Símbolo</th><th>×3</th><th>×4</th><th>×5</th></tr></thead>
            <tbody>
              {(['tesoro', 'gift', 'coin', 'fruta', 'cafe'] as const).map((s) => (
                <tr key={s}>
                  <td><span className="pay-sym" style={{ background: COLORS[s] }}><Icon name={s} size={18} /></span>{NAMES[s]}</td>
                  {meta.paytable[s].map((m: number, i: number) => <td key={i}>{fmt((m * bet) / 20)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small"><strong>Templo:</strong> 3 o más en cualquier posición pagan {meta.scatterPay}× la apuesta y dan {meta.freeSpins} giros gratis.</p>
          <p className="muted small">Retorno teórico al jugador: {meta.rtp}%.</p>
        </Modal>
      )}
    </div>
  );
}
