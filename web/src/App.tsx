import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './session';
import { Toast } from './components/Chrome';
import { ArtDefs } from './components/Art';
import { unlock } from './sound';
import Lobby from './pages/Lobby';
import Slot from './pages/Slot';
import Cohete from './pages/Cohete';
import Tienda from './pages/Tienda';
import Registro from './pages/Registro';
import { Juegos, Perfil, Premios } from './pages/Otras';

function Routed() {
  const { me, loading } = useSession();
  if (loading) return <div className="loading" aria-busy="true">Cargando…</div>;
  if (!me) {
    return (
      <Routes>
        <Route path="*" element={<Registro />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/juegos" element={<Juegos />} />
      <Route path="/juego/tesoro-maya" element={<Slot />} />
      <Route path="/juego/cohete" element={<Cohete />} />
      <Route path="/tienda" element={<Tienda />} />
      <Route path="/premios" element={<Premios />} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <div className="app" onPointerDown={unlock}>
          <ArtDefs />
          <Routed />
          <Toast />
        </div>
      </BrowserRouter>
    </SessionProvider>
  );
}
