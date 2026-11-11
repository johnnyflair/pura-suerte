import { useEffect, useState } from 'react';
import { api, fmt, timeLeft, usd } from '../api';
import { useSession } from '../session';
import { Icon } from '../icons';
import { Modal, TopBar } from '../components/Chrome';
import { AdModal } from '../components/Rewards';
import { CoinArt } from '../components/Art';
import { sfx } from '../sound';

interface Pack { id: string; coins: number; priceCents: number; tag?: string; freeSpins?: number; welcome?: boolean }

const LIMITS = [null, 500, 1000, 2000, 5000, 10000];

export default function Tienda() {
  const { me, setBalance, refresh, toast } = useSession();
  const [store, setStore] = useState<{ packs: Pack[]; paymentsMode: string } | null>(null);
  const [confirm, setConfirm] = useState<Pack | null>(null);
  const [ad, setAd] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    api('/api/store').then(setStore);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!me || !store) return <div className="screen"><TopBar title="Tienda" /></div>;
  const welcome = store.packs.find((p) => p.welcome);
  const packs = store.packs.filter((p) => !p.welcome);
  const selling = store.paymentsMode === 'demo';

  const buy = async (p: Pack) => {
    try {
      const r = await api('/api/store/buy', { body: { packId: p.id } });
      setBalance(r.balance);
      sfx.cashout();
      toast(`+${fmt(r.coins)} monedas${r.freeSpins ? ` y ${r.freeSpins} giros gratis` : ''}`);
      setConfirm(null);
      refresh();
    } catch (e: any) {
      toast(e.message);
      setConfirm(null);
    }
  };

  const claimGift = async () => {
    try {
      const r = await api('/api/bonus/gift', { method: 'POST' });
      setBalance(r.balance);
      sfx.cashout();
      toast(`+${fmt(r.coins)} monedas de regalo`);
      refresh();
    } catch (e: any) {
      toast(e.message);
    }
  };

  const setLimit = async (cents: number | null) => {
    await api('/api/me/limit', { method: 'PUT', body: { dailyLimitCents: cents } });
    setLimitOpen(false);
    toast(cents === null ? 'Límite diario desactivado' : `Límite diario: ${usd(cents)}`);
    refresh();
  };

  return (
    <div className="screen">
      <TopBar title="Tienda" />

      {!selling && (
        <p className="notice">Las compras se activan pronto. Mientras tanto, gana monedas gratis abajo.</p>
      )}

      {welcome && me.welcomeOfferAvailable && (
        <section className="offer">
          <span className="eyebrow">{welcome.tag?.toUpperCase()} · UNA SOLA VEZ</span>
          <strong className="offer-title">{fmt(welcome.coins)} monedas + {welcome.freeSpins} giros en Tesoro Maya</strong>
          <button type="button" className="btn btn-dark btn-lg" disabled={!selling} onClick={() => setConfirm(welcome)}>{usd(welcome.priceCents)}</button>
        </section>
      )}

      <h2 className="section-title">Paquetes de monedas</h2>
      <ul className="packs">
        {packs.map((p) => {
          const hot = p.tag === 'Más popular';
          return (
            <li key={p.id} className={`pack ${hot ? 'hot' : ''}`}>
              <CoinArt size={hot ? 40 : 34} />
              <div className="grow col">
                <strong className="pack-amt">{fmt(p.coins)}</strong>
                {p.tag ? <span className="pack-tag">{p.tag.toUpperCase()}</span> : <span className="muted small">monedas</span>}
              </div>
              <button type="button" className={`btn ${hot ? 'btn-acc' : 'btn-dark'} btn-price`} disabled={!selling} onClick={() => setConfirm(p)}>{usd(p.priceCents)}</button>
            </li>
          );
        })}
      </ul>

      <h2 className="section-title">Monedas gratis</h2>
      <section className="free-grid">
        <button type="button" className="free-card" disabled={me.adsLeft === 0} onClick={() => setAd(true)}>
          <Icon name="play" size={22} color="var(--acc)" />
          <strong>Ver anuncio</strong>
          <span className="muted small">{me.adsLeft > 0 ? `+1,000 · quedan ${me.adsLeft} hoy` : 'Vuelve mañana'}</span>
        </button>
        <button type="button" className="free-card" disabled={!!me.giftAvailableAt} onClick={claimGift}>
          <Icon name="gift" size={22} color="var(--acc)" />
          <strong>Regalo cada 4 h</strong>
          <span className="muted small">{me.giftAvailableAt ? `Disponible en ${timeLeft(me.giftAvailableAt)}` : '+2,000 · listo'}</span>
        </button>
      </section>

      <section className="card row-between">
        <span>
          <strong>Límite de compra diario</strong>
          <br />
          <span className="muted small">
            {me.user.daily_spend_limit_cents === null ? 'Tú decides cuánto gastar por día' : `Actual: ${usd(me.user.daily_spend_limit_cents)} por día`}
          </span>
        </span>
        <button type="button" className="link-btn" onClick={() => setLimitOpen(true)}>Configurar</button>
      </section>

      <p className="muted small px20">Pagos con tarjeta, Apple Pay o Google Pay (se activan con la pasarela de pago).</p>
      <p className="disclaimer">Las monedas no tienen valor monetario, no son reembolsables y no se pueden canjear por dinero ni premios. Solo para mayores de 18 años.</p>

      {confirm && (
        <Modal title="Confirmar compra" onClose={() => setConfirm(null)}>
          <div className="col gap12">
            <p><strong>{fmt(confirm.coins)} monedas</strong>{confirm.freeSpins ? ` + ${confirm.freeSpins} giros gratis` : ''} por <strong>{usd(confirm.priceCents)}</strong>.</p>
            <p className="notice">Modo de prueba: no se hace ningún cobro.</p>
            <button type="button" className="btn btn-acc btn-lg" onClick={() => buy(confirm)}>Comprar</button>
          </div>
        </Modal>
      )}
      {limitOpen && (
        <Modal title="Límite de compra diario" onClose={() => setLimitOpen(false)}>
          <div className="col gap8">
            {LIMITS.map((l) => (
              <button key={String(l)} type="button" className={`btn btn-outline ${me.user.daily_spend_limit_cents === l ? 'on' : ''}`} onClick={() => setLimit(l)}>
                {l === null ? 'Sin límite' : `${usd(l)} por día`}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {ad && <AdModal onClose={() => setAd(false)} />}
    </div>
  );
}
