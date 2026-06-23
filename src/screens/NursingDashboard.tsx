import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  FileClock,
  Filter,
  Home,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { CreateCallScreen } from './CreateCallScreen';
import { CallsPanel } from './CallsPanel';
import { getMyCalls, getSectors, signOut } from '../services/movercareService';
import type { Profile, Sector, TransportCall } from '../types/movercare';
import { supabase } from '../lib/supabase';
import '../styles/profile-page-v27.css';
import '../styles/logout-v39.css';

interface NursingDashboardProps {
  profile: Profile;
  onLogout: () => void;
}

type NursingPage = 'dashboard' | 'new-call' | 'calls' | 'profile';

type DashboardStatusFilter = 'TODOS' | 'AGUARDANDO' | 'ACEITOS' | 'EM_TRANSITO' | 'CONCLUIDO';

const sidebarItems: Array<{ id: string; label: string; icon: JSX.Element; page?: NursingPage }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={21} />, page: 'dashboard' },
  { id: 'calls', label: 'Chamados', icon: <ClipboardList size={21} />, page: 'calls' },
  { id: 'new-call', label: 'Novo Chamado', icon: <ClipboardPlus size={21} />, page: 'new-call' },
  { id: 'profile', label: 'Perfil', icon: <UsersRound size={21} />, page: 'profile' },
  { id: 'maqueiros', label: 'Maqueiros', icon: <UsersRound size={21} /> },
  { id: 'setores', label: 'Setores', icon: <Building2 size={21} /> },
  { id: 'historico', label: 'Histórico', icon: <FileClock size={21} />, page: 'calls' },
  { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={21} /> },
];

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

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ABERTO: 'Aberto',
    AGUARDANDO_MAQUEIRO: 'Aguardando',
    ENVIADO: 'Aguardando',
    ACEITO: 'Aceito',
    A_CAMINHO_ORIGEM: 'Aceito',
    EM_TRANSITO: 'Em trânsito',
    CONCLUIDO: 'Concluído',
    CANCELADO: 'Cancelado',
    ATRASADO: 'Atrasado',
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === 'CONCLUIDO') return 'ok';
  if (['ENVIADO', 'ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO'].includes(status)) return 'info';
  if (['AGUARDANDO_MAQUEIRO', 'ATRASADO'].includes(status)) return 'warn';
  if (['CANCELADO'].includes(status)) return 'muted';
  return 'neutral';
}

function priorityClass(priority: string) {
  if (priority === 'CRITICO' || priority === 'URGENTE') return 'danger-soft';
  if (priority === 'NORMAL') return 'success-soft';
  return 'neutral-soft';
}

function riskClass(risk: string) {
  if (risk === 'ALTO') return 'danger-soft';
  if (risk === 'MEDIO') return 'warning-soft';
  if (risk === 'BAIXO') return 'success-soft';
  return 'neutral-soft';
}

function getCallStep(status: string) {
  if (status === 'AGUARDANDO_MAQUEIRO' || status === 'ABERTO') return 0;
  if (status === 'ENVIADO') return 1;
  if (status === 'ACEITO' || status === 'A_CAMINHO_ORIGEM') return 2;
  if (status === 'EM_TRANSITO') return 3;
  if (status === 'CONCLUIDO') return 4;
  if (status === 'ATRASADO') return 1;
  return 0;
}

function MiniTracker({ status }: { status: string }) {
  const step = getCallStep(status);
  return (
    <div className="reference-mini-tracker">
      {[0, 1, 2, 3, 4].map((item) => (
        <span key={item} className={step >= item ? 'done' : ''} />
      ))}
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  sub,
  tone,
}: {
  icon: JSX.Element;
  title: string;
  value: number | string;
  sub: string;
  tone: string;
}) {
  return (
    <article className="reference-metric-card">
      <div className={`reference-metric-icon ${tone}`}>{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </article>
  );
}

function firstName(profile: Profile) {
  return profile.full_name?.split(' ')[0] || 'Enfermeira';
}


function matchesDashboardFilter(call: TransportCall, filter: DashboardStatusFilter) {
  if (filter === 'TODOS') return true;

  if (filter === 'AGUARDANDO') {
    return ['ABERTO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO', 'ATRASADO'].includes(call.status);
  }

  if (filter === 'ACEITOS') {
    return ['ACEITO', 'A_CAMINHO_ORIGEM'].includes(call.status);
  }

  if (filter === 'EM_TRANSITO') {
    return call.status === 'EM_TRANSITO';
  }

  if (filter === 'CONCLUIDO') {
    return call.status === 'CONCLUIDO';
  }

  return true;
}

function DashboardHome({
  calls,
  sectors,
  profile,
  loading,
  loadData,
  goToNewCall,
  goToCalls,
}: {
  calls: TransportCall[];
  sectors: Sector[];
  profile: Profile;
  loading: boolean;
  loadData: () => void;
  goToNewCall: () => void;
  goToCalls: () => void;
}) {
  const typedProfile = profile as any;
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<DashboardStatusFilter>('TODOS');
  const opened = calls.filter((call) => !['CONCLUIDO', 'CANCELADO'].includes(call.status));
  const inProgress = calls.filter((call) => ['ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO'].includes(call.status));
  const completedToday = calls.filter((call) => call.status === 'CONCLUIDO' && isToday((call as any).completed_at ?? call.created_at));
  const delayed = calls.filter((call) => ['ATRASADO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO'].includes(call.status));
  const filteredDashboardCalls = calls.filter((call) => matchesDashboardFilter(call, dashboardStatusFilter));
  const visibleCalls = filteredDashboardCalls.slice(0, 7);
  const recentCalls = calls.slice(0, 5);

  return (
    <>
      <header className="reference-topbar fade-down">
        <div>
          <h1>Painel da Enfermeira</h1>
        </div>

        <div className="reference-topbar-right">
          <button type="button" className={loading ? 'icon-button spin-button' : 'icon-button'} onClick={loadData}>
            <RefreshCw size={18} />
          </button>
          <button type="button" className="bell-button">
            <Bell size={21} />
            <span />
          </button>
          <div className="reference-user">
            <div className="user-photo">{firstName(profile).slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{profile.full_name || 'Enfermeira Ana'}</strong>
              <small>{typedProfile.sector?.name || typedProfile.sector_name || 'Ala 2 - Enfermagem'}</small>
            </div>
          </div>
        </div>
      </header>

      <section className="reference-page fade-up">
        <div className="reference-layout">
          <main className="reference-main">
            <section className="reference-hero-card">
              <div className="hero-avatar">
                <Stethoscope size={38} />
                <span />
              </div>
              <div>
                <h2>Olá, {firstName(profile)}</h2>
                <p>Confira o status dos transportes e acompanhe os chamados em tempo real.</p>
              </div>
              <button type="button" onClick={goToNewCall}>
                <ClipboardPlus size={19} />
                Novo Chamado
              </button>
            </section>

            <section className="reference-metrics">
              <MetricCard
                icon={<ClipboardList size={29} />}
                title="Chamados abertos"
                value={opened.length}
                sub="+3 vs ontem"
                tone="teal"
              />
              <MetricCard
                icon={<Clock3 size={29} />}
                title="Em andamento"
                value={inProgress.length}
                sub="+1 vs ontem"
                tone="amber"
              />
              <MetricCard
                icon={<CheckCircle2 size={29} />}
                title="Concluídos (hoje)"
                value={completedToday.length}
                sub="+8 vs ontem"
                tone="green"
              />
              <MetricCard
                icon={<AlertTriangle size={29} />}
                title="Atrasados"
                value={delayed.length}
                sub="-1 vs ontem"
                tone="red"
              />
            </section>

            <section className="reference-table-panel">
              <div className="reference-toolbar">
                <div className="reference-tabs">
                  <button
                    type="button"
                    className={dashboardStatusFilter === 'TODOS' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('TODOS')}
                  >
                    Todos <span>{calls.length}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'AGUARDANDO' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('AGUARDANDO')}
                  >
                    Aguardando <span>{delayed.length}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'ACEITOS' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('ACEITOS')}
                  >
                    Aceitos <span>{calls.filter((c) => ['ACEITO', 'A_CAMINHO_ORIGEM'].includes(c.status)).length}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'EM_TRANSITO' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('EM_TRANSITO')}
                  >
                    Em trânsito <span>{calls.filter((c) => c.status === 'EM_TRANSITO').length}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'CONCLUIDO' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('CONCLUIDO')}
                  >
                    Concluídos <span>{calls.filter((c) => c.status === 'CONCLUIDO').length}</span>
                  </button>
                </div>

                <div className="reference-search">
                  <input placeholder="Buscar por paciente, protocolo ou destino..." />
                  <button className="light-button"><Filter size={17} /> Filtros</button>
                </div>
              </div>

              <div className="reference-data-table">
                <div className="reference-data-head">
                  <span>Protocolo</span>
                  <span>Paciente</span>
                  <span>Origem</span>
                  <span>Destino</span>
                  <span>Prioridade</span>
                  <span>Risco</span>
                  <span>Status</span>
                  <span>Andamento</span>
                </div>

                {visibleCalls.length === 0 && <div className="empty-row">Nenhum chamado encontrado.</div>}

                {visibleCalls.map((call) => {
                  const typedCall = call as any;
                  return (
                    <button type="button" className="reference-data-row" key={call.id} onClick={goToCalls}>
                      <strong>#{String(call.number).padStart(6, '0')}</strong>
                      <span>{call.patient_code || 'Paciente não informado'}</span>
                      <span>{typedCall.origin_sector?.name ?? '-'}</span>
                      <span>{typedCall.destination_sector?.name ?? '-'}</span>
                      <span className={`soft-pill ${priorityClass(call.priority)}`}>{call.priority}</span>
                      <span className={`soft-pill ${riskClass(call.risk)}`}>{call.risk}</span>
                      <span className={`status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
                      <MiniTracker status={call.status} />
                    </button>
                  );
                })}
              </div>

              <div className="reference-table-footer">
                <span>Mostrando 1 a {visibleCalls.length} de {filteredDashboardCalls.length} chamados filtrados</span>
                <div>
                  <button className="pager">‹</button>
                  <button className="pager active">1</button>
                  <button className="pager">2</button>
                  <button className="pager">3</button>
                  <button className="pager">...</button>
                  <button className="pager">›</button>
                </div>
              </div>
            </section>
          </main>

          <aside className="reference-right">
            <section className="reference-side-card">
              <h3><Bell size={19} /> Alertas</h3>
              <div className="reference-alert danger">
                <AlertTriangle size={18} />
                <div>
                  <strong>{delayed.length} chamados atrasados</strong>
                  <small>Precisam de atenção imediata.</small>
                </div>
                <span>›</span>
              </div>

              <div className="reference-alert warning">
                <Package size={18} />
                <div>
                  <strong>1 equipamento com alerta</strong>
                  <small>Verifique equipamentos do setor.</small>
                </div>
                <span>›</span>
              </div>
            </section>

            <section className="reference-side-card">
              <h3><ClipboardCheck size={19} /> Chamados recentes</h3>
              <div className="reference-recent-list">
                {recentCalls.length === 0 && <div className="empty-side">Nenhum chamado recente.</div>}
                {recentCalls.map((call) => (
                  <button key={call.id} type="button" onClick={goToCalls}>
                    <div>
                      <strong>#{String(call.number).padStart(6, '0')}</strong>
                      <small>{call.patient_code || 'Paciente não informado'}</small>
                    </div>
                    <span className={`status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
                  </button>
                ))}
              </div>
              <button className="full-light-button" onClick={goToCalls}>
                <Menu size={18} />
                Ver todos os chamados
              </button>
            </section>

            <section className="reference-side-card">
              <h3>Atalhos rápidos</h3>
              <div className="quick-shortcuts">
                <button onClick={goToNewCall}><ClipboardCheck size={22} /><span>Checklist</span></button>
                <button><Package size={22} /><span>Equipamentos</span></button>
                <button><UsersRound size={22} /><span>Maqueiros</span></button>
                <button><BarChart3 size={22} /><span>Relatórios</span></button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}


function getProfileContact(profile: Profile) {
  const typedProfile = profile as any;

  return {
    email: typedProfile.email || 'E-mail não cadastrado',
    phone: typedProfile.phone || typedProfile.telefone || typedProfile.phone_number || 'Telefone não cadastrado',
  };
}

function getProfileSector(profile: Profile, sectors: Sector[]) {
  const typedProfile = profile as any;
  return (
    typedProfile.sector?.name ||
    typedProfile.sector_name ||
    sectors.find((sector) => sector.id === profile.sector_id)?.name ||
    'Setor não cadastrado'
  );
}

function NursingProfilePage({ profile, sectors }: { profile: Profile; sectors: Sector[] }) {
  const contact = getProfileContact(profile);
  const sectorName = getProfileSector(profile, sectors);
  const initials = (profile.full_name || 'Enfermeira')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="profile-page-grid">
      <section className="profile-hero-card">
        <div className="profile-avatar-large">
          {(profile as any).avatar_url ? <img src={(profile as any).avatar_url} alt="Foto de perfil" /> : initials}
        </div>

        <div>
          <span className="profile-role-badge">Enfermagem</span>
          <h2>{profile.full_name || 'Enfermeira'}</h2>
          <p>Dados do perfil operacional vinculado ao painel da enfermagem.</p>
        </div>
      </section>

      <section className="profile-info-card">
        <h3>Informações principais</h3>

        <div className="profile-info-list">
          <div>
            <small>Nome</small>
            <strong>{profile.full_name || 'Não cadastrado'}</strong>
          </div>

          <div>
            <small>Setor</small>
            <strong>{sectorName}</strong>
          </div>

          <div>
            <small>E-mail</small>
            <strong>{contact.email}</strong>
          </div>

          <div>
            <small>Telefone</small>
            <strong>{contact.phone}</strong>
          </div>
        </div>
      </section>

      <section className="profile-info-card">
        <h3>Status do acesso</h3>

        <div className="profile-status-row">
          <span className={profile.active ? 'profile-status-dot ok' : 'profile-status-dot muted'} />
          <div>
            <strong>{profile.active ? 'Perfil ativo' : 'Perfil inativo'}</strong>
            <small>{profile.role}</small>
          </div>
        </div>

        <p className="profile-helper-text">
          Para alterar e-mail, telefone ou foto, atualize os dados do usuário na tabela profiles.
        </p>
      </section>
    </div>
  );
}


export function NursingDashboard({ profile, onLogout }: NursingDashboardProps) {
  const [activePage, setActivePage] = useState<NursingPage>('dashboard');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [calls, setCalls] = useState<TransportCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePageTitle = useMemo(() => {
    if (activePage === 'dashboard') return 'Dashboard';
    if (activePage === 'calls') return 'Chamados';
    if (activePage === 'profile') return 'Perfil';
    return 'Novo Chamado';
  }, [activePage]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [loadedSectors, loadedCalls] = await Promise.all([getSectors(), getMyCalls()]);
      setSectors(loadedSectors);
      setCalls(loadedCalls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    onLogout();
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const refresh = () => {
      loadData();
    };

    const transportChannel = supabase
      .channel('nursing-transport-calls-auto-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transport_calls',
        },
        refresh
      )
      .subscribe();

    const maqueiroStatusChannel = supabase
      .channel('nursing-maqueiro-status-auto-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maqueiro_statuses',
        },
        refresh
      )
      .subscribe();

    const interval = window.setInterval(refresh, 10000);

    const handleFocus = () => refresh();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(transportChannel);
      supabase.removeChannel(maqueiroStatusChannel);
    };
  }, []);

  return (
    <div className="reference-shell">
      <aside className="reference-sidebar no-print">
        <BrandLogo />

        <nav className="reference-sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.page === activePage ? 'active' : ''}
              onClick={() => item.page && setActivePage(item.page)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="reference-sidebar-footer">
          <ShieldCheck size={0} />
          <strong>Segurança e qualidade em cada movimento.</strong>

          <button type="button" className="nursing-logout-button" onClick={handleLogout}>
            <LogOut size={17} />
            Sair do painel
          </button>

          <div className="sidebar-watermark">+</div>
        </div>
      </aside>

      <main className="reference-content">
        <div className="mobile-brand no-print">
          <BrandLogo />
          <div className="nursing-mobile-actions">
            <button onClick={loadData} disabled={loading}>Atualizar</button>
            <button type="button" className="nursing-logout-button nursing-mobile-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>

        <div className="mobile-tabs no-print">
          <button className={activePage === 'dashboard' ? 'active' : ''} onClick={() => setActivePage('dashboard')}>
            <Home size={18} /> Dashboard
          </button>
          <button className={activePage === 'calls' ? 'active' : ''} onClick={() => setActivePage('calls')}>
            <ClipboardList size={18} /> Chamados
          </button>
          <button className={activePage === 'new-call' ? 'active' : ''} onClick={() => setActivePage('new-call')}>
            <ClipboardPlus size={18} /> Novo
          </button>
          <button className={activePage === 'profile' ? 'active' : ''} onClick={() => setActivePage('profile')}>
            <UsersRound size={18} /> Perfil
          </button>
        </div>

        {error && <div className="error-box page-error">{error}</div>}

        {activePage === 'dashboard' && (
          <DashboardHome
            calls={calls}
            sectors={sectors}
            profile={profile}
            loading={loading}
            loadData={loadData}
            goToNewCall={() => setActivePage('new-call')}
            goToCalls={() => setActivePage('calls')}
          />
        )}

        {activePage === 'new-call' && (
          <>
            <header className="reference-topbar fade-down">
              <div>
                <h1>Novo Chamado</h1>
              </div>

              <div className="reference-topbar-right">
                <button className="light-button" onClick={() => setActivePage('dashboard')}>Voltar</button>
                <button className="light-button" onClick={handleLogout}><LogOut size={16} /> Sair</button>
              </div>
            </header>

            <section className="reference-page fade-up">
              <CreateCallScreen
                sectors={sectors}
                onCreated={() => {
                  setActivePage('dashboard');
                  loadData();
                }}
              />
            </section>
          </>
        )}

        {activePage === 'calls' && (
          <>
            <header className="reference-topbar fade-down">
              <div>
                <h1>Chamados</h1>
              </div>

              <div className="reference-topbar-right">
                <button onClick={() => setActivePage('new-call')}><ClipboardPlus size={16} /> Novo Chamado</button>
                <button className="light-button" onClick={loadData} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
                <button className="light-button" onClick={handleLogout}><LogOut size={16} /> Sair</button>
              </div>
            </header>

            <section className="reference-page fade-up">
              <CallsPanel calls={calls} sectors={sectors} loading={loading} onCreated={loadData} />
            </section>
          </>
        )}

        {activePage === 'profile' && (
          <>
            <header className="reference-topbar fade-down">
              <div>
                <h1>Perfil</h1>
              </div>

              <div className="reference-topbar-right">
                <button className="light-button" onClick={() => setActivePage('dashboard')}>Voltar</button>
                <button className="light-button" onClick={handleLogout}><LogOut size={16} /> Sair</button>
              </div>
            </header>

            <section className="reference-page fade-up">
              <NursingProfilePage profile={profile} sectors={sectors} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
