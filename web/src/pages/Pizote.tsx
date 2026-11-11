import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { Modal } from '../components/Chrome';
import { CoinArt, CoinBurst, SoundButton } from '../components/Art';
import { sfx, startMusic, stopMusic, unlock } from '../sound';
import * as A from '../pizoteArt';
import { makeShareImage } from '../share';

export function Art({ html, w, h, className, style }: { html: string; w: number; h: number; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={{ display: 'inline-block', width: w, height: h, ...style }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Meta { lanes: number; laneNames: string[]; multipliers: number[]; chance: number; rtp: number }
interface Round {
  id: string; bet: number; pos: number; status: 'playing' | 'cashed' | 'crashed';
  multiplier: number; payout: number; hash?: string; seed?: string; crashLane?: number;
  challenges?: { code: string; won: boolean; coins: number }[];
}

const BETS = [500, 1000, 2000, 5000];
const PIZ_H = 58, PIZ_W = 50;

export default function Pizote() {
  const { me, setBalance, toast, refresh } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const retoTarget = Number(params.get('supera')) || 0;
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bet, setBet] = useState(1000);
  const [round, setRound] = useState<Round | null>(null);
  const [busy, setBusy] = useState(false);
  const [hopKey, setHopKey] = useState(0);
  const [ranking, setRanking] = useState<any[]>([]);
  const [share, setShare] = useState<{ url: string; link: string; code: string } | null>(null);
  const hornTimer = useRef<number | undefined>(undefined);

  const loadRanking = () => api('/api/pizote/ranking').then((r) => setRanking(r.top)).catch(() => {});
  useEffect(() => {
    api('/api/pizote/meta').then(setMeta);
    loadRanking();
    startMusic();
    hornTimer.current = window.setInterval(() => { if (Math.random() < 0.35) sfx.horn(); }, 6000);
    return () => { stopMusic(); window.clearInterval(hornTimer.current); refresh(); };
  }, []);

  if (!meta) return <div className="screen" />;
  const N = meta.lanes;
  const playing = round?.status === 'playing';
  const cur = round && round.pos > 0 ? meta.multipliers[round.pos - 1] : 1;
  const nextMult = round ? meta.multipliers[Math.min(round.pos, N - 1)] : meta.multipliers[0];

  const start = async () => {
    unlock();
    sfx.tap();
    setBusy(true);
    try {
      const r = await api<Round & { balance: number }>('/api/pizote/start', { body: { bet } });
      setBalance(r.balance);
      setRound(r);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const step = async () => {
    if (!round || busy) return;
    setBusy(true);
    try {
      const r = await api<Round & { balance?: number }>('/api/pizote/step', { body: { id: round.id } });
      setHopKey((k) => k + 1);
      sfx.hop();
      if (r.status === 'crashed') {
        sfx.horn();
        window.setTimeout(sfx.explosion, 150);
      } else if (r.status === 'cashed') {
        sfx.winBig();
      }
      if (r.balance !== undefined) setBalance(r.balance);
      setRound({ ...round, ...r });
      if (r.status !== 'playing') afterEnd(r);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cashout = async () => {
    if (!round || busy) return;
    setBusy(true);
    try {
      const r = await api<Round & { balance: number }>('/api/pizote/cashout', { body: { id: round.id } });
      sfx.cashout();
      setBalance(r.balance);
      setRound({ ...round, ...r });
      afterEnd(r);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const afterEnd = (r: Round) => {
    loadRanking();
    refresh();
    r.challenges?.forEach((c) =>
      toast(c.won ? `¡Superaste el reto! +${fmt(c.coins)} para vos y tu amigo` : `+${fmt(c.coins)} por aceptar el reto`),
    );
  };

  const doShare = async () => {
    if (!round) return;
    try {
      const ch = await api<{ code: string; target: number }>('/api/pizote/reto', { body: { roundId: round.id } });
      const host = window.location.host;
      const link = `${window.location.origin}/reto/${ch.code}`;
      const blob = await makeShareImage(ch.target, ch.code, host);
      const file = new File([blob], `pizote-x${ch.target}.png`, { type: 'image/png' });
      const text = `Mi pizote cruzó Chepe hasta x${ch.target.toFixed(2)}. ¿Me ganás? ${link}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        setShare({ url: URL.createObjectURL(blob), link, code: ch.code });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast(e.message ?? 'No se pudo compartir');
    }
  };

  const status = round?.status;
  const pos = round?.pos ?? 0;
  const lanes = Array.from({ length: N }, (_, i) => N - i); // de arriba (8) hacia abajo (1)
  const pose = status === 'crashed' ? A.PIZ_MAREADO : status === 'cashed' ? A.PIZ_FELIZ : busy && playing ? A.PIZ_ASUSTADO : A.PIZ_NORMAL;

  return (
    <div className="screen screen-game pz-screen">
      <header className="topbar">
        <button type="button" className="icon-btn raised" aria-label="Volver" onClick={() => { sfx.tap(); nav(-1); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <strong className="topbar-title">Pizote cruza Chepe</strong>
        <SoundButton />
        <span className="coins"><CoinArt size={22} />{fmt(me?.user.balance ?? 0)}</span>
      </header>

      {retoTarget > 0 && <p className="notice">Reto activo: retirate por encima de <strong>x{retoTarget.toFixed(2)}</strong> y ganan 5,000 monedas cada uno.</p>}

      <section className="pz-board" aria-live="polite">
        <div className="pz-goal">
          <Art html={A.SODA} w={362} h={70} style={{ width: '100%' }} />
          <span className="pz-goal-chip">META x{meta.multipliers[N - 1].toFixed(2)}</span>
          {status === 'cashed' && pos === N && <Art key={`g${hopKey}`} html={A.PIZ_FELIZ} w={62} h={72} className="pz-piz hop" style={{ left: 'calc(50% - 31px)', top: -8 }} />}
        </div>
        {lanes.map((k) => {
          const passed = !!round && k <= pos;
          const here = !!round && k === pos && !(status === 'cashed' && k === N);
          const crash = status === 'crashed' && k === pos;
          const kind = k % 3;
          return (
            <div key={k} className={`pz-lane ${passed ? 'passed' : ''}`}>
              {(k === 3 || k === 6) && (<><Art html={A.HUECO} w={40} h={20} className="pz-prop" style={{ left: 70, top: 20 }} /><Art html={A.CONO} w={18} h={23} className="pz-prop" style={{ left: 112, top: 8 }} /></>)}
              {!crash && (
                <>
                  <Art html={kind === 1 ? A.BUS : kind === 2 ? A.TAXI : A.MOTO} w={kind === 1 ? 104 : kind === 2 ? 72 : 48} h={kind === 1 ? 48 : kind === 2 ? 39 : 38} className={`pz-car ${['r1', 'r2', 'r3'][k % 3]}`} />
                  <Art html={kind === 2 ? A.MOTO : A.TAXI} w={kind === 2 ? 48 : 72} h={kind === 2 ? 38 : 39} className={`pz-car ${['r2', 'r3', 'r1'][k % 3]} d${(k % 3) + 1}`} />
                </>
              )}
              <span className={`pz-chip ${here ? 'here' : passed ? 'passed' : ''}`}>x{meta.multipliers[k - 1].toFixed(2)}</span>
              <span className="pz-name">{meta.laneNames[N - k]}</span>
              {here && !crash && <Art key={`p${hopKey}`} html={pose} w={PIZ_W} h={PIZ_H} className="pz-piz hop idle" style={{ left: `calc(50% - ${PIZ_W / 2}px)`, top: -14 }} />}
              {crash && (
                <>
                  <span className="pz-boom" />
                  <Art html={A.BUS_PUM} w={104} h={48} className="pz-bus-hit" style={{ left: 'calc(50% - 90px)', top: 0 }} />
                  <Art html={A.PIZ_MAREADO} w={PIZ_W} h={PIZ_H} className="pz-piz spin" style={{ left: 'calc(50% + 6px)', top: -18 }} />
                </>
              )}
            </div>
          );
        })}
        <div className="pz-sidewalk">
          <span>ACERA · SALIDA</span>
          {(!round || (playing && pos === 0)) && <Art key={`s${hopKey}`} html={busy ? A.PIZ_ASUSTADO : A.PIZ_NORMAL} w={PIZ_W} h={PIZ_H} className="pz-piz idle" style={{ left: `calc(50% - ${PIZ_W / 2}px)`, top: -16 }} />}
        </div>
        {status === 'cashed' && <CoinBurst n={pos === N ? 30 : 16} />}
      </section>

      <section className="card row-between pz-status">
        <div>
          <div className="label">
            {!round && 'LISTO PARA CRUZAR'}
            {playing && (pos === 0 ? 'EN LA ACERA' : `VAS EN ${meta.laneNames[N - pos].toUpperCase()}`)}
            {status === 'crashed' && '¡LO AGARRÓ EL BUS!'}
            {status === 'cashed' && (pos === N ? '¡LLEGASTE A LA SODA!' : 'TE RETIRASTE A TIEMPO')}
          </div>
          <div className={`pz-big ${status === 'crashed' ? 'bad' : status ? 'good' : ''}`}>
            {status === 'crashed' ? `Perdiste ${fmt(round!.bet)}` : status === 'cashed' ? `+${fmt(round!.payout)}` : `x${cur.toFixed(2)}`}
          </div>
        </div>
        <div className="right">
          <div className="label">{playing ? 'SIGUIENTE' : 'APUESTA'}</div>
          <div className="strong">{playing ? `x${nextMult.toFixed(2)} · ${Math.round(meta.chance * 100)}%` : fmt(round?.bet ?? bet)}</div>
        </div>
      </section>

      {playing ? (
        <section className="row gap10 px20">
          <button type="button" className="btn btn-cash btn-xl grow" disabled={busy || pos === 0} onClick={cashout}>
            {pos === 0 ? 'Cruzá primero' : `Retirar ${fmt(round!.bet * cur)}`}
          </button>
          <button type="button" className="btn btn-go btn-xl grow" disabled={busy} onClick={step}>Cruzar ↑</button>
        </section>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Apuesta">
            {BETS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={bet === b} className={`chip ${bet === b ? 'on' : ''}`} onClick={() => { sfx.tap(); setBet(b); }}>{fmt(b)}</button>
            ))}
          </div>
          <section className="row gap10 px20">
            <button type="button" className="btn btn-launch btn-xl grow" disabled={busy} onClick={start}>
              {round ? 'Otra vez' : 'Empezar'} · {fmt(bet)}
            </button>
            {status === 'cashed' && cur >= 2 && (
              <button type="button" className="btn btn-share btn-xl" onClick={doShare}>Retar</button>
            )}
          </section>
        </>
      )}

      {ranking.length > 0 && (
        <section className="card list-card">
          <h2>Mejores cruces de la semana</h2>
          <ol className="rank-list">
            {ranking.slice(0, 5).map((r) => (
              <li key={r.rank} className={r.me ? 'me' : ''}>
                <span className={`rank ${r.rank === 1 ? 'gold' : ''}`}>{r.rank}</span>
                <span className="grow">{r.me ? 'Tú' : r.name}</span>
                <strong>x{Number(r.best).toFixed(2)}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      {round?.seed && (
        <p className="disclaimer">Ronda verificable · carril del bus: {round.crashLane! > N ? 'ninguno' : round.crashLane} · semilla: <code className="hash">{round.seed.slice(0, 16)}…</code></p>
      )}
      <p className="disclaimer center">Cada carril tiene {Math.round(meta.chance * 100)}% de probabilidad de pasar · RTP {meta.rtp}% · Monedas virtuales sin valor monetario, +18.</p>

      {share && (
        <Modal title="Retá a tus amigos" onClose={() => { URL.revokeObjectURL(share.url); setShare(null); }}>
          <img src={share.url} alt="Tarjeta del reto para compartir" className="share-preview" />
          <a className="btn btn-whatsapp btn-lg" href={`https://wa.me/?text=${encodeURIComponent(`Mi pizote cruzó Chepe hasta x${cur.toFixed(2)}. ¿Me ganás? ${share.link}`)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
          <a className="btn btn-dark btn-lg" href={share.url} download={`pizote-reto-${share.code}.png`}>Descargar imagen para historias</a>
          <button type="button" className="btn btn-raised btn-lg" onClick={() => { navigator.clipboard?.writeText(share.link); toast('Enlace copiado'); }}>Copiar enlace</button>
        </Modal>
      )}
    </div>
  );
}
