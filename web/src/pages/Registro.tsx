import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useSession } from '../session';
import { Disclaimer, Logo } from '../components/Chrome';

declare global {
  interface Window { google?: any }
}

export default function Registro() {
  const { refresh } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birth, setBirth] = useState('');
  const [ok18, setOk18] = useState(false);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'enlace' ? 'El enlace venció o ya se usó. Pide uno nuevo.' : null,
  );
  const [busy, setBusy] = useState(false);
  const [googleId, setGoogleId] = useState<string | null>(null);
  const [pendingGoogle, setPendingGoogle] = useState<string | null>(null);
  const gBtn = useRef<HTMLDivElement>(null);

  // Botón de Google: solo aparece si el servidor tiene GOOGLE_CLIENT_ID
  useEffect(() => {
    api('/api/auth/config').then((c) => setGoogleId(c.googleClientId));
  }, []);
  useEffect(() => {
    if (!googleId || !gBtn.current) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      window.google.accounts.id.initialize({ client_id: googleId, callback: (r: any) => googleLogin(r.credential) });
      window.google.accounts.id.renderButton(gBtn.current, { theme: 'outline', size: 'large', width: 340, text: 'continue_with', shape: 'pill', locale: 'es' });
    };
    document.head.appendChild(s);
  }, [googleId]);

  const googleLogin = async (credential: string, extra?: { birthDate: string; ageConfirmed: boolean }) => {
    try {
      await api('/api/auth/google', { body: { credential, ...extra } });
      await refresh();
      nav('/?bienvenida=1');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setPendingGoogle(credential);
        setMode('signup');
        setError('Para terminar tu registro con Google, completa tu fecha de nacimiento y confirma que eres mayor de edad.');
      } else setError((e as Error).message);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (mode === 'signup' && !ok18) return setError('Debes confirmar que tienes 18 años o más.');
    setBusy(true);
    try {
      if (pendingGoogle) return await googleLogin(pendingGoogle, { birthDate: birth, ageConfirmed: true });
      const body = mode === 'signup' ? { email, displayName: name, birthDate: birth, ageConfirmed: ok18 } : { email };
      const r = await api('/api/auth/email/start', { body });
      setSent(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setMode('signup');
        setError('No encontramos una cuenta con ese correo. Créala aquí.');
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="screen auth">
        <Logo size={30} />
        <h1>Revisa tu correo</h1>
        <p className="muted">Te mandamos un enlace a <strong>{email}</strong> para entrar. Vence en 20 minutos.</p>
        {sent.devLink && (
          <a className="btn btn-acc btn-lg" href={sent.devLink}>Abrir enlace (modo prueba)</a>
        )}
        <button type="button" className="link-btn" onClick={() => setSent(null)}>Usar otro correo</button>
      </div>
    );
  }

  const maxBirth = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="screen auth">
      <Logo size={30} />
      <h1>{mode === 'signup' ? 'Empieza con 100,000 monedas gratis' : 'Qué bueno verte otra vez'}</h1>
      <p className="muted">10 juegos, una rueda diaria y torneos cada semana. Sin depósitos para jugar.</p>

      {googleId && !pendingGoogle && (
        <>
          <div ref={gBtn} className="google-btn" />
          <div className="divider"><span>o con tu correo</span></div>
        </>
      )}

      <form className="col gap12" onSubmit={submit}>
        {mode === 'signup' && !pendingGoogle && (
          <label className="field">
            <span>Nombre o apodo</span>
            <input required maxLength={40} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        {!pendingGoogle && (
          <label className="field">
            <span>Correo electrónico</span>
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        {mode === 'signup' && (
          <>
            <label className="field">
              <span>Fecha de nacimiento</span>
              <input required type="date" max={maxBirth} value={birth} onChange={(e) => setBirth(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={ok18} onChange={(e) => setOk18(e.target.checked)} />
              <span>Confirmo que tengo 18 años o más y acepto los <a href="/terminos">Términos</a> y la <a href="/privacidad">Política de privacidad</a>.</span>
            </label>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-acc btn-xl" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Enviarme el enlace'}
        </button>
      </form>
      <p className="center muted">
        {mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿Eres nuevo? '}
        <button type="button" className="link-btn" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); setPendingGoogle(null); }}>
          {mode === 'signup' ? 'Inicia sesión' : 'Crea tu cuenta'}
        </button>
      </p>
      <Disclaimer />
    </div>
  );
}
