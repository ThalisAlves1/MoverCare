import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { LoaderIcon } from 'lucide-react';
import './styles/loading-spinner-v38.css';
import { LoginScreen } from './screens/LoginScreen';
import { NursingDashboard } from './screens/NursingDashboard';
import { getMyProfile } from './services/movercareService';
import type { Profile } from './types/movercare';


function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Spinner({ className = '', ...props }: ComponentProps<'svg'>) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn('spinner-icon', className)}
      {...props}
    />
  );
}

function SpinnerCustom() {
  return (
    <div className="spinner-custom">
      <Spinner />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="nursing-loading-screen">
      <div className="nursing-loading-card">
        <div className="nursing-loading-brand">
          <strong>Mover<span>Care</span></strong>
          <small>Carregando enfermagem</small>
        </div>

        <div className="nursing-spinner-area">
          <SpinnerCustom />
        </div>

        <h1>Preparando o painel</h1>
        <p>Sincronizando chamados, setores e informações da enfermagem.</p>
      </div>
    </div>
  );
}


export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setCheckingSession(true);
    setError(null);
    try {
      const currentProfile = await getMyProfile();

      if (!['ENFERMEIRA', 'COORDENADOR', 'ADMIN'].includes(currentProfile.role)) {
        throw new Error('Este painel é exclusivo para enfermagem, coordenação ou administração.');
      }

      setProfile(currentProfile);
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o perfil.');
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (checkingSession) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return <LoginScreen initialError={error} onLoggedIn={loadProfile} />;
  }

  return <NursingDashboard profile={profile} onLogout={() => setProfile(null)} />;
}
