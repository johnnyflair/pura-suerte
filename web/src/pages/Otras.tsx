import { useState } from 'react';
import { api, fmt, usd } from '../api';
import { useSession } from '../session';
import { BottomNav, Coins, Disclaimer, Logo } from '../components/Chrome';
import { GameGrid, Leaderboard } from './Lobby';

function Head() {
  return (
    <header className="lobby-head">
      <Logo />
      <Coins />
    </header>
  );
}

export function Juegos() {
  const [cat, setCat] = useState<'Todos' | 'Slots' | 'Instantáneos' | 'Mesa'>('Todos');
  return (
    <div className="screen">
      <Head />
      <h1 className="page-title">Juegos</h1>
      <div className="chips" role="tablist" aria-label="Categorías">
        {(['Todos', 'Slots', 'Instantáneos', 'Mesa'] as const).map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <GameGrid cat={cat} />
      <Disclaimer />
      <BottomNav />
    </div>
  );
}

export function Premios() {
  return (
    <div className="screen">
      <Head />
      <h1 className="page-title">Premios</h1>
      <Leaderboard />
      <section className="card small">
        <strong>¿Cómo funciona el torneo?</strong>
        <p className="muted">Cada semana sumamos las monedas que ganas en todos los juegos. El ranking se reinicia el lunes. Los premios del torneo son monedas virtuales.</p>
      </section>
      <Disclaimer />
      <BottomNav />
    </div>
  );
}

export function Perfil() {
  const { me, refresh } = useSession();
  if (!me) return null;
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await refresh();
  };
  return (
    <div className="screen">
      <Head />
      <h1 className="page-title">Perfil</h1>
      <section className="card col gap6">
        <strong>{me.user.display_name}</strong>
        <span className="muted small">{me.user.email}</span>
        <span className="small">Saldo: <strong>{fmt(me.user.balance)}</strong> monedas</span>
        <span className="small">Límite de compra diario: {me.user.daily_spend_limit_cents === null ? 'sin límite' : usd(me.user.daily_spend_limit_cents)}</span>
      </section>
      <section className="card small col gap6">
        <strong>Juego responsable</strong>
        <p className="muted">Las monedas son solo para entretenimiento y no se cambian por dinero. Si sientes que juegas más de lo que quieres, toma una pausa y pon un límite de compra en la tienda.</p>
      </section>
      <button type="button" className="btn btn-outline mx20" onClick={logout}>Cerrar sesión</button>
      <Disclaimer />
      <BottomNav />
    </div>
  );
}
