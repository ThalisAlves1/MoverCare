import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
  Moon,
  Package,
  RefreshCw,
  Route,
  ShieldCheck,
  Stethoscope,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';

import { CreateCallScreen } from './CreateCallScreen';
import { CallsPanel } from './CallsPanel';
import { createTransportCall, getMyCalls, getSectors, signOut } from '../services/movercareService';
import type { CreateCallForm, Profile, Sector, TransportCall } from '../types/movercare';
import { supabase } from '../lib/supabase';
import moverCareLogo from '../assets/logo_topo.png';

interface NursingDashboardProps {
  profile: Profile;
  onLogout: () => void;
}

type NursingPage = 'dashboard' | 'new-call' | 'calls' | 'profile' | 'call-detail';
type ThemeMode = 'light' | 'dark';
type DashboardStatusFilter = 'TODOS' | 'AGUARDANDO' | 'ACEITOS' | 'EM_TRANSITO' | 'CONCLUIDO';

const sidebarItems: Array<{ id: string; label: string; icon: ReactNode; page?: NursingPage }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, page: 'dashboard' },
  { id: 'calls', label: 'Chamados', icon: <ClipboardList size={20} />, page: 'calls' },
  { id: 'new-call', label: 'Novo Chamado', icon: <ClipboardPlus size={20} />, page: 'new-call' },
  { id: 'profile', label: 'Perfil', icon: <UsersRound size={20} />, page: 'profile' },
  { id: 'maqueiros', label: 'Maqueiros', icon: <UsersRound size={20} /> },
  { id: 'setores', label: 'Setores', icon: <Building2 size={20} /> },
  { id: 'historico', label: 'Histórico', icon: <FileClock size={20} />, page: 'calls' },
  { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={20} /> },
];

function BrandLogo() {
  return (
    <div className="nd-brand-logo">
      <img src={moverCareLogo} alt="MoverCare" className="nd-brand-logo-img" />
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
    ENVIADO: 'Enviado',
    ACEITO: 'Aceito',
    A_CAMINHO_ORIGEM: 'A caminho',
    EM_TRANSITO: 'Em trânsito',
    CONCLUIDO: 'Concluído',
    CANCELADO: 'Cancelado',
    ATRASADO: 'Atrasado',
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === 'CONCLUIDO') return 'success';
  if (['ENVIADO', 'ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO'].includes(status)) return 'info';
  if (['AGUARDANDO_MAQUEIRO', 'ATRASADO'].includes(status)) return 'warning';
  if (status === 'CANCELADO') return 'muted';
  return 'neutral';
}

function priorityClass(priority: string) {
  if (priority === 'CRITICO') return 'danger';
  if (priority === 'URGENTE') return 'warning';
  if (priority === 'NORMAL') return 'success';
  return 'neutral';
}

function riskClass(risk: string) {
  if (risk === 'ALTO') return 'danger';
  if (risk === 'MEDIO') return 'warning';
  if (risk === 'BAIXO') return 'success';
  return 'neutral';
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

function MiniTracker({ status }: { status: string }) {
  const step = getCallStep(status);

  return (
    <div className="nd-mini-tracker" aria-label={`Andamento: ${statusLabel(status)}`}>
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
  icon: ReactNode;
  title: string;
  value: number | string;
  sub: string;
  tone: string;
}) {
  return (
    <article className="nd-metric-card">
      <div className={`nd-metric-icon ${tone}`}>{icon}</div>

      <div className="nd-metric-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </article>
  );
}

function EmergencyQuickModal({
  sectors,
  onClose,
  onCreated,
}: {
  sectors: Sector[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    patientCode: '',
    bedNumber: '',
    originSectorId: '',
    destinationSectorId: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitEmergency() {
    setError(null);

    try {
      if (!form.patientCode.trim()) throw new Error('Informe o nome ou código do paciente.');
      if (!form.bedNumber.trim()) throw new Error('Informe o leito.');
      if (!form.originSectorId || !form.destinationSectorId) throw new Error('Informe origem e destino.');
      if (form.originSectorId === form.destinationSectorId) throw new Error('Origem e destino não podem ser iguais.');

      setLoading(true);

      const payload: CreateCallForm = {
        patientCode: form.patientCode.trim(),
        bedNumber: form.bedNumber.trim(),
        originSectorId: form.originSectorId,
        destinationSectorId: form.destinationSectorId,
        transportType: 'MACA',
        priority: 'CRITICO',
        risk: 'ALTO',
        destinationCommunicated: true,
        teamConfirmed: true,
        equipmentConfirmed: true,
        infectionPrecaution: 'PADRAO',
        observation: 'MODO EMERGÊNCIA: chamado crítico aberto pelo atalho do dashboard.',
      };

      await createTransportCall(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar chamado de emergência.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nd-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nd-modal">
        <button type="button" className="nd-modal-close" onClick={onClose} aria-label="Fechar emergência">
          <X size={18} />
        </button>

        <div className="nd-modal-head danger">
          <span>
            <AlertTriangle size={18} />
            Chamado crítico
          </span>

          <h2>Emergência rápida</h2>

          <p>
            Preencha somente o essencial. O sistema envia como maca, prioridade crítica e risco alto.
          </p>
        </div>

        <div className="nd-emergency-grid">
          <label>
            <span>Nome ou código do paciente</span>
            <input
              value={form.patientCode}
              onChange={(event) => update('patientCode', event.target.value)}
              placeholder="Ex.: Maria Silva ou PAC-001"
              autoFocus
            />
          </label>

          <label>
            <span>Leito</span>
            <input
              value={form.bedNumber}
              onChange={(event) => update('bedNumber', event.target.value)}
              placeholder="Ex.: 204A, UTI-03"
            />
          </label>

          <label>
            <span>Origem</span>
            <select value={form.originSectorId} onChange={(event) => update('originSectorId', event.target.value)}>
              <option value="">Selecione</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Destino</span>
            <select value={form.destinationSectorId} onChange={(event) => update('destinationSectorId', event.target.value)}>
              <option value="">Selecione</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="nd-emergency-fixed">
          <span>
            Transporte: <strong>Maca</strong>
          </span>

          <span>
            Prioridade: <strong>Crítico</strong>
          </span>

          <span>
            Risco: <strong>Alto</strong>
          </span>
        </div>

        {error && <div className="nd-error">{error}</div>}

        <div className="nd-modal-actions">
          <button type="button" className="nd-danger-button" onClick={submitEmergency} disabled={loading}>
            {loading ? 'Criando emergência...' : 'Confirmar emergência'}
          </button>

          <button type="button" className="nd-secondary-button" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardHome({
  calls,
  sectors,
  profile,
  loading,
  loadData,
  goToNewCall,
  goToCalls,
  openCallDetails,
  isDarkMode,
  toggleTheme,
}: {
  calls: TransportCall[];
  sectors: Sector[];
  profile: Profile;
  loading: boolean;
  loadData: () => void;
  goToNewCall: () => void;
  goToCalls: () => void;
  openCallDetails: (call: TransportCall) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}) {
  const typedProfile = profile as any;

  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<DashboardStatusFilter>('TODOS');
  const [query, setQuery] = useState('');
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const opened = calls.filter((call) => !['CONCLUIDO', 'CANCELADO'].includes(call.status));
  const inProgress = calls.filter((call) => ['ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO'].includes(call.status));
  const completedToday = calls.filter((call) => call.status === 'CONCLUIDO' && isToday((call as any).completed_at ?? call.created_at));
  const delayed = calls.filter((call) => ['ATRASADO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO'].includes(call.status));
  const acceptedCount = calls.filter((call) => ['ACEITO', 'A_CAMINHO_ORIGEM'].includes(call.status)).length;
  const transitCount = calls.filter((call) => call.status === 'EM_TRANSITO').length;
  const completedCount = calls.filter((call) => call.status === 'CONCLUIDO').length;

  const filteredDashboardCalls = calls
    .filter((call) => matchesDashboardFilter(call, dashboardStatusFilter))
    .filter((call) => {
      const search = query.trim().toLowerCase();
      const typedCall = call as any;

      if (!search) return true;

      return [
        String(call.number ?? ''),
        call.patient_code ?? '',
        typedCall.origin_sector?.name ?? '',
        typedCall.destination_sector?.name ?? '',
        call.priority ?? '',
        call.risk ?? '',
        call.status ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });

  const visibleCalls = filteredDashboardCalls.slice(0, 8);
  const recentCalls = calls.slice(0, 5);

  return (
    <>
      <header className="nd-topbar">
        <div className="nd-topbar-left">
          <div className="nd-topbar-title">
            <span className="nd-page-kicker">Painel operacional</span>
            <h1>Dashboard da enfermagem</h1>
          </div>
        </div>

        <div className="nd-topbar-right">
          <button type="button" className={loading ? 'nd-icon-button spinning' : 'nd-icon-button'} onClick={loadData}>
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="nd-theme-button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button type="button" className="nd-bell-button">
            <Bell size={20} />
            <span />
          </button>

          <div className="nd-user-card">
            <div className="nd-user-avatar">{firstName(profile).slice(0, 1).toUpperCase()}</div>

            <div>
              <strong>{profile.full_name || 'Enfermeira'}</strong>
              <small>{typedProfile.sector?.name || typedProfile.sector_name || 'Ala 2 - Enfermagem'}</small>
            </div>
          </div>
        </div>
      </header>

      <section className="nd-dashboard-page">
        <section className="nd-welcome-card">
          <div className="nd-welcome-icon">
            <Stethoscope size={34} />
          </div>

          <div className="nd-welcome-text">
            <span>Olá, {firstName(profile)}</span>
            <h2>Controle dos transportes internos</h2>
            <p>
              Veja rapidamente o que está aberto, em andamento, atrasado e finalizado. Tudo separado em blocos para facilitar a leitura.
            </p>
          </div>

          <div className="nd-welcome-actions">
            <button type="button" className="nd-primary-button" onClick={goToNewCall}>
              <ClipboardPlus size={18} />
              Novo chamado
            </button>

            <button type="button" className="nd-danger-outline-button" onClick={() => setShowEmergencyModal(true)}>
              <AlertTriangle size={18} />
              Emergência
            </button>
          </div>
        </section>

        <section className="nd-metrics-grid">
          <MetricCard
            icon={<ClipboardList size={28} />}
            title="Chamados abertos"
            value={opened.length}
            sub="Pendentes ou em execução"
            tone="blue"
          />

          <MetricCard
            icon={<Clock3 size={28} />}
            title="Em andamento"
            value={inProgress.length}
            sub="Chamados em movimento"
            tone="amber"
          />

          <MetricCard
            icon={<CheckCircle2 size={28} />}
            title="Concluídos hoje"
            value={completedToday.length}
            sub="Finalizados hoje"
            tone="green"
          />

          <MetricCard
            icon={<AlertTriangle size={28} />}
            title="Atenção"
            value={delayed.length}
            sub="Precisam de atenção"
            tone="red"
          />
        </section>

        <div className="nd-main-grid">
          <main className="nd-main-column">
            <section className="nd-panel">
              <div className="nd-panel-header">
                <div>
                  <span className="nd-section-label">Monitoramento</span>
                  <h3>Lista de chamados</h3>
                </div>

                <button type="button" className="nd-secondary-button" onClick={goToCalls}>
                  Ver todos
                </button>
              </div>

              <div className="nd-toolbar">
                <div className="nd-tabs">
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
                    Aceitos <span>{acceptedCount}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'EM_TRANSITO' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('EM_TRANSITO')}
                  >
                    Em trânsito <span>{transitCount}</span>
                  </button>

                  <button
                    type="button"
                    className={dashboardStatusFilter === 'CONCLUIDO' ? 'active' : ''}
                    onClick={() => setDashboardStatusFilter('CONCLUIDO')}
                  >
                    Concluídos <span>{completedCount}</span>
                  </button>
                </div>

                <div className="nd-search-box">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por paciente, origem ou destino..."
                  />

                  <button type="button" className="nd-secondary-button">
                    <Filter size={16} />
                    Filtro
                  </button>
                </div>
              </div>

              <div className="nd-call-list">
                {visibleCalls.length === 0 && (
                  <div className="nd-empty-state">
                    <ClipboardList size={26} />
                    <strong>Nenhum chamado encontrado</strong>
                    <span>Altere os filtros ou atualize a página.</span>
                  </div>
                )}

                {visibleCalls.map((call) => {
                  const typedCall = call as any;

                  return (
                    <button type="button" className="nd-call-card" key={call.id} onClick={() => openCallDetails(call)}>
                      <div className="nd-call-main">
                        <div className="nd-call-number">
                          <small>Protocolo</small>
                          <strong>#{String(call.number).padStart(6, '0')}</strong>
                        </div>

                        <div className="nd-call-patient">
                          <small>Paciente</small>
                          <strong>{call.patient_code || 'Paciente não informado'}</strong>
                        </div>

                        <div className="nd-call-route">
                          <div>
                            <small>Origem</small>
                            <strong>{typedCall.origin_sector?.name ?? '-'}</strong>
                          </div>

                          <ArrowRight size={16} />

                          <div>
                            <small>Destino</small>
                            <strong>{typedCall.destination_sector?.name ?? '-'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="nd-call-meta">
                        <span className={`nd-pill ${priorityClass(call.priority)}`}>{call.priority}</span>
                        <span className={`nd-pill ${riskClass(call.risk)}`}>{call.risk}</span>
                        <span className={`nd-status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
                        <MiniTracker status={call.status} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="nd-panel-footer">
                <span>
                  Exibindo {visibleCalls.length} de {filteredDashboardCalls.length} chamados.
                </span>

                <button type="button" className="nd-secondary-button" onClick={loadData} disabled={loading}>
                  <RefreshCw size={16} />
                  Atualizar
                </button>
              </div>
            </section>
          </main>

          <aside className="nd-side-column">
            <section className="nd-side-card">
              <div className="nd-side-title">
                <h3>
                  <Bell size={18} />
                  Alertas
                </h3>
              </div>

              <div className="nd-alert-card danger">
                <AlertTriangle size={18} />
                <div>
                  <strong>{delayed.length} chamados em atenção</strong>
                  <small>Verifique os chamados que ainda não avançaram.</small>
                </div>
              </div>

              <div className="nd-alert-card warning">
                <Package size={18} />
                <div>
                  <strong>Equipamentos</strong>
                  <small>Confira os recursos antes de abrir novo chamado.</small>
                </div>
              </div>
            </section>

            <section className="nd-side-card">
              <div className="nd-side-title">
                <h3>
                  <ClipboardCheck size={18} />
                  Recentes
                </h3>
              </div>

              <div className="nd-recent-list">
                {recentCalls.length === 0 && (
                  <div className="nd-empty-small">Nenhum chamado recente.</div>
                )}

                {recentCalls.map((call) => (
                  <button key={call.id} type="button" onClick={() => openCallDetails(call)}>
                    <div>
                      <strong>#{String(call.number).padStart(6, '0')}</strong>
                      <small>{call.patient_code || 'Paciente não informado'}</small>
                    </div>

                    <span className={`nd-status-pill ${statusClass(call.status)}`}>
                      {statusLabel(call.status)}
                    </span>
                  </button>
                ))}
              </div>

              <button type="button" className="nd-full-button" onClick={goToCalls}>
                <Menu size={17} />
                Ver chamados
              </button>
            </section>

            <section className="nd-side-card">
              <div className="nd-side-title">
                <h3>Ações rápidas</h3>
              </div>

              <div className="nd-shortcut-grid">
                <button type="button" onClick={() => setShowEmergencyModal(true)}>
                  <AlertTriangle size={21} />
                  <span>Emergência</span>
                </button>

                <button type="button" onClick={goToNewCall}>
                  <ClipboardPlus size={21} />
                  <span>Novo</span>
                </button>

                <button type="button" onClick={goToCalls}>
                  <ClipboardList size={21} />
                  <span>Chamados</span>
                </button>

                <button type="button">
                  <BarChart3 size={21} />
                  <span>Relatórios</span>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </section>

      {showEmergencyModal && (
        <EmergencyQuickModal
          sectors={sectors}
          onClose={() => setShowEmergencyModal(false)}
          onCreated={loadData}
        />
      )}
    </>
  );
}

function CallDetailPage({
  call,
  onBack,
  onShowList,
}: {
  call: TransportCall;
  onBack: () => void;
  onShowList: () => void;
}) {
  const typedCall = call as any;
  const originName = typedCall.origin_sector?.name ?? typedCall.originSector?.name ?? 'Origem não informada';
  const destinationName =
    typedCall.destination_sector?.name ?? typedCall.destinationSector?.name ?? 'Destino não informado';
  const bedNumber = typedCall.bed_number ?? typedCall.bedNumber ?? 'Não informado';
  const transportType = typedCall.transport_type ?? typedCall.transportType ?? 'Não informado';
  const createdAt = call.created_at
    ? new Date(call.created_at).toLocaleString('pt-BR')
    : 'Não informado';
  const completedAt = typedCall.completed_at
    ? new Date(typedCall.completed_at).toLocaleString('pt-BR')
    : null;
  const observation = typedCall.observation ?? typedCall.notes ?? '';

  return (
    <section className="nd-detail-page">
      <div className="nd-detail-hero">
        <div>
          <span className="nd-page-kicker">Detalhes do chamado</span>
          <h2>Chamado #{String(call.number).padStart(6, '0')}</h2>
          <p>
            Veja as informações principais do transporte selecionado, sem precisar procurar de novo
            na lista geral.
          </p>
        </div>

        <div className="nd-detail-actions">
          <button type="button" className="nd-secondary-button" onClick={onBack}>
            Voltar ao dashboard
          </button>

          <button type="button" className="nd-primary-button" onClick={onShowList}>
            <ClipboardList size={16} />
            Ver lista
          </button>
        </div>
      </div>

      <div className="nd-detail-grid">
        <article className="nd-detail-card nd-detail-main-card">
          <div className="nd-detail-card-title">
            <ClipboardCheck size={20} />
            <h3>Informações do paciente</h3>
          </div>

          <div className="nd-detail-info-grid">
            <div>
              <small>Paciente</small>
              <strong>{call.patient_code || 'Paciente não informado'}</strong>
            </div>

            <div>
              <small>Leito</small>
              <strong>{bedNumber}</strong>
            </div>

            <div>
              <small>Transporte</small>
              <strong>{String(transportType).replace(/_/g, ' ')}</strong>
            </div>

            <div>
              <small>Criado em</small>
              <strong>{createdAt}</strong>
            </div>
          </div>
        </article>

        <article className="nd-detail-card">
          <div className="nd-detail-card-title">
            <ShieldCheck size={20} />
            <h3>Status operacional</h3>
          </div>

          <div className="nd-detail-status-stack">
            <span className={`nd-status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
            <span className={`nd-pill ${priorityClass(call.priority)}`}>Prioridade {call.priority}</span>
            <span className={`nd-pill ${riskClass(call.risk)}`}>Risco {call.risk}</span>
          </div>

          <MiniTracker status={call.status} />

          {completedAt && (
            <p className="nd-detail-helper">
              Concluído em: <strong>{completedAt}</strong>
            </p>
          )}
        </article>

        <article className="nd-detail-card nd-detail-route-card">
          <div className="nd-detail-card-title">
            <Route size={20} />
            <h3>Rota do transporte</h3>
          </div>

          <div className="nd-detail-route">
            <div>
              <small>Origem</small>
              <strong>{originName}</strong>
            </div>

            <ArrowRight size={20} />

            <div>
              <small>Destino</small>
              <strong>{destinationName}</strong>
            </div>
          </div>
        </article>

        <article className="nd-detail-card">
          <div className="nd-detail-card-title">
            <FileClock size={20} />
            <h3>Observações</h3>
          </div>

          <p className="nd-detail-observation">
            {observation?.trim() || 'Nenhuma observação registrada para este chamado.'}
          </p>
        </article>
      </div>
    </section>
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
    <div className="nd-profile-grid">
      <section className="nd-profile-hero">
        <div className="nd-profile-avatar">
          {(profile as any).avatar_url ? (
            <img src={(profile as any).avatar_url} alt="Foto de perfil" />
          ) : (
            initials
          )}
        </div>

        <div>
          <span>Enfermagem</span>
          <h2>{profile.full_name || 'Enfermeira'}</h2>
          <p>Dados do perfil operacional vinculado ao painel da enfermagem.</p>
        </div>
      </section>

      <section className="nd-profile-card">
        <h3>Informações principais</h3>

        <div className="nd-profile-list">
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

      <section className="nd-profile-card">
        <h3>Status do acesso</h3>

        <div className="nd-profile-status">
          <span className={profile.active ? 'ok' : 'muted'} />

          <div>
            <strong>{profile.active ? 'Perfil ativo' : 'Perfil inativo'}</strong>
            <small>{profile.role}</small>
          </div>
        </div>

        <p>Para alterar e-mail, telefone ou foto, atualize os dados do usuário na tabela profiles.</p>
      </section>
    </div>
  );
}

export function NursingDashboard({ profile, onLogout }: NursingDashboardProps) {
  const [activePage, setActivePage] = useState<NursingPage>('dashboard');
  const [selectedCall, setSelectedCall] = useState<TransportCall | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [calls, setCalls] = useState<TransportCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePageTitle = useMemo(() => {
    if (activePage === 'dashboard') return 'Dashboard';
    if (activePage === 'calls') return 'Chamados';
    if (activePage === 'profile') return 'Perfil';
    if (activePage === 'call-detail') return 'Detalhes do chamado';
    return 'Novo Chamado';
  }, [activePage]);

  const isDarkMode = theme === 'dark';
  const selectedCallToShow = selectedCall
    ? calls.find((call) => call.id === selectedCall.id) ?? selectedCall
    : null;

  function openCallDetails(call: TransportCall) {
    setSelectedCall(call);
    setActivePage('call-detail');
  }

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
    <>
      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .nd-shell {
            --nd-bg: #f3f8fb;
            --nd-surface: #ffffff;
            --nd-surface-soft: #f8fbff;
            --nd-sidebar: #ffffff;
            --nd-text: #102033;
            --nd-title: #062b58;
            --nd-muted: #64748b;
            --nd-border: #dce8ef;
            --nd-border-soft: #e8f1f6;
            --nd-accent: #14c9cc;
            --nd-blue: #0077d9;
            --nd-shadow: 0 18px 48px rgba(6, 43, 88, 0.1);
            --nd-soft-shadow: 0 10px 24px rgba(6, 43, 88, 0.07);
            --nd-input: #ffffff;
            --nd-danger: #dc2626;
            --nd-warning: #d97706;
            --nd-success: #059669;
            --nd-info: #0284c7;

            min-height: 100vh;
            display: grid;
            grid-template-columns: 292px minmax(0, 1fr);
            background: var(--nd-bg);
            color: var(--nd-text);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            transition: grid-template-columns 0.22s ease;
          }

          .nd-shell--collapsed {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .nd-shell--dark {
            --nd-bg: #07111f;
            --nd-surface: #101d2d;
            --nd-surface-soft: #142437;
            --nd-sidebar: #0d1928;
            --nd-text: #e8f2ff;
            --nd-title: #f8fbff;
            --nd-muted: #a8bdd4;
            --nd-border: #22364d;
            --nd-border-soft: #1c3047;
            --nd-accent: #22d3ee;
            --nd-blue: #38bdf8;
            --nd-shadow: 0 18px 52px rgba(0, 0, 0, 0.28);
            --nd-soft-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
            --nd-input: #0b1725;
          }

          .nd-sidebar {
            position: sticky;
            top: 0;
            height: 100vh;
            padding: 22px 16px;
            background: var(--nd-sidebar);
            border-right: 1px solid var(--nd-border);
            display: flex;
            flex-direction: column;
            gap: 18px;
            overflow-y: auto;
            overflow-x: hidden;
            z-index: 20;
            transition: padding 0.22s ease;
          }

          .nd-shell--collapsed .nd-sidebar {
            padding: 22px 12px;
          }

          .nd-sidebar-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--nd-border-soft);
          }

          .nd-sidebar-toggle {
            min-width: 42px;
            height: 42px;
            border: 1px solid var(--nd-border);
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--nd-surface);
            color: var(--nd-title);
            cursor: pointer;
            box-shadow: var(--nd-soft-shadow);
            transition: 0.2s ease;
            flex: 0 0 auto;
            padding: 0 12px;
            font-size: 12px;
            font-weight: 900;
          }

          .nd-sidebar-toggle-text {
            line-height: 1;
          }

          .nd-sidebar-toggle:hover {
            transform: translateY(-1px);
            color: var(--nd-accent);
          }

          .nd-shell--collapsed .nd-sidebar-top {
            justify-content: center;
          }

          .nd-shell--collapsed .nd-sidebar-toggle {
            width: 44px;
            height: 44px;
            min-width: 44px;
            padding: 0;
          }

          .nd-shell--collapsed .nd-sidebar-toggle-text {
            display: none;
          }

          .nd-brand-logo {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            width: 100%;
            min-width: 0;
            padding: 6px 2px;
          }

          .nd-brand-logo-img {
            display: block;
            width: 168px;
            max-width: 100%;
            height: auto;
            object-fit: contain;
          }

          .nd-shell--collapsed .nd-brand-logo {
            display: none;
          }

          .nd-logo-mark {
            position: relative;
            width: 42px;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 15px;
            background: linear-gradient(135deg, var(--nd-blue), var(--nd-accent));
            box-shadow: 0 12px 26px rgba(0, 119, 217, 0.18);
          }

          .nd-logo-mark span:first-child {
            position: absolute;
            width: 22px;
            height: 7px;
            border-radius: 999px;
            background: #ffffff;
          }

          .nd-logo-mark span:last-child {
            position: absolute;
            width: 7px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
          }

          .nd-brand-logo strong {
            color: var(--nd-title);
            font-size: 22px;
            letter-spacing: -0.05em;
          }

          .nd-brand-logo strong span {
            color: var(--nd-accent);
          }

          .nd-sidebar-nav {
            display: grid;
            gap: 8px;
          }

          .nd-sidebar-nav button,
          .nd-mobile-tabs button {
            border: 0;
            cursor: pointer;
            font: inherit;
          }

          .nd-sidebar-nav button {
            width: 100%;
            min-height: 48px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            border-radius: 16px;
            background: transparent;
            color: var(--nd-muted);
            font-size: 14px;
            font-weight: 800;
            text-align: left;
            transition: 0.2s ease;
            white-space: nowrap;
          }

          .nd-sidebar-nav button svg {
            width: 20px;
            min-width: 20px;
            flex: 0 0 20px;
          }

          .nd-nav-label {
            display: block;
            min-width: 0;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left;
          }

          .nd-shell--collapsed .nd-sidebar-nav button {
            justify-content: center;
            padding: 0;
            width: 52px;
            height: 52px;
            margin: 0 auto;
            border-radius: 18px;
          }

          .nd-shell--collapsed .nd-nav-label {
            display: none;
          }

          .nd-sidebar-nav button:hover,
          .nd-sidebar-nav button.active {
            background: linear-gradient(135deg, rgba(0, 119, 217, 0.11), rgba(20, 201, 204, 0.12));
            color: var(--nd-title);
          }

          .nd-sidebar-nav button.active {
            box-shadow: inset 3px 0 0 var(--nd-accent);
          }

          .nd-sidebar-footer {
            margin-top: auto;
            padding: 18px;
            border-radius: 22px;
            background: linear-gradient(135deg, rgba(0, 119, 217, 0.1), rgba(20, 201, 204, 0.13));
            border: 1px solid var(--nd-border);
            color: var(--nd-title);
            transition: padding 0.22s ease;
          }

          .nd-shell--collapsed .nd-sidebar-footer {
            padding: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            gap: 10px;
          }

          .nd-sidebar-footer svg {
            color: var(--nd-accent);
            margin-bottom: 10px;
          }

          .nd-sidebar-footer strong {
            display: block;
            margin-bottom: 14px;
            font-size: 14px;
            line-height: 1.45;
          }

          .nd-shell--collapsed .nd-sidebar-footer strong {
            display: none;
          }

          .nd-shell--collapsed .nd-sidebar-footer svg {
            margin: 0;
          }

          .nd-logout-button {
            width: 100%;
            min-height: 42px;
            border: 1px solid var(--nd-border);
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--nd-surface);
            color: var(--nd-title);
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
          }

          .nd-shell--collapsed .nd-sidebar-footer .nd-logout-button {
            width: 48px;
            height: 48px;
            padding: 0;
            border-radius: 17px;
          }

          .nd-shell--collapsed .nd-logout-text {
            display: none;
          }

          .nd-content {
            min-width: 0;
            width: 100%;
            max-width: 1600px;
            margin: 0 auto;
            padding: 24px clamp(22px, 2.2vw, 38px);
          }

          .nd-mobile-brand,
          .nd-mobile-tabs {
            display: none;
          }

          .nd-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 22px;
          }

          .nd-topbar-left {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .nd-desktop-menu-button {
            height: 44px;
            padding: 0 13px;
            border: 1px solid var(--nd-border);
            border-radius: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--nd-surface);
            color: var(--nd-title);
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: var(--nd-soft-shadow);
            white-space: nowrap;
          }

          .nd-desktop-menu-button:hover {
            color: var(--nd-accent);
            transform: translateY(-1px);
          }

          .nd-topbar-title {
            min-width: 0;
          }

          .nd-page-kicker,
          .nd-section-label {
            display: inline-flex;
            margin-bottom: 6px;
            color: var(--nd-blue);
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .nd-topbar h1 {
            margin: 0;
            color: var(--nd-title);
            font-size: clamp(28px, 4vw, 40px);
            line-height: 1;
            letter-spacing: -0.035em;
          }

          .nd-topbar-right {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .nd-icon-button,
          .nd-bell-button,
          .nd-theme-button {
            width: 44px;
            height: 44px;
            border: 1px solid var(--nd-border);
            border-radius: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--nd-surface);
            color: var(--nd-title);
            cursor: pointer;
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-bell-button {
            position: relative;
          }

          .nd-bell-button span {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #ef4444;
            border: 2px solid var(--nd-surface);
          }

          .spinning svg {
            animation: ndSpin 0.9s linear infinite;
          }

          @keyframes ndSpin {
            to {
              transform: rotate(360deg);
            }
          }

          .nd-user-card {
            min-width: 230px;
            min-height: 54px;
            padding: 7px 12px 7px 7px;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid var(--nd-border);
            border-radius: 18px;
            background: var(--nd-surface);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: linear-gradient(135deg, var(--nd-blue), var(--nd-accent));
            color: white;
            font-weight: 900;
          }

          .nd-user-card strong {
            display: block;
            color: var(--nd-title);
            font-size: 13px;
            line-height: 1.25;
          }

          .nd-user-card small {
            display: block;
            color: var(--nd-muted);
            font-size: 12px;
            line-height: 1.25;
          }

          .nd-dashboard-page {
            display: grid;
            gap: 18px;
          }

          .nd-welcome-card {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 20px;
            padding: 24px;
            border: 1px solid var(--nd-border);
            border-radius: 28px;
            background: var(--nd-surface);
            box-shadow: var(--nd-shadow);
          }

          .nd-welcome-icon {
            width: 68px;
            height: 68px;
            border-radius: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: linear-gradient(135deg, rgba(0, 119, 217, 0.13), rgba(20, 201, 204, 0.16));
            color: var(--nd-blue);
          }

          .nd-welcome-text span {
            color: var(--nd-blue);
            font-size: 13px;
            font-weight: 900;
          }

          .nd-welcome-text h2 {
            margin: 5px 0 7px;
            color: var(--nd-title);
            font-size: clamp(24px, 3vw, 34px);
            line-height: 1.05;
            letter-spacing: -0.035em;
          }

          .nd-welcome-text p {
            max-width: 760px;
            margin: 0;
            color: var(--nd-muted);
            font-size: 14px;
            line-height: 1.6;
          }

          .nd-welcome-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .nd-primary-button,
          .nd-danger-outline-button,
          .nd-secondary-button,
          .nd-danger-button,
          .nd-full-button {
            min-height: 44px;
            padding: 0 15px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font: inherit;
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
            transition: 0.2s ease;
          }

          .nd-primary-button {
            border: 0;
            background: linear-gradient(135deg, #062b58, #0077d9, #14c9cc);
            color: #ffffff;
            box-shadow: 0 16px 28px rgba(0, 119, 217, 0.18);
          }

          .nd-secondary-button {
            border: 1px solid var(--nd-border);
            background: var(--nd-surface);
            color: var(--nd-title);
          }

          .nd-danger-button {
            border: 0;
            background: linear-gradient(135deg, #991b1b, #dc2626);
            color: #ffffff;
          }

          .nd-danger-outline-button {
            border: 1px solid rgba(220, 38, 38, 0.24);
            background: rgba(220, 38, 38, 0.08);
            color: var(--nd-danger);
          }

          .nd-primary-button:hover,
          .nd-secondary-button:hover,
          .nd-danger-button:hover,
          .nd-danger-outline-button:hover,
          .nd-full-button:hover {
            transform: translateY(-1px);
          }

          .nd-metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(210px, 1fr));
            gap: 14px;
          }

          .nd-metric-card {
            min-width: 0;
            padding: 18px;
            border: 1px solid var(--nd-border);
            border-radius: 24px;
            display: flex;
            align-items: center;
            gap: 14px;
            background: var(--nd-surface);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-metric-icon {
            width: 54px;
            height: 54px;
            flex: 0 0 auto;
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .nd-metric-icon.blue {
            background: rgba(0, 119, 217, 0.12);
            color: var(--nd-blue);
          }

          .nd-metric-icon.amber {
            background: rgba(217, 119, 6, 0.13);
            color: var(--nd-warning);
          }

          .nd-metric-icon.green {
            background: rgba(5, 150, 105, 0.13);
            color: var(--nd-success);
          }

          .nd-metric-icon.red {
            background: rgba(220, 38, 38, 0.12);
            color: var(--nd-danger);
          }

          .nd-metric-content {
            min-width: 0;
          }

          .nd-metric-content span {
            display: block;
            color: var(--nd-muted);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .nd-metric-content strong {
            display: block;
            margin: 3px 0;
            color: var(--nd-title);
            font-size: 28px;
            line-height: 1;
            letter-spacing: -0.04em;
          }

          .nd-metric-content small {
            display: block;
            color: var(--nd-muted);
            font-size: 12px;
            line-height: 1.35;
          }

          .nd-main-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 330px;
            gap: 18px;
            align-items: start;
          }

          @media (min-width: 1440px) {
            .nd-main-grid {
              grid-template-columns: minmax(0, 1fr) 360px;
            }

            .nd-call-main {
              grid-template-columns: 140px minmax(190px, 0.85fr) minmax(420px, 1.8fr);
            }

            .nd-call-meta {
              padding-left: 154px;
            }
          }

          .nd-panel,
          .nd-side-card,
          .nd-profile-card,
          .nd-profile-hero {
            border: 1px solid var(--nd-border);
            border-radius: 26px;
            background: var(--nd-surface);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-panel {
            padding: 20px;
          }

          .nd-panel-header,
          .nd-panel-footer,
          .nd-side-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .nd-panel-header h3,
          .nd-side-title h3,
          .nd-profile-card h3 {
            margin: 0;
            color: var(--nd-title);
            font-size: 20px;
            letter-spacing: -0.03em;
          }

          .nd-side-title h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 17px;
          }

          .nd-toolbar {
            margin: 16px 0;
            display: grid;
            gap: 12px;
          }

          .nd-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .nd-tabs button {
            min-height: 38px;
            padding: 0 12px;
            border: 1px solid var(--nd-border);
            border-radius: 999px;
            background: var(--nd-surface-soft);
            color: var(--nd-muted);
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
          }

          .nd-tabs button.active {
            background: linear-gradient(135deg, rgba(0, 119, 217, 0.13), rgba(20, 201, 204, 0.15));
            color: var(--nd-title);
            border-color: rgba(20, 201, 204, 0.34);
          }

          .nd-tabs button span {
            display: inline-grid;
            place-items: center;
            min-width: 22px;
            height: 22px;
            margin-left: 5px;
            padding: 0 6px;
            border-radius: 999px;
            background: var(--nd-surface);
            color: var(--nd-title);
          }

          .nd-search-box {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
          }

          .nd-search-box input,
          .nd-emergency-grid input,
          .nd-emergency-grid select {
            width: 100%;
            min-height: 44px;
            padding: 0 13px;
            border: 1px solid var(--nd-border);
            border-radius: 14px;
            outline: 0;
            background: var(--nd-input);
            color: var(--nd-text);
            font: inherit;
            font-size: 14px;
          }

          .nd-search-box input:focus,
          .nd-emergency-grid input:focus,
          .nd-emergency-grid select:focus {
            border-color: var(--nd-accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.13);
          }

          .nd-call-list {
            display: grid;
            gap: 10px;
          }

          .nd-call-card {
            width: 100%;
            padding: 16px;
            border: 1px solid var(--nd-border-soft);
            border-radius: 20px;
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
            align-items: stretch;
            background: var(--nd-surface-soft);
            color: var(--nd-text);
            font: inherit;
            cursor: pointer;
            text-align: left;
            transition: 0.2s ease;
          }

          .nd-call-card:hover {
            transform: translateY(-1px);
            border-color: rgba(20, 201, 204, 0.35);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-call-main {
            display: grid;
            grid-template-columns: 128px minmax(170px, 0.85fr) minmax(360px, 1.6fr);
            gap: 14px;
            min-width: 0;
            align-items: stretch;
          }

          .nd-call-number,
          .nd-call-patient,
          .nd-call-route div {
            min-width: 0;
            padding: 10px 12px;
            border-radius: 15px;
            background: var(--nd-surface);
            border: 1px solid var(--nd-border-soft);
          }

          .nd-call-card small {
            display: block;
            margin-bottom: 5px;
            color: var(--nd-muted);
            font-size: 10.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .nd-call-card strong {
            display: block;
            color: var(--nd-title);
            font-size: 13.5px;
            line-height: 1.35;
            word-break: normal;
            overflow-wrap: anywhere;
          }

          .nd-call-number strong {
            font-size: 15px;
            letter-spacing: -0.02em;
          }

          .nd-call-route {
            min-width: 0;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr);
            align-items: stretch;
            gap: 8px;
          }

          .nd-call-route svg {
            align-self: center;
            justify-self: center;
            color: var(--nd-accent);
          }

          .nd-call-meta {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            flex-wrap: wrap;
            padding-left: 142px;
          }

          .nd-pill,
          .nd-status-pill {
            min-height: 28px;
            padding: 0 9px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .nd-pill.success,
          .nd-status-pill.success {
            background: rgba(5, 150, 105, 0.12);
            color: var(--nd-success);
          }

          .nd-pill.warning,
          .nd-status-pill.warning {
            background: rgba(217, 119, 6, 0.13);
            color: var(--nd-warning);
          }

          .nd-pill.danger,
          .nd-status-pill.danger {
            background: rgba(220, 38, 38, 0.12);
            color: var(--nd-danger);
          }

          .nd-pill.neutral,
          .nd-status-pill.neutral,
          .nd-status-pill.muted {
            background: rgba(100, 116, 139, 0.12);
            color: var(--nd-muted);
          }

          .nd-status-pill.info {
            background: rgba(2, 132, 199, 0.12);
            color: var(--nd-info);
          }

          .nd-mini-tracker {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 64px;
          }

          .nd-mini-tracker span {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: var(--nd-border);
          }

          .nd-mini-tracker span.done {
            background: var(--nd-accent);
          }

          .nd-panel-footer {
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid var(--nd-border-soft);
            color: var(--nd-muted);
            font-size: 13px;
          }

          .nd-side-column {
            display: grid;
            gap: 14px;
          }

          .nd-side-card {
            padding: 18px;
          }

          .nd-alert-card {
            margin-top: 12px;
            padding: 14px;
            border-radius: 18px;
            display: flex;
            align-items: flex-start;
            gap: 11px;
            border: 1px solid var(--nd-border-soft);
            background: var(--nd-surface-soft);
          }

          .nd-alert-card.danger svg {
            color: var(--nd-danger);
          }

          .nd-alert-card.warning svg {
            color: var(--nd-warning);
          }

          .nd-alert-card strong {
            display: block;
            color: var(--nd-title);
            font-size: 13px;
            line-height: 1.35;
          }

          .nd-alert-card small {
            display: block;
            margin-top: 2px;
            color: var(--nd-muted);
            font-size: 12px;
            line-height: 1.4;
          }

          .nd-recent-list {
            display: grid;
            gap: 9px;
            margin-top: 12px;
          }

          .nd-recent-list button {
            width: 100%;
            min-height: 60px;
            padding: 11px;
            border: 1px solid var(--nd-border-soft);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: var(--nd-surface-soft);
            color: var(--nd-text);
            text-align: left;
            cursor: pointer;
          }

          .nd-recent-list strong {
            display: block;
            color: var(--nd-title);
            font-size: 13px;
          }

          .nd-recent-list small {
            display: block;
            color: var(--nd-muted);
            font-size: 12px;
          }

          .nd-full-button {
            width: 100%;
            margin-top: 12px;
            border: 1px solid var(--nd-border);
            background: var(--nd-surface-soft);
            color: var(--nd-title);
          }

          .nd-shortcut-grid {
            margin-top: 12px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .nd-shortcut-grid button {
            min-height: 82px;
            padding: 12px;
            border: 1px solid var(--nd-border-soft);
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            gap: 6px;
            background: var(--nd-surface-soft);
            color: var(--nd-title);
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
          }

          .nd-shortcut-grid svg {
            color: var(--nd-accent);
          }

          .nd-empty-state,
          .nd-empty-small {
            padding: 24px;
            border: 1px dashed var(--nd-border);
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            gap: 6px;
            text-align: center;
            color: var(--nd-muted);
            background: var(--nd-surface-soft);
          }

          .nd-empty-state strong {
            color: var(--nd-title);
          }

          .nd-error {
            margin-bottom: 16px;
            padding: 14px 16px;
            border-radius: 16px;
            border: 1px solid rgba(220, 38, 38, 0.22);
            background: rgba(220, 38, 38, 0.08);
            color: var(--nd-danger);
            font-size: 14px;
            font-weight: 800;
          }

          .nd-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 22px;
            background: rgba(2, 6, 23, 0.48);
            backdrop-filter: blur(10px);
          }

          .nd-modal {
            width: min(660px, 100%);
            max-height: calc(100vh - 42px);
            overflow: auto;
            padding: 26px;
            border-radius: 26px;
            border: 1px solid var(--nd-border);
            background: var(--nd-surface);
            box-shadow: 0 32px 90px rgba(0, 0, 0, 0.25);
            position: relative;
          }

          .nd-modal-close {
            position: absolute;
            right: 17px;
            top: 17px;
            width: 38px;
            height: 38px;
            border: 1px solid var(--nd-border);
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--nd-surface-soft);
            color: var(--nd-title);
            cursor: pointer;
          }

          .nd-modal-head span {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(220, 38, 38, 0.1);
            color: var(--nd-danger);
            font-size: 12px;
            font-weight: 900;
          }

          .nd-modal-head h2 {
            margin: 14px 0 8px;
            color: var(--nd-title);
            font-size: 28px;
            letter-spacing: -0.04em;
          }

          .nd-modal-head p {
            margin: 0 0 18px;
            color: var(--nd-muted);
            line-height: 1.6;
          }

          .nd-emergency-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px;
          }

          .nd-emergency-grid label {
            display: grid;
            gap: 7px;
          }

          .nd-emergency-grid span {
            color: var(--nd-title);
            font-size: 13px;
            font-weight: 900;
          }

          .nd-emergency-fixed {
            margin: 15px 0;
            display: flex;
            gap: 9px;
            flex-wrap: wrap;
          }

          .nd-emergency-fixed span {
            padding: 9px 11px;
            border-radius: 999px;
            background: rgba(220, 38, 38, 0.08);
            color: var(--nd-muted);
            font-size: 12px;
            font-weight: 800;
          }

          .nd-emergency-fixed strong {
            color: var(--nd-danger);
          }

          .nd-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
          }

          .nd-profile-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
            gap: 16px;
          }

          .nd-profile-hero {
            grid-column: 1 / -1;
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .nd-profile-avatar {
            width: 82px;
            height: 82px;
            border-radius: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            overflow: hidden;
            background: linear-gradient(135deg, var(--nd-blue), var(--nd-accent));
            color: white;
            font-size: 25px;
            font-weight: 900;
          }

          .nd-profile-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .nd-profile-hero span {
            display: inline-flex;
            margin-bottom: 5px;
            color: var(--nd-blue);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .nd-profile-hero h2 {
            margin: 0 0 6px;
            color: var(--nd-title);
            font-size: 32px;
            letter-spacing: -0.04em;
          }

          .nd-profile-hero p,
          .nd-profile-card p {
            margin: 0;
            color: var(--nd-muted);
            line-height: 1.6;
          }

          .nd-profile-card {
            padding: 22px;
          }

          .nd-profile-list {
            display: grid;
            gap: 10px;
            margin-top: 14px;
          }

          .nd-profile-list div {
            padding: 14px;
            border-radius: 16px;
            border: 1px solid var(--nd-border-soft);
            background: var(--nd-surface-soft);
          }

          .nd-profile-list small {
            display: block;
            color: var(--nd-muted);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .nd-profile-list strong {
            display: block;
            margin-top: 3px;
            color: var(--nd-title);
            word-break: break-word;
          }

          .nd-profile-status {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 14px 0;
            padding: 14px;
            border-radius: 16px;
            background: var(--nd-surface-soft);
            border: 1px solid var(--nd-border-soft);
          }

          .nd-profile-status > span {
            width: 13px;
            height: 13px;
            border-radius: 999px;
          }

          .nd-profile-status > span.ok {
            background: var(--nd-success);
          }

          .nd-profile-status > span.muted {
            background: var(--nd-muted);
          }

          .nd-profile-status strong {
            display: block;
            color: var(--nd-title);
          }

          .nd-profile-status small {
            color: var(--nd-muted);
          }


          .nd-detail-page {
            display: grid;
            gap: 16px;
          }

          .nd-detail-hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 24px;
            border: 1px solid var(--nd-border);
            border-radius: 26px;
            background: var(--nd-surface);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-detail-hero h2 {
            margin: 0 0 8px;
            color: var(--nd-title);
            font-size: clamp(28px, 4vw, 42px);
            line-height: 1;
            letter-spacing: -0.045em;
          }

          .nd-detail-hero p {
            max-width: 680px;
            margin: 0;
            color: var(--nd-muted);
            font-size: 14px;
            line-height: 1.6;
          }

          .nd-detail-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
          }

          .nd-detail-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
            gap: 16px;
            align-items: stretch;
          }

          .nd-detail-card {
            padding: 22px;
            border: 1px solid var(--nd-border);
            border-radius: 24px;
            background: var(--nd-surface);
            box-shadow: var(--nd-soft-shadow);
          }

          .nd-detail-main-card,
          .nd-detail-route-card {
            grid-column: span 1;
          }

          .nd-detail-card-title {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 16px;
            color: var(--nd-accent);
          }

          .nd-detail-card-title h3 {
            margin: 0;
            color: var(--nd-title);
            font-size: 18px;
            letter-spacing: -0.03em;
          }

          .nd-detail-info-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .nd-detail-info-grid div,
          .nd-detail-route div {
            min-width: 0;
            padding: 14px;
            border: 1px solid var(--nd-border-soft);
            border-radius: 17px;
            background: var(--nd-surface-soft);
          }

          .nd-detail-info-grid small,
          .nd-detail-route small {
            display: block;
            margin-bottom: 5px;
            color: var(--nd-muted);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .nd-detail-info-grid strong,
          .nd-detail-route strong {
            display: block;
            color: var(--nd-title);
            font-size: 15px;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .nd-detail-status-stack {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 14px;
          }

          .nd-detail-helper {
            margin: 14px 0 0;
            color: var(--nd-muted);
            font-size: 13px;
            line-height: 1.5;
          }

          .nd-detail-helper strong {
            color: var(--nd-title);
          }

          .nd-detail-route {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
            gap: 10px;
            align-items: stretch;
          }

          .nd-detail-route > svg {
            align-self: center;
            justify-self: center;
            color: var(--nd-accent);
          }

          .nd-detail-observation {
            margin: 0;
            color: var(--nd-muted);
            line-height: 1.65;
          }

          @media (max-width: 1320px) {
            .nd-desktop-menu-button {
              padding: 0 12px;
            }

            .nd-desktop-menu-button {
              font-size: 0;
            }

            .nd-desktop-menu-button svg {
              margin: 0;
            }
          }

          @media (max-width: 1180px) {
            .nd-shell {
              grid-template-columns: 260px minmax(0, 1fr);
            }

            .nd-shell--collapsed {
              grid-template-columns: 88px minmax(0, 1fr);
            }

            .nd-main-grid {
              grid-template-columns: 1fr;
            }

            .nd-side-column {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .nd-metrics-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 920px) {
            .nd-shell {
              display: block;
            }

            .nd-sidebar {
              display: none;
            }

            .nd-content {
              padding: 16px;
            }

            .nd-mobile-brand {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 12px;
              padding: 12px;
              border: 1px solid var(--nd-border);
              border-radius: 20px;
              background: var(--nd-surface);
              box-shadow: var(--nd-soft-shadow);
            }

            .nd-mobile-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .nd-mobile-tabs {
              display: flex;
              gap: 8px;
              overflow-x: auto;
              padding: 0 0 12px;
              margin-bottom: 12px;
            }

            .nd-mobile-tabs button {
              min-height: 42px;
              padding: 0 13px;
              border-radius: 999px;
              display: inline-flex;
              align-items: center;
              gap: 7px;
              white-space: nowrap;
              background: var(--nd-surface);
              border: 1px solid var(--nd-border);
              color: var(--nd-muted);
              font-weight: 900;
            }

            .nd-mobile-tabs button.active {
              color: var(--nd-title);
              border-color: rgba(20, 201, 204, 0.4);
              background: rgba(20, 201, 204, 0.12);
            }

            .nd-topbar {
              align-items: flex-start;
              flex-direction: column;
            }

            .nd-desktop-menu-button {
              display: none;
            }

            .nd-topbar-left {
              width: 100%;
            }

            .nd-topbar-right {
              width: 100%;
              justify-content: space-between;
              flex-wrap: wrap;
            }

            .nd-user-card {
              min-width: 0;
              flex: 1;
            }

            .nd-welcome-card {
              grid-template-columns: 1fr;
              align-items: start;
            }

            .nd-welcome-actions {
              justify-content: flex-start;
            }

            .nd-call-card {
              grid-template-columns: 1fr;
            }

            .nd-call-main {
              grid-template-columns: 1fr;
            }

            .nd-call-meta {
              justify-content: flex-start;
              padding-left: 0;
            }

            .nd-side-column {
              grid-template-columns: 1fr;
            }

            .nd-profile-grid,
            .nd-detail-grid {
              grid-template-columns: 1fr;
            }

            .nd-detail-hero {
              flex-direction: column;
            }

            .nd-detail-actions {
              justify-content: flex-start;
            }
          }

          @media (max-width: 620px) {
            .nd-mobile-brand .nd-brand-logo-img {
              width: 142px;
            }

            .nd-content {
              padding: 12px;
            }

            .nd-welcome-card,
            .nd-panel,
            .nd-side-card,
            .nd-profile-card,
            .nd-profile-hero {
              border-radius: 20px;
            }

            .nd-welcome-card,
            .nd-panel,
            .nd-side-card {
              padding: 16px;
            }

            .nd-metrics-grid,
            .nd-emergency-grid {
              grid-template-columns: 1fr;
            }

            .nd-search-box {
              grid-template-columns: 1fr;
            }

            .nd-panel-header,
            .nd-panel-footer {
              align-items: flex-start;
              flex-direction: column;
            }

            .nd-welcome-actions,
            .nd-welcome-actions button,
            .nd-modal-actions,
            .nd-modal-actions button {
              width: 100%;
            }

            .nd-call-route {
              grid-template-columns: 1fr;
            }

            .nd-call-number,
            .nd-call-patient,
            .nd-call-route div {
              padding: 11px 12px;
            }

            .nd-call-route > svg {
              transform: rotate(90deg);
            }

            .nd-modal {
              padding: 22px 16px;
              border-radius: 22px;
            }

            .nd-profile-hero {
              flex-direction: column;
              align-items: flex-start;
            }

            .nd-detail-info-grid,
            .nd-detail-route {
              grid-template-columns: 1fr;
            }

            .nd-detail-route > svg {
              transform: rotate(90deg);
            }

            .nd-detail-actions,
            .nd-detail-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <div className={`nd-shell nd-shell--${theme}${sidebarCollapsed ? ' nd-shell--collapsed' : ''}`}>
        <aside className="nd-sidebar">
          <div className="nd-sidebar-top">
            <BrandLogo />

            <button
              type="button"
              className="nd-sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              <Menu size={19} />
              <span className="nd-sidebar-toggle-text">
                {sidebarCollapsed ? 'Abrir' : 'Recolher'}
              </span>
            </button>
          </div>

          <nav className="nd-sidebar-nav">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.page === activePage || (activePage === 'call-detail' && item.page === 'calls')
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  if (!item.page) return;
                  setSelectedCall(null);
                  setActivePage(item.page);
                }}
                title={item.label}
              >
                {item.icon}
                <span className="nd-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="nd-sidebar-footer">
            <ShieldCheck size={23} />
            <strong>Segurança e qualidade em cada movimento.</strong>

            <button type="button" className="nd-logout-button" onClick={handleLogout} title="Sair do painel">
              <LogOut size={17} />
              <span className="nd-logout-text">Sair do painel</span>
            </button>
          </div>
        </aside>

        <main className="nd-content">
          <div className="nd-mobile-brand">
            <BrandLogo />

            <div className="nd-mobile-actions">
              <button
                type="button"
                className="nd-theme-button"
                onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button type="button" className="nd-logout-button" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>

          <div className="nd-mobile-tabs">
            <button className={activePage === 'dashboard' ? 'active' : ''} onClick={() => { setSelectedCall(null); setActivePage('dashboard'); }}>
              <Home size={18} />
              Dashboard
            </button>

            <button className={activePage === 'calls' || activePage === 'call-detail' ? 'active' : ''} onClick={() => { setSelectedCall(null); setActivePage('calls'); }}>
              <ClipboardList size={18} />
              Chamados
            </button>

            <button className={activePage === 'new-call' ? 'active' : ''} onClick={() => { setSelectedCall(null); setActivePage('new-call'); }}>
              <ClipboardPlus size={18} />
              Novo
            </button>

            <button className={activePage === 'profile' ? 'active' : ''} onClick={() => { setSelectedCall(null); setActivePage('profile'); }}>
              <UsersRound size={18} />
              Perfil
            </button>
          </div>

          {activePage !== 'dashboard' && (
            <header className="nd-topbar">
              <div className="nd-topbar-left">
                <div className="nd-topbar-title">
                  <span className="nd-page-kicker">MoverCare</span>
                  <h1>{activePageTitle}</h1>
                </div>
              </div>

              <div className="nd-topbar-right">
                <button
                  type="button"
                  className="nd-theme-button"
                  onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                  aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {activePage !== 'new-call' && (
                  <button
                    type="button"
                    className="nd-primary-button"
                    onClick={() => {
                      setSelectedCall(null);
                      setActivePage('new-call');
                    }}
                  >
                    <ClipboardPlus size={16} />
                    Novo chamado
                  </button>
                )}

                <button
                  type="button"
                  className="nd-secondary-button"
                  onClick={() => {
                    setSelectedCall(null);
                    setActivePage('dashboard');
                  }}
                >
                  Voltar
                </button>

                <button type="button" className="nd-secondary-button" onClick={loadData} disabled={loading}>
                  <RefreshCw size={16} />
                  Atualizar
                </button>

                <button type="button" className="nd-secondary-button" onClick={handleLogout}>
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            </header>
          )}

          {error && <div className="nd-error">{error}</div>}

          {activePage === 'dashboard' && (
            <DashboardHome
              calls={calls}
              sectors={sectors}
              profile={profile}
              loading={loading}
              loadData={loadData}
              goToNewCall={() => {
                setSelectedCall(null);
                setActivePage('new-call');
              }}
              goToCalls={() => {
                setSelectedCall(null);
                setActivePage('calls');
              }}
              openCallDetails={openCallDetails}
              isDarkMode={isDarkMode}
              toggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            />
          )}

          {activePage === 'new-call' && (
            <section className="nd-page-content">
              <CreateCallScreen
                sectors={sectors}
                onCreated={() => {
                  setSelectedCall(null);
                  setActivePage('dashboard');
                  loadData();
                }}
              />
            </section>
          )}

          {activePage === 'calls' && (
            <section className="nd-page-content">
              <CallsPanel calls={calls} sectors={sectors} loading={loading} onCreated={loadData} />
            </section>
          )}

          {activePage === 'call-detail' && (
            <section className="nd-page-content">
              {selectedCallToShow ? (
                <CallDetailPage
                  call={selectedCallToShow}
                  onBack={() => {
                    setSelectedCall(null);
                    setActivePage('dashboard');
                  }}
                  onShowList={() => {
                    setSelectedCall(null);
                    setActivePage('calls');
                  }}
                />
              ) : (
                <div className="nd-empty-state">
                  <ClipboardList size={26} />
                  <strong>Chamado não encontrado</strong>
                  <span>Volte para a lista e selecione um chamado novamente.</span>
                </div>
              )}
            </section>
          )}

          {activePage === 'profile' && (
            <section className="nd-page-content">
              <NursingProfilePage profile={profile} sectors={sectors} />
            </section>
          )}
        </main>
      </div>
    </>
  );
}
