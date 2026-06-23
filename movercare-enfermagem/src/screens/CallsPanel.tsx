import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardPlus,
  Eye,
  FileText,
  Filter,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Search,
  Send,
  SlidersHorizontal,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import { createTransportCall } from '../services/movercareService';
import type { CallStatus, CreateCallForm, Sector, TransportCall } from '../types/movercare';

interface CallsPanelProps {
  calls: TransportCall[];
  sectors: Sector[];
  loading: boolean;
  onCreated: () => void;
}

type TabFilter = 'TODOS' | 'AGUARDANDO' | 'ACEITOS' | 'EM_TRANSITO' | 'CONCLUIDO';
type StatusFilter = 'TODOS' | CallStatus;
type PriorityFilter = 'TODOS' | 'NORMAL' | 'URGENTE' | 'CRITICO';
type RiskFilter = 'TODOS' | 'BAIXO' | 'MEDIO' | 'ALTO';

const allStatuses: StatusFilter[] = [
  'TODOS',
  'AGUARDANDO_MAQUEIRO',
  'ENVIADO',
  'A_CAMINHO_ORIGEM',
  'EM_TRANSITO',
  'CONCLUIDO',
  'CANCELADO',
  'ATRASADO',
];

const pageSizeOptions = [5, 7, 10, 15, 25];

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
  if (status === 'CANCELADO') return 'muted';
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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function labelTransportType(value?: string | null) {
  const labels: Record<string, string> = {
    MACA: 'Maca',
    CADEIRA_RODAS: 'Cadeira de rodas',
    ACOMPANHAMENTO: 'Acompanhamento',
    OUTRO: 'Outro',
  };
  return value ? labels[value] ?? value : '-';
}

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function callMatchesTab(call: TransportCall, tab: TabFilter) {
  if (tab === 'TODOS') return true;
  if (tab === 'AGUARDANDO') return ['AGUARDANDO_MAQUEIRO', 'ENVIADO', 'ATRASADO'].includes(call.status);
  if (tab === 'ACEITOS') return ['ACEITO', 'A_CAMINHO_ORIGEM'].includes(call.status);
  if (tab === 'EM_TRANSITO') return call.status === 'EM_TRANSITO';
  if (tab === 'CONCLUIDO') return call.status === 'CONCLUIDO';
  return true;
}

function getCounts(calls: TransportCall[]) {
  return {
    todos: calls.length,
    aguardando: calls.filter((call) => callMatchesTab(call, 'AGUARDANDO')).length,
    aceitos: calls.filter((call) => callMatchesTab(call, 'ACEITOS')).length,
    transito: calls.filter((call) => callMatchesTab(call, 'EM_TRANSITO')).length,
    concluidos: calls.filter((call) => callMatchesTab(call, 'CONCLUIDO')).length,
  };
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

function getProgressPercent(status: string) {
  const step = getCallStep(status);
  if (step <= 0) return 4;
  if (step === 1) return 26;
  if (step === 2) return 52;
  if (step === 3) return 76;
  if (step >= 4) return 100;
  return 4;
}

function getTrackingMessage(status: string) {
  const messages: Record<string, string> = {
    ABERTO: 'Chamado registrado. Aguardando distribuição.',
    AGUARDANDO_MAQUEIRO: 'Buscando maqueiro disponível para este transporte.',
    ENVIADO: 'Chamado enviado. Aguardando aceite do maqueiro.',
    ACEITO: 'Maqueiro aceitou o chamado.',
    A_CAMINHO_ORIGEM: 'Maqueiro a caminho da origem.',
    EM_TRANSITO: 'Paciente em trânsito para o destino.',
    CONCLUIDO: 'Transporte concluído no destino.',
    CANCELADO: 'Chamado cancelado.',
    ATRASADO: 'Chamado requer atenção da equipe.',
  };
  return messages[status] ?? statusLabel(status);
}

function sectorName(sectors: Sector[], id?: string | null) {
  if (!id) return '-';
  return sectors.find((sector) => sector.id === id)?.name ?? '-';
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="detail-item">
      <small>{label}</small>
      <strong>{value ?? '-'}</strong>
    </div>
  );
}

function TransportTracker({ call, compact = false }: { call: TransportCall; compact?: boolean }) {
  const step = getCallStep(call.status);
  const progress = getProgressPercent(call.status);
  const cancelled = call.status === 'CANCELADO';

  const steps = [
    { key: 'created', label: 'Solicitado', description: 'Chamado criado', icon: <ClipboardPlus size={compact ? 14 : 18} />, done: step >= 0, active: step === 0 },
    { key: 'sent', label: 'Enviado', description: 'Aguardando aceite', icon: <Send size={compact ? 14 : 18} />, done: step >= 1, active: step === 1 },
    { key: 'origin', label: 'Indo à origem', description: 'Maqueiro em deslocamento', icon: <UserCheck size={compact ? 14 : 18} />, done: step >= 2, active: step === 2 },
    { key: 'transit', label: 'Em trânsito', description: 'Paciente a caminho', icon: <Truck size={compact ? 14 : 18} />, done: step >= 3, active: step === 3 },
    { key: 'done', label: 'No destino', description: 'Transporte finalizado', icon: <CheckCircle2 size={compact ? 14 : 18} />, done: step >= 4, active: step === 4 },
  ];

  return (
    <div className={compact ? 'tracker tracker-compact' : 'tracker'}>
      <div className="tracker-top">
        <div>
          <span className="section-kicker"><Navigation size={14} /> Status do maqueiro</span>
          <h3>{getTrackingMessage(call.status)}</h3>
        </div>
        <span className={`status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
      </div>
      <div className={cancelled ? 'tracker-line cancelled' : 'tracker-line'}>
        <div className="tracker-progress" style={{ width: `${progress}%` }} />
        {!cancelled && step > 0 && step < 4 && (
          <div className="tracker-vehicle" style={{ left: `calc(${progress}% - 18px)` }}>
            {step === 3 ? <Truck size={17} /> : <UserCheck size={17} />}
          </div>
        )}
      </div>
      <div className="tracker-steps">
        {steps.map((item) => (
          <div key={item.key} className={['tracker-step', item.done ? 'done' : '', item.active ? 'active' : '', cancelled ? 'cancelled' : ''].join(' ')}>
            <span className="tracker-dot">{item.icon}</span>
            <strong>{item.label}</strong>
            {!compact && <small>{item.description}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CallDetailsModal({ call, sectors, onClose, onRecallCreated }: { call: TransportCall; sectors: Sector[]; onClose: () => void; onRecallCreated: () => void }) {
  const typedCall = call as any;
  const defaultOrigin = typedCall.destination_sector_id ?? typedCall.destination_sector?.id ?? '';
  const defaultDestination = sectors.find((sector) => sector.id !== defaultOrigin)?.id ?? '';
  const [showRecall, setShowRecall] = useState(false);
  const [recallForm, setRecallForm] = useState({
    originSectorId: defaultOrigin,
    destinationSectorId: defaultDestination,
    priority: call.priority,
    risk: call.risk,
    observation: `Rechamada baseada no chamado #${call.number}.`,
  });
  const [recallLoading, setRecallLoading] = useState(false);
  const [recallSuccess, setRecallSuccess] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);

  async function handleRecall() {
    setRecallLoading(true);
    setRecallError(null);
    try {
      if (!recallForm.originSectorId || !recallForm.destinationSectorId) throw new Error('Informe origem e destino da rechamada.');
      if (recallForm.originSectorId === recallForm.destinationSectorId) throw new Error('Origem e destino da rechamada não podem ser iguais.');

      const newCall: CreateCallForm = {
        patientCode: typedCall.patient_code ?? '',
        originSectorId: recallForm.originSectorId,
        destinationSectorId: recallForm.destinationSectorId,
        transportType: typedCall.transport_type,
        priority: recallForm.priority,
        risk: recallForm.risk,
        destinationCommunicated: true,
        teamConfirmed: true,
        equipmentConfirmed: true,
        infectionPrecaution: typedCall.infection_precaution ?? 'PADRAO',
        observation: recallForm.observation,
      };

      await createTransportCall(newCall);
      setRecallSuccess(true);
      onRecallCreated();
    } catch (err) {
      setRecallError(err instanceof Error ? err.message : 'Erro ao criar rechamada.');
    } finally {
      setRecallLoading(false);
    }
  }

  return (
    <div className="call-modal-backdrop" role="dialog" aria-modal="true">
      <div className="call-modal">
        <button type="button" className="call-modal-close" onClick={onClose} aria-label="Fechar detalhes"><X size={18} /></button>
        <div className="call-modal-header">
          <div>
            <span className="section-kicker"><FileText size={14} /> Detalhes da chamada</span>
            <h2>Chamado #{String(call.number).padStart(6, '0')}</h2>
            <p>Visualize o andamento do maqueiro, detalhes do transporte e histórico mesmo após conclusão.</p>
          </div>
          <span className={`status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
        </div>

        <TransportTracker call={call} />

        <div className="call-route-card">
          <div><small>Origem</small><strong>{typedCall.origin_sector?.name ?? '-'}</strong></div>
          <Route size={22} />
          <div><small>Destino</small><strong>{typedCall.destination_sector?.name ?? '-'}</strong></div>
        </div>

        <div className="details-grid">
          <DetailItem label="Paciente" value={typedCall.patient_code || 'Não informado'} />
          <DetailItem label="Transporte" value={labelTransportType(typedCall.transport_type)} />
          <DetailItem label="Prioridade" value={typedCall.priority} />
          <DetailItem label="Risco" value={typedCall.risk} />
          <DetailItem label="Criado em" value={formatDate(typedCall.created_at)} />
          <DetailItem label="Aceito em" value={formatDate(typedCall.accepted_at)} />
          <DetailItem label="QR origem" value={formatDate(typedCall.qr_origin_read_at)} />
          <DetailItem label="QR destino" value={formatDate(typedCall.qr_destination_read_at)} />
          <DetailItem label="Concluído em" value={formatDate(typedCall.completed_at)} />
          <DetailItem label="Maqueiro" value={typedCall.assigned_maqueiro?.full_name ?? typedCall.maqueiro?.full_name ?? 'Não atribuído'} />
          <DetailItem label="Precaução" value={typedCall.infection_precaution ?? '-'} />
          <DetailItem label="Observação" value={typedCall.observation ?? '-'} />
        </div>

        {!showRecall && !recallSuccess && (
          <div className="call-modal-actions">
            <button type="button" onClick={() => setShowRecall(true)}><RefreshCw size={17} /> Rechamar paciente</button>
            <button type="button" className="light-button" onClick={onClose}>Fechar</button>
          </div>
        )}

        {showRecall && !recallSuccess && (
          <div className="recall-box">
            <div className="recall-title">
              <span className="section-kicker"><RefreshCw size={14} /> Rechamada</span>
              <h3>Criar novo transporte com dados reaproveitados</h3>
              <p>Ideal quando o paciente saiu de um setor e precisa seguir para outro sem refazer todo o cadastro.</p>
            </div>
            <div className="recall-grid">
              <label>Nova origem
                <div className="input-icon"><MapPin size={17} />
                  <select value={recallForm.originSectorId} onChange={(event) => setRecallForm((current) => ({ ...current, originSectorId: event.target.value }))}>
                    <option value="">Selecione</option>
                    {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                  </select>
                </div>
              </label>
              <label>Novo destino
                <div className="input-icon"><Route size={17} />
                  <select value={recallForm.destinationSectorId} onChange={(event) => setRecallForm((current) => ({ ...current, destinationSectorId: event.target.value }))}>
                    <option value="">Selecione</option>
                    {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                  </select>
                </div>
              </label>
              <label>Prioridade
                <select value={recallForm.priority} onChange={(event) => setRecallForm((current) => ({ ...current, priority: event.target.value as typeof call.priority }))}>
                  <option value="NORMAL">NORMAL</option><option value="URGENTE">URGENTE</option><option value="CRITICO">CRITICO</option>
                </select>
              </label>
              <label>Risco
                <select value={recallForm.risk} onChange={(event) => setRecallForm((current) => ({ ...current, risk: event.target.value as typeof call.risk }))}>
                  <option value="BAIXO">BAIXO</option><option value="MEDIO">MEDIO</option><option value="ALTO">ALTO</option>
                </select>
              </label>
            </div>
            <label>Observação da rechamada
              <textarea rows={3} value={recallForm.observation} onChange={(event) => setRecallForm((current) => ({ ...current, observation: event.target.value }))} />
            </label>
            <div className="recall-preview">
              <div><small>Fluxo sugerido</small><strong>{sectorName(sectors, recallForm.originSectorId)} → {sectorName(sectors, recallForm.destinationSectorId)}</strong></div>
              <span>Paciente: {typedCall.patient_code || 'Não informado'}</span>
            </div>
            {recallError && <div className="error-box">{recallError}</div>}
            <div className="call-modal-actions">
              <button type="button" onClick={handleRecall} disabled={recallLoading} className={recallLoading ? 'button-loading' : ''}>
                {recallLoading ? 'Criando rechamada...' : <><Send size={17} /> Confirmar rechamada</>}
              </button>
              <button type="button" className="light-button" onClick={() => setShowRecall(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {recallSuccess && (
          <div className="recall-success">
            <div className="success-check small"><CheckCircle2 size={28} /></div>
            <h3>Rechamada criada com sucesso</h3>
            <p>O novo transporte foi aberto e já entrou no fluxo de distribuição automática.</p>
            <button type="button" onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CallsPanel({ calls, sectors, loading, onCreated }: CallsPanelProps) {
  const [tab, setTab] = useState<TabFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('TODOS');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('TODOS');
  const [search, setSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<TransportCall | null>(null);

  const counts = useMemo(() => getCounts(calls), [calls]);

  const filteredCalls = useMemo(() => {
    const cleanSearch = normalize(search);
    return calls.filter((call) => {
      const typedCall = call as any;
      if (!callMatchesTab(call, tab)) return false;
      if (statusFilter !== 'TODOS' && call.status !== statusFilter) return false;
      if (priorityFilter !== 'TODOS' && call.priority !== priorityFilter) return false;
      if (riskFilter !== 'TODOS' && call.risk !== riskFilter) return false;

      if (cleanSearch) {
        const searchable = [
          call.number,
          typedCall.patient_code,
          typedCall.origin_sector?.name,
          typedCall.destination_sector?.name,
          typedCall.priority,
          typedCall.risk,
          statusLabel(typedCall.status),
          typedCall.observation,
          typedCall.assigned_maqueiro?.full_name,
          typedCall.maqueiro?.full_name,
        ].map(normalize).join(' | ');
        if (!searchable.includes(cleanSearch)) return false;
      }
      return true;
    });
  }, [calls, search, tab, statusFilter, priorityFilter, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const currentCalls = filteredCalls.slice(startIndex, startIndex + pageSize);

  function updateTab(nextTab: TabFilter) {
    setTab(nextTab);
    setStatusFilter('TODOS');
    setPage(1);
  }

  function resetFilters() {
    setTab('TODOS');
    setStatusFilter('TODOS');
    setPriorityFilter('TODOS');
    setRiskFilter('TODOS');
    setSearch('');
    setPage(1);
  }

  function hasActiveFilters() {
    return tab !== 'TODOS' || statusFilter !== 'TODOS' || priorityFilter !== 'TODOS' || riskFilter !== 'TODOS' || search.trim() !== '';
  }

  return (
    <>
      <section className="reference-table-panel">
        <div className="reference-toolbar v8-toolbar">
          <div className="reference-tabs">
            <button className={tab === 'TODOS' ? 'active' : ''} onClick={() => updateTab('TODOS')}>Todos <span>{counts.todos}</span></button>
            <button className={tab === 'AGUARDANDO' ? 'active' : ''} onClick={() => updateTab('AGUARDANDO')}>Aguardando <span>{counts.aguardando}</span></button>
            <button className={tab === 'ACEITOS' ? 'active' : ''} onClick={() => updateTab('ACEITOS')}>Aceitos <span>{counts.aceitos}</span></button>
            <button className={tab === 'EM_TRANSITO' ? 'active' : ''} onClick={() => updateTab('EM_TRANSITO')}>Em trânsito <span>{counts.transito}</span></button>
            <button className={tab === 'CONCLUIDO' ? 'active' : ''} onClick={() => updateTab('CONCLUIDO')}>Concluídos <span>{counts.concluidos}</span></button>
          </div>

          <div className="reference-search v8-search-area">
            <div className="search-input-wrap">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Buscar por paciente, protocolo, origem, destino..."
              />
              {search && <button type="button" className="clear-search-button" onClick={() => setSearch('')}><X size={14} /></button>}
            </div>
            <button className={showAdvancedFilters || hasActiveFilters() ? 'light-button filter-button-active' : 'light-button'} onClick={() => setShowAdvancedFilters((current) => !current)}>
              <SlidersHorizontal size={17} /> Filtros
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="advanced-filter-panel">
            <label>Status específico
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }}>
                {allStatuses.map((item) => <option key={item} value={item}>{item === 'TODOS' ? 'Todos' : statusLabel(item)}</option>)}
              </select>
            </label>
            <label>Prioridade
              <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value as PriorityFilter); setPage(1); }}>
                <option value="TODOS">Todas</option><option value="NORMAL">Normal</option><option value="URGENTE">Urgente</option><option value="CRITICO">Crítico</option>
              </select>
            </label>
            <label>Risco
              <select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value as RiskFilter); setPage(1); }}>
                <option value="TODOS">Todos</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option>
              </select>
            </label>
            <label>Linhas por página
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {pageSizeOptions.map((item) => <option key={item} value={item}>{item} linhas</option>)}
              </select>
            </label>
            <div className="filter-action-strip">
              <span><Filter size={15} /> {filteredCalls.length} resultado{filteredCalls.length === 1 ? '' : 's'}</span>
              <button type="button" className="light-button" onClick={resetFilters}>Limpar filtros</button>
            </div>
          </div>
        )}

        <div className="reference-data-table calls-page-table">
          <div className="reference-data-head">
            <span>Protocolo</span><span>Paciente</span><span>Origem</span><span>Destino</span><span>Prioridade</span><span>Risco</span><span>Status</span><span>Andamento</span><span>Ação</span>
          </div>

          {currentCalls.length === 0 && <div className="empty-row">Nenhum chamado encontrado com os filtros atuais.</div>}

          {currentCalls.map((call) => {
            const typedCall = call as any;
            return (
              <button type="button" className="reference-data-row" key={call.id} onClick={() => setSelectedCall(call)}>
                <strong>#{String(call.number).padStart(6, '0')}</strong>
                <span>{typedCall.patient_code || 'Paciente não informado'}</span>
                <span>{typedCall.origin_sector?.name ?? '-'}</span>
                <span>{typedCall.destination_sector?.name ?? '-'}</span>
                <span className={`soft-pill ${priorityClass(call.priority)}`}>{call.priority}</span>
                <span className={`soft-pill ${riskClass(call.risk)}`}>{call.risk}</span>
                <span className={`status-pill ${statusClass(call.status)}`}>{statusLabel(call.status)}</span>
                <div className="mini-tracker-cell"><TransportTracker call={call} compact /></div>
                <span className="row-action-link"><Eye size={15} /> Detalhes</span>
              </button>
            );
          })}
        </div>

        <div className="reference-table-footer v8-footer">
          <span>
            Mostrando {filteredCalls.length === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + pageSize, filteredCalls.length)} de {filteredCalls.length} chamados
            {hasActiveFilters() ? ' filtrados' : ''}
          </span>
          <div className="pagination-controls">
            <button className="pager" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
              const pageNumber = index + 1;
              return <button key={pageNumber} className={safePage === pageNumber ? 'pager active' : 'pager'} onClick={() => setPage(pageNumber)}>{pageNumber}</button>;
            })}
            {totalPages > 5 && <button className="pager">...</button>}
            <button className="pager" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {selectedCall && (
        <CallDetailsModal call={selectedCall} sectors={sectors} onClose={() => setSelectedCall(null)} onRecallCreated={onCreated} />
      )}
    </>
  );
}
