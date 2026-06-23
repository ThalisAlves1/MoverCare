import { FormEvent, useState } from 'react';
import { Activity, BarChart3, Clock3, LockKeyhole, ShieldCheck, Stethoscope, UserRoundCheck } from 'lucide-react';
import { signIn } from '../services/movercareService';

interface LoginScreenProps {
  initialError?: string | null;
  onLoggedIn: () => Promise<void> | void;
}

function BrandLogo() {
  return (
    <div className="brand-logo">
      <div className="logo-cross">
        <span />
        <span />
      </div>
      <strong>Mover<span>Care</span></strong>
    </div>
  );
}

export function LoginScreen({ initialError, onLoggedIn }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn(email, password);
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-header fade-down">
        <BrandLogo />
        <div className="login-help">
          <span>Área da Enfermagem</span>
          <button type="button" className="theme-dot">☀</button>
        </div>
      </header>

      <section className="login-main">
        <div className="login-hero fade-up">
          <span className="trust-pill"><ShieldCheck size={17} /> Seguro • Confiável • Eficiente</span>
          <h1>Solicite transportes internos com mais segurança e agilidade</h1>
          <p>
            Acompanhe o status de cada chamado, confirme informações essenciais e mantenha a equipe
            assistencial alinhada em tempo real.
          </p>

          <div className="hospital-illustration">
            <div className="floating-card card-one">
              <Activity size={18} />
              <span>Operação ativa</span>
            </div>
            <div className="floating-card card-two">
              <Clock3 size={18} />
              <span>Tempo real</span>
            </div>
            <div className="doctor-figure" />
            <div className="bed-figure" />
            <div className="patient-figure" />
          </div>

          <div className="feature-list">
            <div>
              <span className="line-icon"><ShieldCheck size={24} /></span>
              <strong>Checklist seguro</strong>
              <small>Destino, equipe e equipamentos confirmados.</small>
            </div>
            <div>
              <span className="line-icon"><Clock3 size={24} /></span>
              <strong>Tempo real</strong>
              <small>Acompanhe cada etapa do transporte.</small>
            </div>
            <div>
              <span className="line-icon"><BarChart3 size={24} /></span>
              <strong>Fluxo padronizado</strong>
              <small>Menos ruído entre enfermagem e maqueiros.</small>
            </div>
          </div>
        </div>

        <form className="login-card fade-up delay-1" onSubmit={handleSubmit}>
          <h2>Bem-vindo ao <span>MoverCare</span></h2>
          <p>Acesse sua conta para continuar</p>

          <label>
            Usuário ou e-mail
            <div className="input-icon">
              <UserRoundCheck size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Digite seu e-mail"
                required
              />
            </div>
          </label>

          <label>
            Senha
            <div className="input-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
              />
            </div>
          </label>

          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked />
              Lembrar de mim
            </label>
            <a>Esqueci minha senha</a>
          </div>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" disabled={loading} className={loading ? 'button-loading' : ''}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="access-as">
            <span />
            <p>Acesso operacional</p>
            <span />
          </div>

          <div className="role-grid">
            <div><Stethoscope size={20} /><b>Novo chamado</b><small>Solicitação rápida</small></div>
            <div><Activity size={20} /><b>Status</b><small>Tempo real</small></div>
            <div><ShieldCheck size={20} /><b>Setores</b><small>Origem e destino</small></div>
            <div><BarChart3 size={20} /><b>Histórico</b><small>Últimos chamados</small></div>
          </div>

          <small className="secure-note"><ShieldCheck size={14} /> Ambiente protegido para uso operacional interno.</small>
        </form>
      </section>
    </main>
  );
}
