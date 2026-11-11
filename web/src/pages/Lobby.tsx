import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, fmt, timeLeft } from '../api';
import { useSession } from '../session';
import { Icon } from '../icons';
import { BottomNav, Coins, Disclaimer, Logo, Modal } from '../components/Chrome';
import { AdModal, WheelModal, WheelSvg } from '../components/Rewards';
import { GAMES, GAME_NAMES, type GameInfo } from '../games';

const CATS = ['Todos', 'Slots', 'Instantáneos', 'Mesa'] as const;

export function GameGrid({ cat }: { cat: (typeof CATS)[number] }) {
  const list = GAMES.filter((g) => cat === 'Todos' || g.category === cat);
  return (
    <div className="game-grid">
      {list.map((g) => <GameTile key={g.key} g={g} />)}
    </div>
  );
}

function GameTile({ g }: { g: GameInfo }) {
  const inner = (
    <>
      <span className="tile-art" style={{ background: g.color }}>
        <Icon name={g.key} size={60} color="var(--tx)" stroke={1.6} />
        <span className="tile-tag">{g.category.toUpperCase()}</span>
        {!g.path && <span className="tile-soon">Próximamente</span>}
      </span>
      <span className="tile-name">{g.name}</span>
    </>
  );
  return g.path ? (
    <Link to={g.path} className="tile">{inner}</Link>
  ) : (
    <div className="tile tile-off" aria-label={`${g.name}, próximamente`}>{inner}</div>
  );
}

export function Leaderboard() {
  const [lb, setLb] = useState<any>(null);
  useEffect(() => {
    api('/api/leaderboard').then(setLb).catch(() => {});
  }, []);
  if (!lb) return null;
  const days = Math.max(0, Math.floor((new Date(lb.endsAt).getTime() - Date.now()) / 86400000));
  const hours = Math.max(0, Math.floor(((new Date(lb.endsAt).getTime() - Date.now()) % 86400000) / 3600000));
  const meInTop = lb.me && lb.top.some((t: any) => t.rank === lb.me.rank);
  const rows = meInTop || !lb.me ? lb.top : [...lb.top.slice(0, 4), lb.me];
  return (
    <section className="card list-card">
      <div className="row-between">
        <h2>Torneo semanal</h2>
        <span className="muted small">Termina en {days}d {hours}h</span>
      </div>
      <p className="muted small">Gana el que más monedas gane en la semana.</p>
      {rows.length === 0 ? (
        <p className="empty">Aún nadie ha ganado esta semana. ¡Sé el primero!</p>
      ) : (
        <ol className="rank-list">
          {rows.map((r: any) => (
            <li key={r.rank} className={lb.me?.rank === r.rank ? 'me' : ''}>
              <span className={`rank ${r.rank === 1 ? 'gold' : ''}`}>{r.rank}</span>
              <span className="grow">{lb.me?.rank === r.rank ? 'Tú' : r.name}</span>
              <strong>{fmt(r.total)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Feed() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    api('/api/feed').then((r) => setItems(r.items)).catch(() => {});
  }, []);
  if (!items) return null;
  return (
    <section className="card list-card">
      <h2>Ganando ahora</h2>
      {items.length === 0 ? (
        <p className="empty">Aquí aparecen los premios grandes de la comunidad.</p>
      ) : (
        <ul className="feed">
          {items.map((x, i) => (
            <li key={i}>
              <span><strong>{x.name}</strong> <span className="muted">en {GAME_NAMES[x.game] ?? x.game}</span></span>
              <span className="win-amt">+{fmt(x.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Lobby() {
  const { me, refresh, setBalance, toast } = useSession();
  const loc = useLocation();
  const [cat, setCat] = useState<(typeof CATS)[number]>('Todos');
  const [wheel, setWheel] = useState(false);
  const [ad, setAd] = useState(false);
  const [welcome, setWelcome] = useState(new URLSearchParams(loc.search).has('bienvenida'));
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    api('/api/crash/history').then((r) => setHistory(r.history)).catch(() => {});
  }, []);

  if (!me) return null;
  const m = me.mission;
  const claimMission = async () => {
    try {
      const r = await api('/api/missions/claim', { method: 'POST' });
      setBalance(r.balance);
      toast(`+${fmt(r.coins)} monedas por completar la misión`);
      refresh();
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div className="screen">
      <header className="lobby-head">
        <Logo />
        <div className="row gap8">
          <Coins />
        </div>
      </header>
      <p className="greet">¡Hola, {me.user.display_name}! ¿Qué jugamos hoy?</p>

      <section className="wheel-card">
        <div className="grow col gap10">
          <span className="eyebrow">RUEDA DIARIA</span>
          <strong className="wheel-title">Gira gratis y gana hasta 50,000 monedas</strong>
          {me.wheelAvailableAt ? (
            <span className="pill-light">Vuelve en {timeLeft(me.wheelAvailableAt)}</span>
          ) : (
            <button type="button" className="btn btn-white" onClick={() => setWheel(true)}>Girar</button>
          )}
        </div>
        <WheelSvg size={100} />
      </section>

      <section className="rocket-card">
        <div className="row-between">
          <span className="eyebrow mint">COHETE</span>
          <span className="small muted-dark">¿Hasta dónde llegas antes de que explote?</span>
        </div>
        <div className="rocket-mini">
          <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,96 40,94 80,88 120,78 160,63 200,45 240,24 270,8" fill="none" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="rocket-mini-x">x3.47</span>
          <span className="rocket-mini-icon"><Icon name="cohete" size={26} color="#F3EEFF" stroke={1.6} /></span>
        </div>
        {history.length > 0 && (
          <div className="hist">
            <span className="small muted-dark">Tus últimas rondas:</span>
            {history.slice(0, 5).map((h, i) => <span key={i} className={`chip-x ${h >= 2 ? 'good' : ''}`}>x{h.toFixed(2)}</span>)}
          </div>
        )}
        <Link to="/juego/cohete" className="btn btn-mint">Jugar Cohete</Link>
      </section>

      <section className="card">
        <div className="row-between"><strong>Misión: {m.title}</strong><span className="muted">{m.progress}/{m.goal}</span></div>
        <div className="bar"><div style={{ width: `${(m.progress / m.goal) * 100}%` }} /></div>
        <div className="row-between">
          <span className="muted small">Premio: {fmt(m.coins)} monedas</span>
          {m.claimed ? (
            <span className="small strong">Reclamada</span>
          ) : m.progress >= m.goal ? (
            <button type="button" className="btn btn-acc btn-sm" onClick={claimMission}>Reclamar</button>
          ) : null}
        </div>
      </section>

      <div className="chips" role="tablist" aria-label="Categorías">
        {CATS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <GameGrid cat={cat} />

      <Leaderboard />
      <Feed />

      {me.adsLeft > 0 && (
        <section className="ad-card">
          <Icon name="play" size={26} />
          <div className="grow"><strong>+1,000 monedas gratis</strong><br />Mira un video de 30 segundos.</div>
          <button type="button" className="btn btn-dark btn-sm" onClick={() => setAd(true)}>Ver</button>
        </section>
      )}

      <Disclaimer />
      <BottomNav />

      {wheel && <WheelModal onClose={() => setWheel(false)} />}
      {ad && <AdModal onClose={() => setAd(false)} />}
      {welcome && (
        <Modal title="¡Bienvenido!" onClose={() => setWelcome(false)}>
          <div className="wheel-modal">
            <Icon name="coin" size={64} color="var(--acc)" />
            <strong className="big-win">Te regalamos {fmt(100000)} monedas</strong>
            <p className="muted center">Úsalas en Tesoro Maya y Cohete. Gira la rueda cada día para ganar más.</p>
            <button type="button" className="btn btn-acc btn-lg" onClick={() => setWelcome(false)}>Empezar a jugar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
