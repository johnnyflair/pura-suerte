import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { fmt } from '../api';
import { useSession } from '../session';

export const DISCLAIMER =
  'Monedas virtuales sin valor monetario: no se pueden comprar premios ni canjear por dinero. Solo entretenimiento, para mayores de 18 años.';

export function Coins() {
  const { me } = useSession();
  return (
    <Link to="/tienda" className="coins" aria-label={`Saldo ${fmt(me?.user.balance ?? 0)} monedas. Comprar monedas`}>
      <Icon name="coin" size={18} color="var(--yel)" />
      <span>{fmt(me?.user.balance ?? 0)}</span>
      <Icon name="plus" size={16} color="var(--yel)" stroke={2.4} />
    </Link>
  );
}

export function TopBar({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      <button type="button" className="icon-btn" aria-label="Volver" onClick={() => nav(-1)}>
        <Icon name="back" size={20} stroke={2.2} />
      </button>
      <strong className="topbar-title">{title}</strong>
      <Coins />
    </header>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      pura<span>suerte</span>
    </span>
  );
}

export function BottomNav() {
  const items = [
    { to: '/', icon: 'home', label: 'Inicio' },
    { to: '/juegos', icon: 'grid', label: 'Juegos' },
    { to: '/tienda', icon: 'bag', label: 'Tienda' },
    { to: '/premios', icon: 'trophy', label: 'Premios' },
    { to: '/perfil', icon: 'user', label: 'Perfil' },
  ];
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={i.icon} size={22} />
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Disclaimer() {
  return <p className="disclaimer">{DISCLAIMER}</p>;
}

export function Toast() {
  const { toastMsg } = useSession();
  return toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{title}</strong>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
