import { useState } from 'react';
import type { CSSProperties, FormEvent, MouseEvent } from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRoundCheck,
} from 'lucide-react';

import { signIn } from '../services/movercareService';
import moverCareLogo from '../assets/movercare-logo.png';

interface LoginScreenProps {
  initialError?: string | null;
  onLoggedIn: () => Promise<void> | void;
}

const passwordRecoveryEmail = 'diretoriaensino@husf.org.br';

type ThemeMode = 'light' | 'dark';

export function LoginScreen({ initialError: _initialError, onLoggedIn }: LoginScreenProps) {
  void _initialError;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  const canSubmit = email.trim() !== '' && password.trim() !== '' && !loading;
  void error;
  const isDarkMode = theme === 'dark';

  function handleBackgroundMove(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    setMousePosition({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }

  function handleForgotPassword() {
    const subject = encodeURIComponent('Recuperação de senha - MoverCare');
    const body = encodeURIComponent(
      'Olá, preciso de ajuda para recuperar meu acesso ao MoverCare.'
    );

    window.location.href = `mailto:${passwordRecoveryEmail}?subject=${subject}&body=${body}`;
  }

  const backgroundStyle = {
    '--mouse-x': `${mousePosition.x}%`,
    '--mouse-y': `${mousePosition.y}%`,
  } as CSSProperties;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>
        {`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #root {
            margin: 0;
            min-height: 100%;
          }

          body {
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .mover-login-page {
            --page-bg:
              radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(20, 201, 204, 0.24), transparent 24%),
              radial-gradient(circle at 10% 10%, rgba(20, 201, 204, 0.16), transparent 28%),
              radial-gradient(circle at 90% 90%, rgba(0, 119, 217, 0.18), transparent 32%),
              linear-gradient(135deg, #f7fbff 0%, #eef8ff 48%, #f5fffd 100%);
            --grid-line: rgba(6, 43, 88, 0.05);
            --glow-bg: rgba(20, 201, 204, 0.24);
            --orb-one: rgba(20, 201, 204, 0.22);
            --orb-two: rgba(0, 119, 217, 0.17);
            --orb-three: rgba(20, 201, 204, 0.18);

            --text: #0f172a;
            --title: #062b58;
            --muted: #64748b;
            --placeholder: #94a3b8;
            --accent: #14c9cc;
            --accent-blue: #0077d9;
            --card-bg: rgba(255, 255, 255, 0.96);
            --soft-card-bg: rgba(255, 255, 255, 0.82);
            --chip-bg: rgba(255, 255, 255, 0.86);
            --input-bg: #ffffff;
            --quick-bg: #f8fbff;
            --border: rgba(148, 163, 184, 0.28);
            --accent-border: rgba(20, 201, 204, 0.28);
            --card-shadow: 0 30px 72px rgba(6, 43, 88, 0.16);
            --soft-shadow: 0 16px 34px rgba(6, 43, 88, 0.06);
            --button-gradient: linear-gradient(135deg, #062b58, #0077d9, #14c9cc);
            --button-shadow: 0 18px 36px rgba(0, 119, 217, 0.25);
            --error-bg: #fef2f2;
            --error-text: #b91c1c;
            --error-border: rgba(220, 38, 38, 0.18);

            position: fixed;
            inset: 0;
            z-index: 999;
            width: 100vw;
            min-height: 100vh;
            overflow-y: auto;
            background: var(--page-bg);
            color: var(--text);
            padding: 28px;
            transition:
              background 0.35s ease,
              color 0.25s ease;
          }

          .mover-login-page--dark {
            --page-bg:
              radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(20, 201, 204, 0.18), transparent 24%),
              radial-gradient(circle at 12% 12%, rgba(20, 201, 204, 0.12), transparent 30%),
              radial-gradient(circle at 88% 86%, rgba(0, 119, 217, 0.18), transparent 34%),
              linear-gradient(135deg, #020617 0%, #06162b 45%, #062b58 100%);
            --grid-line: rgba(148, 163, 184, 0.07);
            --glow-bg: rgba(20, 201, 204, 0.18);
            --orb-one: rgba(20, 201, 204, 0.16);
            --orb-two: rgba(0, 119, 217, 0.22);
            --orb-three: rgba(34, 211, 238, 0.14);

            --text: #e5f5ff;
            --title: #f8fbff;
            --muted: #a8bdd4;
            --placeholder: #7891aa;
            --accent: #22d3ee;
            --accent-blue: #38bdf8;
            --card-bg: rgba(6, 22, 43, 0.88);
            --soft-card-bg: rgba(15, 35, 61, 0.72);
            --chip-bg: rgba(15, 35, 61, 0.72);
            --input-bg: rgba(4, 16, 32, 0.88);
            --quick-bg: rgba(10, 28, 52, 0.72);
            --border: rgba(148, 163, 184, 0.2);
            --accent-border: rgba(34, 211, 238, 0.22);
            --card-shadow: 0 30px 82px rgba(0, 0, 0, 0.34);
            --soft-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
            --button-gradient: linear-gradient(135deg, #0f766e, #0284c7, #22d3ee);
            --button-shadow: 0 18px 36px rgba(34, 211, 238, 0.14);
            --error-bg: rgba(127, 29, 29, 0.22);
            --error-text: #fecaca;
            --error-border: rgba(248, 113, 113, 0.25);
          }

          .mover-bg-grid {
            position: fixed;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: 0.34;
            background-image:
              linear-gradient(var(--grid-line) 1px, transparent 1px),
              linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
            background-size: 42px 42px;
            mask-image: radial-gradient(circle at center, black, transparent 75%);
          }

          .mover-bg-glow {
            position: fixed;
            left: var(--mouse-x, 50%);
            top: var(--mouse-y, 50%);
            z-index: 0;
            width: 430px;
            height: 430px;
            pointer-events: none;
            border-radius: 999px;
            background: radial-gradient(circle, var(--glow-bg), transparent 62%);
            transform: translate(-50%, -50%);
            filter: blur(10px);
            transition: left 0.12s ease, top 0.12s ease;
          }

          .mover-bg-orb {
            position: fixed;
            z-index: 0;
            pointer-events: none;
            border-radius: 999px;
            filter: blur(2px);
            opacity: 0.6;
            animation: moverFloat 9s ease-in-out infinite;
          }

          .mover-bg-orb-one {
            width: 180px;
            height: 180px;
            left: 8%;
            top: 18%;
            background: var(--orb-one);
          }

          .mover-bg-orb-two {
            width: 230px;
            height: 230px;
            right: 8%;
            bottom: 12%;
            background: var(--orb-two);
            animation-delay: -3s;
          }

          .mover-bg-orb-three {
            width: 120px;
            height: 120px;
            right: 28%;
            top: 18%;
            background: var(--orb-three);
            animation-delay: -6s;
          }

          @keyframes moverFloat {
            0% {
              transform: translate3d(0, 0, 0) scale(1);
            }

            50% {
              transform: translate3d(18px, -22px, 0) scale(1.08);
            }

            100% {
              transform: translate3d(0, 0, 0) scale(1);
            }
          }

          .mover-login-shell {
            position: relative;
            z-index: 2;
            width: 100%;
            max-width: 1180px;
            min-height: calc(100vh - 56px);
            margin: 0 auto;
            display: flex;
            flex-direction: column;
          }

          .mover-login-header {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 42px;
            gap: 16px;
          }

          .mover-login-header img {
            width: 220px;
            max-width: 46vw;
            height: auto;
            object-fit: contain;
            display: block;
          }

          .mover-header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .mover-header-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 999px;
            background: var(--chip-bg);
            border: 1px solid var(--accent-border);
            color: var(--title);
            font-size: 14px;
            font-weight: 800;
            box-shadow: var(--soft-shadow);
            backdrop-filter: blur(16px);
            transition:
              background 0.25s ease,
              color 0.25s ease,
              border-color 0.25s ease;
          }

          .mover-header-badge svg {
            color: var(--accent);
          }

          .mover-theme-toggle {
            width: 44px;
            height: 44px;
            border: 1px solid var(--accent-border);
            border-radius: 999px;
            background: var(--chip-bg);
            color: var(--title);
            display: grid;
            place-items: center;
            cursor: pointer;
            box-shadow: var(--soft-shadow);
            backdrop-filter: blur(16px);
            transition:
              transform 0.2s ease,
              background 0.25s ease,
              color 0.25s ease,
              border-color 0.25s ease;
          }

          .mover-theme-toggle:hover {
            transform: translateY(-2px);
            color: var(--accent);
          }

          .mover-login-content {
            flex: 1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 420px;
            align-items: center;
            gap: 56px;
          }

          .mover-hero {
            max-width: 720px;
          }

          .mover-hero-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
            border-radius: 999px;
            background: var(--chip-bg);
            border: 1px solid var(--accent-border);
            color: var(--title);
            font-size: 14px;
            font-weight: 800;
            box-shadow: var(--soft-shadow);
            backdrop-filter: blur(16px);
            transition:
              background 0.25s ease,
              color 0.25s ease,
              border-color 0.25s ease;
          }

          .mover-hero-chip svg {
            color: var(--accent);
          }

          .mover-hero h1 {
            margin: 24px 0 18px;
            color: var(--title);
            font-size: clamp(42px, 5vw, 68px);
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 900;
            transition: color 0.25s ease;
          }

          .mover-hero p {
            max-width: 620px;
            margin: 0;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.7;
            transition: color 0.25s ease;
          }

          .mover-feature-grid {
            width: 100%;
            max-width: 720px;
            margin-top: 32px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
          }

          .mover-feature-card {
            width: 100%;
            min-height: 140px;
            padding: 20px;
            border-radius: 22px;
            background: var(--soft-card-bg);
            border: 1px solid var(--border);
            box-shadow: var(--soft-shadow);
            backdrop-filter: blur(16px);
            transition:
              background 0.25s ease,
              border-color 0.25s ease,
              transform 0.2s ease;
          }

          .mover-feature-card:hover {
            transform: translateY(-2px);
          }

          .mover-feature-card svg {
            color: var(--accent);
            margin-bottom: 14px;
          }

          .mover-feature-card strong {
            display: block;
            margin-bottom: 7px;
            color: var(--title);
            font-size: 15px;
          }

          .mover-feature-card span {
            display: block;
            color: var(--muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .mover-login-card {
            width: 100%;
            padding: 28px;
            border-radius: 28px;
            background: var(--card-bg);
            border: 1px solid var(--accent-border);
            box-shadow: var(--card-shadow);
            backdrop-filter: blur(18px);
            transition:
              background 0.25s ease,
              border-color 0.25s ease,
              box-shadow 0.25s ease;
          }

          .mover-card-logo {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 18px;
          }

          /* TAMANHO DA LOGO DO CARD DE LOGIN:
             altere o width abaixo. No celular, altere também a regra dentro do @media max-width: 680px. */

          .mover-card-logo img {
            width: 320px;
            max-width: 90%;
            height: auto;
            object-fit: contain;
            display: block;
          }

          .mover-card-title {
            text-align: center;
            margin-bottom: 24px;
          }

          .mover-card-title h2 {
            margin: 0 0 6px;
            color: var(--title);
            font-size: 28px;
            line-height: 1.1;
            font-weight: 900;
            letter-spacing: -0.04em;
          }

          .mover-card-title p {
            margin: 0;
            color: var(--muted);
            font-size: 14px;
          }

          .mover-field {
            display: block;
            margin-bottom: 15px;
          }

          .mover-field span {
            display: block;
            margin-bottom: 8px;
            color: var(--title);
            font-size: 14px;
            font-weight: 800;
          }

          .mover-input {
            width: 100%;
            height: 52px;
            padding: 0 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--muted);
            transition:
              background 0.25s ease,
              border-color 0.25s ease,
              color 0.25s ease,
              box-shadow 0.2s ease;
          }

          .mover-input:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.14);
          }

          .mover-input input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--text);
            font-size: 15px;
          }

          .mover-input input::placeholder {
            color: var(--placeholder);
          }

          .mover-eye {
            width: 30px;
            height: 30px;
            flex: 0 0 auto;
            border: 0;
            background: transparent;
            color: var(--muted);
            display: grid;
            place-items: center;
            cursor: pointer;
            padding: 0;
          }

          .mover-eye:hover {
            color: var(--accent);
          }

          .mover-options {
            margin: 6px 0 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            font-size: 13px;
          }

          .mover-options label {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--muted);
            font-weight: 700;
          }

          .mover-options input {
            accent-color: var(--accent);
          }

          .mover-options button {
            border: 0;
            background: transparent;
            color: var(--accent-blue);
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            padding: 0;
          }

          .mover-error {
            margin-bottom: 14px;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid var(--error-border);
            background: var(--error-bg);
            color: var(--error-text);
            font-size: 13px;
            font-weight: 700;
          }

          .mover-submit {
            width: 100%;
            height: 52px;
            border: 0;
            border-radius: 16px;
            background: var(--button-gradient);
            color: #ffffff;
            font-size: 15px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: var(--button-shadow);
            transition: 0.2s ease;
          }

          .mover-submit:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .mover-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .mover-divider {
            margin: 23px 0 16px;
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 10px;
          }

          .mover-divider span {
            height: 1px;
            background: var(--border);
          }

          .mover-divider p {
            margin: 0;
            color: var(--placeholder);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.11em;
          }

          .mover-quick-grid {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
            gap: 12px;
          }

          .mover-quick-grid div {
            width: 100%;
            min-height: 72px;
            padding: 13px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: var(--quick-bg);
            transition:
              background 0.25s ease,
              border-color 0.25s ease,
              transform 0.2s ease;
          }

          .mover-quick-grid div:hover {
            transform: translateY(-2px);
          }

          .mover-quick-grid svg {
            color: var(--accent);
          }

          .mover-quick-grid strong {
            display: block;
            margin-top: 8px;
            color: var(--title);
            font-size: 13px;
          }

          .mover-safe {
            margin-top: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 700;
          }

          .mover-safe svg {
            color: var(--accent);
          }

          @media (max-width: 980px) {
            .mover-login-page {
              position: relative;
              min-height: 100vh;
            }

            .mover-login-content {
              grid-template-columns: 1fr;
              gap: 34px;
            }

            .mover-hero {
              text-align: center;
              margin: 0 auto;
            }

            .mover-hero-chip {
              margin: 0 auto;
            }

            .mover-hero p {
              margin: 0 auto;
            }

            .mover-feature-grid {
              max-width: 720px;
              margin-left: auto;
              margin-right: auto;
            }

            .mover-login-card {
              max-width: 430px;
              margin: 0 auto;
            }
          }

          @media (max-width: 680px) {
            .mover-login-page {
              padding: 20px 18px 34px;
            }

            .mover-login-shell {
              min-height: auto;
            }

            .mover-login-header {
              margin-bottom: 30px;
            }

            .mover-login-header img {
              width: 175px;
              max-width: 54vw;
              height: auto;
            }

            .mover-header-badge span {
              display: none;
            }

            .mover-hero h1 {
              font-size: 38px;
            }

            .mover-hero p {
              font-size: 15px;
            }

            .mover-feature-grid {
              grid-template-columns: 1fr;
            }

            .mover-login-card {
              width: 100%;
              max-width: 100%;
              padding: 22px;
              border-radius: 24px;
            }

            .mover-card-logo img {
              width: 285px;
              max-width: 92%;
              height: auto;
            }

            .mover-options {
              flex-direction: column;
              align-items: flex-start;
            }

            .mover-quick-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 420px) {
            .mover-login-header {
              align-items: flex-start;
            }

            .mover-header-actions {
              gap: 8px;
            }

            .mover-theme-toggle {
              width: 40px;
              height: 40px;
            }

            .mover-quick-grid {
              grid-template-columns: 1fr;
            }

            .mover-feature-card,
            .mover-quick-grid div {
              min-height: auto;
            }
          }
        `}
      </style>

      <main
        className={`mover-login-page mover-login-page--${theme}`}
        onMouseMove={handleBackgroundMove}
        style={backgroundStyle}
      >
        <div className="mover-bg-grid" />
        <div className="mover-bg-glow" />
        <div className="mover-bg-orb mover-bg-orb-one" />
        <div className="mover-bg-orb mover-bg-orb-two" />
        <div className="mover-bg-orb mover-bg-orb-three" />

        <div className="mover-login-shell">
          <header className="mover-login-header">
            <img src={moverCareLogo} alt="MoverCare" />

            <div className="mover-header-actions">
              <div className="mover-header-badge">
                <ShieldCheck size={16} />
                <span>Área da Enfermagem</span>
              </div>

              <button
                type="button"
                className="mover-theme-toggle"
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {isDarkMode ? <Sun size={19} /> : <Moon size={19} />}
              </button>
            </div>
          </header>

          <section className="mover-login-content">
            <div className="mover-hero">
              <div className="mover-hero-chip">
                <ShieldCheck size={18} />
                Seguro • Confiável • Eficiente
              </div>

              <h1>Transporte interno hospitalar com mais agilidade</h1>

              <p>
                Organize chamados, acompanhe status em tempo real e mantenha enfermagem,
                setores e maqueiros alinhados em uma única plataforma.
              </p>

              <div className="mover-feature-grid">
                <div className="mover-feature-card">
                  <Clock3 size={24} />
                  <strong>Tempo real</strong>
                  <span>Acompanhe cada etapa do transporte.</span>
                </div>

                <div className="mover-feature-card">
                  <ShieldCheck size={24} />
                  <strong>Mais segurança</strong>
                  <span>Confirme origem, destino e dados essenciais.</span>
                </div>

                <div className="mover-feature-card">
                  <BarChart3 size={24} />
                  <strong>Histórico</strong>
                  <span>Controle os últimos chamados realizados.</span>
                </div>
              </div>
            </div>

            <form className="mover-login-card" onSubmit={handleSubmit}>
              <div className="mover-card-logo">
                <img src={moverCareLogo} alt="MoverCare" />
              </div>

              <div className="mover-card-title">
                <h2>Bem-vindo</h2>
                <p>Acesse sua conta para continuar</p>
              </div>

              <label className="mover-field">
                <span>Usuário ou e-mail</span>

                <div className="mover-input">
                  <UserRoundCheck size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Digite seu e-mail"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="mover-field">
                <span>Senha</span>

                <div className="mover-input">
                  <LockKeyhole size={18} />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="mover-eye"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="mover-options">
                <label>
                  <input type="checkbox" defaultChecked />
                  Lembrar de mim
                </label>

                <button type="button" onClick={handleForgotPassword}>Esqueci minha senha</button>
              </div>

              <button type="submit" className="mover-submit" disabled={!canSubmit}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="mover-divider">
                <span />
                <p>Acesso operacional</p>
                <span />
              </div>

              <div className="mover-quick-grid">
                <div>
                  <Stethoscope size={18} />
                  <strong>Novo chamado</strong>
                </div>

                <div>
                  <Activity size={18} />
                  <strong>Status</strong>
                </div>

                <div>
                  <ShieldCheck size={18} />
                  <strong>Setores</strong>
                </div>

                <div>
                  <BarChart3 size={18} />
                  <strong>Histórico</strong>
                </div>
              </div>

              <small className="mover-safe">
                <ShieldCheck size={14} />
                Ambiente protegido para uso interno.
              </small>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
