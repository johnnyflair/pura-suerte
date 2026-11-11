import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { Modal } from '../components/Chrome';
import { CoinArt, CoinBurst, SoundButton, SymbolArt, SYM_NAMES, useCountUp, type Sym } from '../components/Art';
import { sfx, startMusic, stopMusic, unlock } from '../sound';

const SPIN_SYMS: Sym[] = ['cafe', 'fruta', 'coin', 'gift', 'tesoro', 'templo'];

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
  bet: number;
}

const rndCol = (n = 3): Sym[] => Array.from({ length: n }, () => SPIN_SYMS[Math.floor(Math.random() * 5)]);
const rndGrid = () => Array.from({ length: 5 }, () => rndCol());

export default function Slot() {
  const { me, setBalance, toast, refresh } = useSession();
  const nav = useNavigate();
  const [meta, setMeta] = useState<any>(null);
  const [grid, setGrid] = useState<Sym[][]>(rndGrid);
  const [stopped, setStopped] = useState(5);
  const [betIdx, setBetIdx] = useState(3);
  const [res, setRes] = useState<SpinRes | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showBig, setShowBig] = useState(false);
  const [freeSpins, setFreeSpins] = useState(me?.freeSpins ?? 0);
  const [spinId, setSpinId] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    api('/api/slot/meta').then(setMeta);
    startMusic();
    return () => {
      stopMusic();
      timers.current.forEach(clearTimeout);
      refresh();
    };
  }, []);
  useEffect(() => setFreeSpins(me?.freeSpins ?? 0), [me?.freeSpins]);

  const steps: number[] = meta?.betSteps ?? [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const bet = steps[betIdx];
  const big = !!res && res.totalWin >= res.bet * 10;
  const shownWin = useCountUp(res?.totalWin ?? 0, big ? 1600 : 700, sfx.coinTick);

  const doSpin = async () => {
    if (spinning) return;
    unlock();
    sfx.spinStart();
    setSpinning(true);
    setRes(null);
    setShowBig(false);
    setStopped(0);
    setSpinId((x) => x + 1);
    try {
      const r = await api<SpinRes>('/api/slot/spin', { body: { bet } });
      setGrid(r.grid);
      const base = turbo ? 200 : 650, step = turbo ? 90 : 230;
      for (let reel = 0; reel < 5; reel++) {
        timers.current.push(window.setTimeout(() => {
          setStopped(reel + 1);
          sfx.reelStop(reel);
          if (r.grid[reel].includes('templo')) sfx.wheelTick();
          if (reel === 4) {
            setRes(r);
            setBalance(r.balance);
            setFreeSpins(r.freeSpinsLeft);
            setSpinning(false);
            const isBig = r.totalWin >= r.bet * 10;
            setShowBig(isBig);
            if (r.freeSpinsAwarded) {
              sfx.scatter();
              toast(`¡${r.freeSpinsAwarded} giros gratis en el templo!`);
            } else if (isBig) sfx.winBig();
            else if (r.totalWin > 0) sfx.winSmall();
          }
        }, base + reel * step));
      }
    } catch (e: any) {
      setStopped(5);
      setSpinning(false);
      setAuto(0);
      toast(e.message);
    }
  };

  useEffect(() => {
    if (auto > 0 && !spinning) {
      const t = window.setTimeout(() => {
        setAuto((a) => a - 1);
        doSpin();
      }, res && res.totalWin > 0 ? (big ? 2400 : 1000) : 400);
      return () => window.clearTimeout(t);
    }
  }, [auto, spinning]);

  useEffect(() => {
    if (!showBig) return;
    const t = window.setTimeout(() => setShowBig(false), 2600);
    return () => window.clearTimeout(t);
  }, [showBig]);

  const winCells = new Set(res?.lineWins.flatMap((w) => w.cells.map(([a, b]) => `${a}-${b}`)) ?? []);
  // tiras de símbolos que pasan mientras gira cada rodillo
  const strips = useMemo(() => Array.from({ length: 5 }, () => rndCol(12)), [spinId]);
  const bestLine = res?.lineWins.slice().sort((a, b) => b.amount - a.amount)[0];

  return (
    <div className="screen screen-game slot-screen">
      <svg className="slot-bg" viewBox="0 0 390 300" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <circle cx="330" cy="40" r="120" fill="#FFD166" opacity=".35" />
        <path d="M0 230 L80 140 L130 190 L200 110 L280 200 L340 150 L390 190 V300 H0Z" fill="#F3C9A0" opacity=".55" />
        <path d="M150 210h90v-14h-78v-14h66v-14h-54v-14h42v-14h-30" fill="none" stroke="#E2A97A" strokeWidth="3" opacity=".8" />
      </svg>

      <header className="topbar">
        <button type="button" className="icon-btn raised" aria-label="Volver" onClick={() => { sfx.tap(); nav(-1); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <strong className="topbar-title">Tesoro Maya</strong>
        <SoundButton />
        <span className="coins"><CoinArt size={22} />{fmt(me?.user.balance ?? 0)}</span>
      </header>

      <section className="cabinet">
        <div className="cabinet-top">
          <span>20 LÍNEAS</span>
          {freeSpins > 0 ? <span className="pill-gold">{freeSpins} GIROS GRATIS</span> : meta && <span className="pill-gold">RTP {meta.rtp}%</span>}
        </div>
        <div className="reels2">
          {[0, 1, 2, 3, 4].map((reel) => {
            const isSpinning = spinning && reel >= stopped;
            return (
              <div key={reel} className="reel-col">
                {isSpinning ? (
                  <div className="strip" style={{ animationDuration: turbo ? '.18s' : '.28s' }}>
                    {[...strips[reel], ...strips[reel]].map((s, i) => (
                      <span key={i} className="cell2 blur"><SymbolArt s={s} size={46} /></span>
                    ))}
                  </div>
                ) : (
                  grid[reel].map((s, row) => {
                    const win = !spinning && (winCells.has(`${reel}-${row}`) || (!!res && res.scatterCount >= 3 && s === 'templo'));
                    const dim = !spinning && !!res && res.totalWin > 0 && !win;
                    return (
                      <span key={`${spinId}-${row}`} className={`cell2 land ${win ? 'win' : ''} ${dim ? 'dim' : ''}`} aria-label={SYM_NAMES[s]}>
                        <SymbolArt s={s} size={46} />
                      </span>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="win-card" aria-live="polite">
        {res && res.totalWin > 0 ? (
          <>
            <SymbolArt s={bestLine?.symbol ?? 'templo'} size={46} />
            <div className="grow">
              <div className="muted small">
                {bestLine ? `${bestLine.count} × ${SYM_NAMES[bestLine.symbol].toLowerCase()}` : ''}
                {res.lineWins.length > 1 ? ` · ${res.lineWins.length} líneas` : ''}
                {res.scatterWin > 0 ? `${bestLine ? ' · ' : ''}${res.scatterCount} templos` : ''}
              </div>
              <div className={`win-amount ${big ? 'big' : ''}`}>¡Ganaste {fmt(shownWin)}!</div>
            </div>
          </>
        ) : (
          <div className="grow center muted">
            {spinning ? 'Girando…' : res ? 'Sin premio esta vez. ¡Otra!' : 'Busca 3 pirámides o más en línea'}
          </div>
        )}
      </section>

      <section className="slot-controls2">
        <div className="col gap6">
          <span className="label">{freeSpins > 0 ? 'GIRO GRATIS DE' : 'APUESTA'}</span>
          <div className="row gap8">
            <button type="button" className="step-btn raised" aria-label="Bajar apuesta" disabled={spinning || betIdx === 0 || freeSpins > 0} onClick={() => { sfx.tap(); setBetIdx((i) => i - 1); }}>−</button>
            <strong className="bet-val">{fmt(freeSpins > 0 ? me?.freeSpinBet || bet : bet)}</strong>
            <button type="button" className="step-btn raised" aria-label="Subir apuesta" disabled={spinning || betIdx === steps.length - 1 || freeSpins > 0} onClick={() => { sfx.tap(); setBetIdx((i) => i + 1); }}>+</button>
          </div>
        </div>
        <button type="button" className={`spin-btn2 ${spinning ? 'spinning' : ''}`} onClick={doSpin} disabled={spinning}>
          {freeSpins > 0 ? 'GRATIS' : 'GIRAR'}
        </button>
      </section>

      <section className="row gap10 px20">
        <button type="button" className={`btn btn-raised grow ${auto > 0 ? 'on' : ''}`} onClick={() => { sfx.tap(); setAuto(auto > 0 ? 0 : 10); }}>
          {auto > 0 ? `Detener (${auto})` : 'Auto ×10'}
        </button>
        <button type="button" className={`btn btn-raised grow ${turbo ? 'on' : ''}`} aria-pressed={turbo} onClick={() => { sfx.tap(); setTurbo(!turbo); }}>Turbo</button>
        <button type="button" className="btn btn-raised grow" onClick={() => { sfx.tap(); setShowPay(true); }}>Pagos</button>
      </section>

      <p className="disclaimer center">Monedas virtuales sin valor monetario. Solo entretenimiento, +18.</p>

      {showBig && res && (
        <div className="big-win-overlay" onClick={() => setShowBig(false)}>
          <CoinBurst />
          <div className="big-win-box">
            <span>{res.totalWin >= res.bet * 50 ? '¡MEGA PREMIO!' : '¡GRAN PREMIO!'}</span>
            <strong>{fmt(shownWin)}</strong>
          </div>
        </div>
      )}

      {showPay && meta && (
        <Modal title="Tabla de pagos" onClose={() => setShowPay(false)}>
          <p className="muted small">Pagos por línea con una apuesta de {fmt(bet)} (cada línea vale {fmt(bet / 20)}). Pagan de izquierda a derecha desde el primer rodillo.</p>
          <table className="pay-table">
            <thead><tr><th>Símbolo</th><th>×3</th><th>×4</th><th>×5</th></tr></thead>
            <tbody>
              {(['tesoro', 'gift', 'coin', 'fruta', 'cafe'] as const).map((s) => (
                <tr key={s}>
                  <td><SymbolArt s={s} size={30} />{SYM_NAMES[s]}</td>
                  {meta.paytable[s].map((m: number, i: number) => <td key={i}>{fmt((m * bet) / 20)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row gap10 small"><SymbolArt s="templo" size={36} /><span><strong>Templo:</strong> 3 o más en cualquier posición pagan {meta.scatterPay}× la apuesta y dan {meta.freeSpins} giros gratis.</span></div>
          <p className="muted small">Retorno teórico al jugador: {meta.rtp}%.</p>
        </Modal>
      )}
    </div>
  );
}
