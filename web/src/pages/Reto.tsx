import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmt } from '../api';
import { useSession } from '../session';
import { Logo } from '../components/Chrome';
import { Art } from './Pizote';
import { PIZ_NORMAL } from '../pizoteArt';

export const PENDING_RETO = 'ps-reto';

export default function Reto() {
  const { code = '' } = useParams();
  const { me, toast } = useSession();
  const nav = useNavigate();
  const [ch, setCh] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/retos/${code}`).then(setCh).catch((e) => setError(e.message));
  }, [code]);

  const accept = async () => {
    if (!me) {
      try { localStorage.setItem(PENDING_RETO, code); } catch { /* sin almacenamiento */ }
      nav('/registro');
      return;
    }
    try {
      await api(`/api/retos/${code}/aceptar`, { method: 'POST' });
      try { localStorage.removeItem(PENDING_RETO); } catch { /* */ }
      nav(`/juego/pizote?supera=${ch.target}`);
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div className="screen reto-screen">
      <header className="lobby-head"><Logo /></header>
      {error && <p className="notice">{error}</p>}
      {ch && (
        <section className="reto-card">
          <span className="eyebrow">{ch.expired ? 'ESTE RETO YA VENCIÓ' : '¡TE RETARON!'}</span>
          <Art html={PIZ_NORMAL} w={110} h={128} />
          <strong className="reto-title">{ch.owner} cruzó Chepe hasta x{ch.target.toFixed(2)}</strong>
          <span>
            Superalo y ganan {fmt(ch.winBoth)} monedas cada uno. Si no lo lográs, igual te llevás {fmt(ch.consolation)} por intentarlo.
          </span>
          {!ch.expired && (
            <button type="button" className="btn btn-white btn-xl" onClick={accept}>
              {me ? 'Aceptar reto' : 'Crear cuenta y aceptar'}
            </button>
          )}
          {!me && <span className="small">Te regalamos 100,000 monedas al registrarte. Solo mayores de 18.</span>}
        </section>
      )}
      <p className="disclaimer center">Pizote cruza Chepe es parte de Pura Suerte. Las monedas son virtuales y no se canjean por dinero.</p>
    </div>
  );
}
