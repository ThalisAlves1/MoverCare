import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import { LoaderIcon, SquareEqual } from 'lucide-react'
import { supabase } from './supabaseClient'
import logoTopo from './assets/logo_topo.png'
import fluxoTransporteHospitalar from './assets/fluxo_de_transporte_hospitalar.png'
import './styles.css'
import './styles/loading-spinner-v37.css'
import './styles/logout-v35.css'
import './styles/profile-page-v27.css'
import './styles/sector-map-v40.css'
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
  SquarePlus,
  Accessibility,
  LocateFixed,
  ScanQrCode,
} from 'lucide-react'

const PAGES = [
  { id: 'overview', label: 'Dashboard', mark: <Home size={24} /> },
  { id: 'calls', label: 'Chamados', mark: <ClipboardList size={24} /> },
  { id: 'newcall', label: 'Novo Chamado', mark: <SquarePlus size={24} /> },
  { id: 'maqueiros', label: 'Maqueiros', mark: <Accessibility size={24} /> },
  { id: 'employees', label: 'Funcionários', mark: <UsersRound size={24} /> },
  { id: 'map', label: 'Mapa', mark: <LocateFixed size={24} /> },
  { id: 'sectors', label: 'Setores', mark: '▦' },
  { id: 'qrcodes', label: 'QR Codes', mark: <ScanQrCode size={24} /> },
  { id: 'settings', label: 'Configurações', mark: '⚙' },
  { id: 'profile', label: 'Perfil', mark: '👤' }
]

const ACTIVE_STATUSES = [
  'ABERTO',
  'AGUARDANDO_MAQUEIRO',
  'ENVIADO',
  'ACEITO',
  'A_CAMINHO_ORIGEM',
  'EM_TRANSITO',
  'ATRASADO'
]

const ALL_CALL_STATUSES = [
  'TODOS',
  'AGUARDANDO_MAQUEIRO',
  'ENVIADO',
  'A_CAMINHO_ORIGEM',
  'EM_TRANSITO',
  'ATRASADO',
  'CONCLUIDO',
  'CANCELADO'
]

const EMPTY_SECTOR_FORM = {
  id: null,
  name: '',
  order_position: '',
  qr_token: '',
  active: true
}

const COORD_SETTINGS_STORAGE_KEY = 'movercare_coord_settings_v1'
const COORD_AUDIT_STORAGE_KEY = 'movercare_coord_audit_v1'

const DEFAULT_COORDINATOR_SETTINGS = {
  acceptDeadlineMinutes: 8,
  originDeadlineMinutes: 15,
  transportLongMinutes: 45,
  idleAlertMinutes: 90,
  sectorAlertMinCalls: 3,
  autoRefreshSeconds: 10,
  priorityDefault: 'NORMAL',
  notifyNewCalls: true,
  notifyDelayedCalls: true,
  notifyUnassignedCalls: true,
  criticalSectorIds: []
}

function readStoredJson(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback

    const stored = window.localStorage.getItem(key)
    if (!stored) return fallback

    return JSON.parse(stored)
  } catch (_error) {
    return fallback
  }
}

function writeStoredJson(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (_error) {
    // Mantém a aplicação funcionando mesmo se o navegador bloquear localStorage.
  }
}

function normalizeCoordinatorSettings(settings = {}) {
  const merged = {
    ...DEFAULT_COORDINATOR_SETTINGS,
    ...(settings || {})
  }

  return {
    ...merged,
    acceptDeadlineMinutes: Math.max(1, Number(merged.acceptDeadlineMinutes) || DEFAULT_COORDINATOR_SETTINGS.acceptDeadlineMinutes),
    originDeadlineMinutes: Math.max(1, Number(merged.originDeadlineMinutes) || DEFAULT_COORDINATOR_SETTINGS.originDeadlineMinutes),
    transportLongMinutes: Math.max(1, Number(merged.transportLongMinutes) || DEFAULT_COORDINATOR_SETTINGS.transportLongMinutes),
    idleAlertMinutes: Math.max(1, Number(merged.idleAlertMinutes) || DEFAULT_COORDINATOR_SETTINGS.idleAlertMinutes),
    sectorAlertMinCalls: Math.max(1, Number(merged.sectorAlertMinCalls) || DEFAULT_COORDINATOR_SETTINGS.sectorAlertMinCalls),
    autoRefreshSeconds: Math.max(5, Number(merged.autoRefreshSeconds) || DEFAULT_COORDINATOR_SETTINGS.autoRefreshSeconds),
    notifyNewCalls: Boolean(merged.notifyNewCalls),
    notifyDelayedCalls: Boolean(merged.notifyDelayedCalls),
    notifyUnassignedCalls: Boolean(merged.notifyUnassignedCalls),
    criticalSectorIds: Array.isArray(merged.criticalSectorIds) ? merged.criticalSectorIds.map(String) : []
  }
}

function buildAuditEntry(type, description, profile, metadata = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    description,
    user_id: profile?.id || null,
    user: profile?.full_name || profile?.name || profile?.email || 'Coordenador',
    user_email: profile?.email || '',
    created_at: new Date().toISOString(),
    metadata
  }
}


const PASSWORD_RECOVERY_EMAIL = 'suporte@movercare.com.br'

function formatValue(value) {
  if (!value) return '-'
  return String(value)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function statusClass(status) {
  if (status === 'DISPONIVEL' || status === 'CONCLUIDO') return 'ok'
  if (status === 'ENVIADO' || status === 'A_CAMINHO_ORIGEM' || status === 'EM_TRANSITO') return 'info'
  if (status === 'AGUARDANDO_MAQUEIRO' || status === 'ATRASADO') return 'warn'
  if (status === 'EM_PAUSA' || status === 'OFFLINE' || status === 'CANCELADO' || status === 'SEM_STATUS') return 'muted'
  return 'default'
}

function priorityClass(priority) {
  if (priority === 'CRITICO' || priority === 'URGENTE') return 'danger-soft'
  if (priority === 'NORMAL') return 'success-soft'
  return 'neutral-soft'
}

function riskClass(risk) {
  if (risk === 'ALTO') return 'danger-soft'
  if (risk === 'MEDIO') return 'warning-soft'
  if (risk === 'BAIXO') return 'success-soft'
  return 'neutral-soft'
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return '-'
  const value = Math.round(Number(seconds))
  if (Number.isNaN(value)) return '-'
  if (value < 60) return `${value}s`
  const min = Math.floor(value / 60)
  const sec = value % 60
  return `${min}m ${sec}s`
}

function formatTime(dateString) {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (_e) {
    return '-'
  }
}


function formatDateTime(dateString) {
  if (!dateString) return '-'

  try {
    return new Date(dateString).toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (_e) {
    return '-'
  }
}

function secondsBetween(start, end) {
  if (!start || !end) return null

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000))
}

function getCallSla(call) {
  const now = new Date().toISOString()

  const assignedStart = call.assigned_at || call.created_at
  const acceptEnd = call.accepted_at || (
    ['ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO', 'CONCLUIDO'].includes(call.status)
      ? call.assigned_at
      : now
  )

  const acceptSeconds = secondsBetween(assignedStart, call.accepted_at || acceptEnd)
  const totalEnd = call.completed_at || now
  const totalSeconds = secondsBetween(call.created_at, totalEnd)
  const toOriginSeconds = secondsBetween(call.accepted_at, call.qr_origin_read_at)
  const transportSeconds = secondsBetween(call.qr_origin_read_at, call.completed_at || call.qr_destination_read_at || (call.status === 'EM_TRANSITO' ? now : null))

  let deadlineStatus = 'Sem prazo'
  let deadlineTone = 'neutral-soft'

  if (call.accept_deadline_at) {
    const deadline = new Date(call.accept_deadline_at)
    const accepted = call.accepted_at ? new Date(call.accepted_at) : null
    const reference = accepted || new Date()

    if (accepted && accepted.getTime() <= deadline.getTime()) {
      deadlineStatus = 'Aceito no prazo'
      deadlineTone = 'success-soft'
    } else if (reference.getTime() > deadline.getTime() && !['CONCLUIDO', 'CANCELADO'].includes(call.status)) {
      deadlineStatus = 'SLA estourado'
      deadlineTone = 'danger-soft'
    } else if (reference.getTime() > deadline.getTime()) {
      deadlineStatus = 'Fora do prazo'
      deadlineTone = 'danger-soft'
    } else {
      deadlineStatus = 'Dentro do prazo'
      deadlineTone = 'success-soft'
    }
  }

  return {
    acceptSeconds,
    toOriginSeconds,
    transportSeconds,
    totalSeconds,
    deadlineStatus,
    deadlineTone
  }
}

function buildSlaSummary(calls) {
  const finished = calls.filter(call => call.status === 'CONCLUIDO')
  const withDeadline = calls.filter(call => call.accept_deadline_at)
  const onTime = withDeadline.filter(call => getCallSla(call).deadlineTone === 'success-soft')
  const delayed = calls.filter(call => {
    const sla = getCallSla(call)
    return sla.deadlineTone === 'danger-soft' || call.status === 'ATRASADO'
  })

  const acceptedCalls = calls.filter(call => call.accepted_at)
  const transportedCalls = calls.filter(call => call.completed_at && call.qr_origin_read_at)

  const avgAcceptSeconds = averageSeconds(acceptedCalls.map(call => getCallSla(call).acceptSeconds))
  const avgTransportSeconds = averageSeconds(transportedCalls.map(call => getCallSla(call).transportSeconds))
  const avgTotalSeconds = averageSeconds(finished.map(call => getCallSla(call).totalSeconds))

  return {
    total: calls.length,
    finished: finished.length,
    onTime: onTime.length,
    delayed: delayed.length,
    onTimePercent: withDeadline.length ? Math.round((onTime.length / withDeadline.length) * 100) : 0,
    avgAcceptSeconds,
    avgTransportSeconds,
    avgTotalSeconds
  }
}

function averageSeconds(values) {
  const cleanValues = values.filter(value => Number.isFinite(value))
  if (cleanValues.length === 0) return null

  return Math.round(cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length)
}

function slugQrToken(name) {
  const normalized = String(name || 'SETOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QR_${normalized || 'SETOR'}_${suffix}`
}

function BrandLogo() {
  return (
    <div className="brand-logo">
      <img src={logoTopo} alt="MoverCare" className="brand-logo-img" />
    </div>
  )
}

function Login({ onLogged }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [pointerPosition, setPointerPosition] = useState({ x: 50, y: 50 })
  const [error, setError] = useState('')
  const recoverySubject = encodeURIComponent('Recuperação de senha - MoverCare')
  const recoveryBody = encodeURIComponent('Olá, preciso de ajuda para recuperar meu acesso ao MoverCare.')
  const recoveryHref = `mailto:${PASSWORD_RECOVERY_EMAIL}?subject=${recoverySubject}&body=${recoveryBody}`

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100)

    setPointerPosition({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y))
    })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    await onLogged()
    setLoading(false)
  }

  return (
    <div
      className="login-page interactive-login-bg"
      onPointerMove={handlePointerMove}
      style={{
        '--mouse-x': `${pointerPosition.x}%`,
        '--mouse-y': `${pointerPosition.y}%`
      }}
    >
      <header className="login-header">
        <BrandLogo />
        <div className="login-help">
          <span>Precisa de ajuda?</span>
          <button type="button" className="theme-dot">☀</button>
        </div>
      </header>

      <main className="login-main">
        <section className="login-hero">
          <span className="trust-pill">Seguro • Confiável • Eficiente</span>
          <h1>Gestão inteligente do transporte intra-hospitalar</h1>
          <p>Organize, acompanhe e otimize o transporte de pacientes, equipamentos e materiais com segurança e eficiência.</p>

          <div className="hospital-illustration flow-illustration option-three">
            <img
              src={fluxoTransporteHospitalar}
              alt="Fluxo do transporte hospitalar: origem, transporte, elevador, leito e destino"
            />
          </div>

          <div className="feature-list">
            <div>
              <span className="line-icon">□</span>
              <strong>Segurança</strong>
              <small>Processos padronizados e rastreáveis para reduzir riscos e aumentar a segurança.</small>
            </div>
            <div>
              <span className="line-icon">◷</span>
              <strong>Agilidade</strong>
              <small>Fluxos inteligentes para agilizar chamados, deslocamentos e atendimentos.</small>
            </div>
            <div>
              <span className="line-icon">▥</span>
              <strong>Visão</strong>
              <small>Indicadores em tempo real para acompanhar desempenho e tomar decisões rápidas.</small>
            </div>
          </div>
        </section>

        <form className="login-card" onSubmit={handleLogin}>
          <div className="coordinator-login-badge">
            <span>Portal do Coordenador</span>
          </div>

          <h2>Gestão de <span>Coordenação</span></h2>
          <p>Acesse o painel do coordenador para acompanhar chamados, equipes e indicadores em tempo real.</p>

          <label>Usuário ou e-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" placeholder="Digite seu usuário ou e-mail" required />

          <label>Senha</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Digite sua senha" required />

          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked />
              Lembrar de mim
            </label>
            <a href={recoveryHref}>Esqueci minha senha</a>
          </div>

          {error && <div className="login-error-soft">{error}</div>}

          <button disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="access-as">
            <span />
            <p>Acessar como</p>
            <span />
          </div>

          <div className="role-grid">
            <div><b>Enfermeira</b><small>Acesso rápido</small></div>
            <div><b>Maqueiro</b><small>Acesso rápido</small></div>
            <div><b>Coordenador</b><small>Acesso rápido</small></div>
            <div><b>Administrador</b><small>Acesso rápido</small></div>
          </div>

          <small className="secure-note">Seus dados estão protegidos com criptografia de ponta a ponta.</small>
        </form>
      </main>
    </div>
  )
}

function PageHeader({ title, subtitle, profile, right }) {
  return (
    <header className="content-header no-print">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header-right">
        {right}
        <div className="bell-dot" />
        <div className="user-chip">
          <div className="user-avatar">{String(profile?.full_name || 'C').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{profile?.full_name || 'Coordenador'}</strong>
            <span>{profile?.role || 'COORDENADOR'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function MetricCard({ label, value, sub, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone || ''}`} />
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
      {sub && <small>{sub}</small>}
    </article>
  )
}

function StatusPill({ value }) {
  return (
    <span className={`status-pill ${statusClass(value)}`}>
      {formatValue(value)}
    </span>
  )
}

function SoftPill({ children, tone }) {
  return <span className={`soft-pill ${tone || 'neutral-soft'}`}>{children}</span>
}


function getSectorIdFromMaqueiro(maqueiro) {
  return maqueiro?.current_sector_id || maqueiro?.sector_id || maqueiro?.currentSectorId || null
}

function getSectorNameFromMaqueiro(maqueiro) {
  return maqueiro?.current_sector_name || maqueiro?.sector_name || maqueiro?.sector?.name || ''
}

function callTouchesSector(call, sector) {
  const originId = call.origin?.id || call.origin_sector_id
  const destinationId = call.destination?.id || call.destination_sector_id
  const originName = call.origin?.name || call.origin_sector_name
  const destinationName = call.destination?.name || call.destination_sector_name

  return (
    originId === sector.id ||
    destinationId === sector.id ||
    normalizeText(originName) === normalizeText(sector.name) ||
    normalizeText(destinationName) === normalizeText(sector.name)
  )
}

function buildSectorMapItems(sectors, maqueiros, calls) {
  const activeCalls = calls.filter(call => ACTIVE_STATUSES.includes(call.status))

  return sectors
    .slice()
    .sort((a, b) => Number(a.order_position ?? 999) - Number(b.order_position ?? 999))
    .map((sector, index) => {
      const maqueirosHere = maqueiros.filter(maqueiro => {
        const sectorId = getSectorIdFromMaqueiro(maqueiro)
        const sectorName = getSectorNameFromMaqueiro(maqueiro)

        return sectorId === sector.id || normalizeText(sectorName) === normalizeText(sector.name)
      })

      const callsHere = activeCalls.filter(call => callTouchesSector(call, sector))
      const urgentCalls = callsHere.filter(call => ['URGENTE', 'CRITICO'].includes(call.priority) || call.status === 'ATRASADO')
      const waitingCalls = callsHere.filter(call => ['ABERTO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO', 'ATRASADO'].includes(call.status))
      const inTransitCalls = callsHere.filter(call => ['ACEITO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO'].includes(call.status))

      let tone = 'ok'
      if (urgentCalls.length > 0 || waitingCalls.length >= 4) tone = 'danger'
      else if (waitingCalls.length > 0 || inTransitCalls.length > 0) tone = 'warning'

      return {
        sector,
        index,
        maqueirosHere,
        callsHere,
        urgentCalls,
        waitingCalls,
        inTransitCalls,
        tone
      }
    })
}

function SectorMapVisual({ sectors, maqueiros, calls, compact = false, onSelectSector }) {
  const items = buildSectorMapItems(sectors, maqueiros, calls)

  if (items.length === 0) {
    return <div className="empty-row">Nenhum setor cadastrado.</div>
  }

  return (
    <div className={compact ? 'dynamic-sector-map compact' : 'dynamic-sector-map'}>
      {items.map(item => (
        <button
          type="button"
          key={item.sector.id}
          className={`sector-map-node ${item.tone}`}
          onClick={() => onSelectSector?.(item.sector)}
          title={item.sector.name}
        >
          <span className="sector-node-index">{String(item.index + 1).padStart(2, '0')}</span>

          <strong>{item.sector.name}</strong>

          <small>
            {item.maqueirosHere.length} maqueiro{item.maqueirosHere.length === 1 ? '' : 's'} • {item.callsHere.length} chamado{item.callsHere.length === 1 ? '' : 's'}
          </small>

          <div className="sector-node-metrics">
            <span>Aguardando {item.waitingCalls.length}</span>
            <span>Em rota {item.inTransitCalls.length}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function SectorMapPage({ sectors, maqueiros, calls, profile, onNavigate }) {
  const [selectedSector, setSelectedSector] = useState(null)
  const items = buildSectorMapItems(sectors, maqueiros, calls)
  const selectedItem = selectedSector
    ? items.find(item => item.sector.id === selectedSector.id)
    : items[0]

  const totalActive = calls.filter(call => ACTIVE_STATUSES.includes(call.status)).length
  const sectorsWithQueue = items.filter(item => item.callsHere.length > 0).length
  const availableMaqueiros = maqueiros.filter(maqueiro => maqueiro.status === 'DISPONIVEL').length

  return (
    <>
      <PageHeader
        title="Mapa de Setores"
        subtitle="Visão operacional em tempo real por setor"
        profile={profile}
        right={
          <button type="button" onClick={() => onNavigate('sectors')}>
            Gerenciar setores
          </button>
        }
      />

      <section className="sector-map-summary-row">
        <MetricCard label="Setores ativos" value={sectors.length} sub="malha operacional" tone="teal" />
        <MetricCard label="Setores com fila" value={sectorsWithQueue} sub="chamados ativos" tone="amber" />
        <MetricCard label="Maqueiros disponíveis" value={availableMaqueiros} sub="prontos para receber" tone="teal" />
        <MetricCard label="Chamados ativos" value={totalActive} sub="no mapa agora" tone="blue" />
      </section>

      <section className="sector-map-layout">
        <article className="panel sector-map-main-panel">
          <div className="panel-title-row">
            <div>
              <h2>Mapa operacional</h2>
              <span className="count-badge">Atualização automática</span>
            </div>
          </div>

          <SectorMapVisual
            sectors={sectors}
            maqueiros={maqueiros}
            calls={calls}
            onSelectSector={setSelectedSector}
          />
        </article>

        <aside className="panel sector-map-detail-panel">
          <h2>Detalhes do setor</h2>

          {!selectedItem && <div className="empty-row">Selecione um setor no mapa.</div>}

          {selectedItem && (
            <>
              <div className={`sector-detail-status ${selectedItem.tone}`}>
                <strong>{selectedItem.sector.name}</strong>
                <span>{selectedItem.tone === 'danger' ? 'Atenção' : selectedItem.tone === 'warning' ? 'Em movimento' : 'Estável'}</span>
              </div>

              <div className="sector-detail-grid">
                <div>
                  <small>Maqueiros no setor</small>
                  <strong>{selectedItem.maqueirosHere.length}</strong>
                </div>

                <div>
                  <small>Chamados ativos</small>
                  <strong>{selectedItem.callsHere.length}</strong>
                </div>

                <div>
                  <small>Aguardando</small>
                  <strong>{selectedItem.waitingCalls.length}</strong>
                </div>

                <div>
                  <small>Urgentes/críticos</small>
                  <strong>{selectedItem.urgentCalls.length}</strong>
                </div>
              </div>

              <div className="sector-detail-list">
                <h3>Maqueiros</h3>
                {selectedItem.maqueirosHere.length === 0 && <small>Nenhum maqueiro localizado neste setor.</small>}
                {selectedItem.maqueirosHere.map(maqueiro => (
                  <div key={maqueiro.id}>
                    <span className="mini-avatar">{String(maqueiro.full_name || 'M').slice(0, 1).toUpperCase()}</span>
                    <strong>{maqueiro.full_name}</strong>
                    <StatusPill value={maqueiro.status || 'SEM_STATUS'} />
                  </div>
                ))}
              </div>

              <div className="sector-detail-list">
                <h3>Chamados relacionados</h3>
                {selectedItem.callsHere.length === 0 && <small>Nenhum chamado ativo relacionado a este setor.</small>}
                {selectedItem.callsHere.slice(0, 6).map(call => (
                  <div key={call.id}>
                    <strong>#{call.number}</strong>
                    <small>{call.origin?.name || '-'} → {call.destination?.name || '-'}</small>
                    <StatusPill value={call.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </section>
    </>
  )
}


function SectorQrCard({ sector }) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    let active = true

    async function generate() {
      if (!sector?.qr_token) {
        setQrDataUrl('')
        return
      }

      try {
        const url = await QRCode.toDataURL(sector.qr_token, { width: 300, margin: 1 })
        if (active) setQrDataUrl(url)
      } catch (_e) {
        if (active) setQrDataUrl('')
      }
    }

    generate()
    return () => { active = false }
  }, [sector?.qr_token])

  return (
    <article className="qr-card">
      <div className="qr-card-head">
        <div>
          <h3>{sector.name}</h3>
          <p>Posição operacional {sector.order_position ?? '-'}</p>
        </div>
        <span className={`status-pill ${sector.active ? 'ok' : 'muted'}`}>
          {sector.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="qr-frame">
        {qrDataUrl ? <img src={qrDataUrl} alt={`QR Code ${sector.name}`} /> : <div className="empty-row">Sem QR Token</div>}
      </div>

      <div className="qr-info">
        <span>Token</span>
        <strong>{sector.qr_token || '-'}</strong>
      </div>
    </article>
  )
}

function CallRows({ calls, maqueiros, selectedMaqueiroByCall, setSelectedMaqueiroByCall, reassignCall, loading, compact, onOpenDetails, onCancelCall }) {
  return (
    <div className={`sla-call-list ${compact ? 'compact' : ''}`}>
      {calls.length === 0 && <div className="empty-row">Nenhum chamado encontrado.</div>}

      {calls.map(call => {
        const availableMaqueiros = maqueiros.filter(m => (
          m.status === 'DISPONIVEL' && m.id !== call.assigned_maqueiro_id
        ))

        const sla = getCallSla(call)

        return (
          <article className="sla-call-card" key={call.id}>
            <div className="sla-call-head">
              <div>
                <strong>#{call.number}</strong>
                <span>{call.patient_code || 'Paciente não informado'}</span>
              </div>

              <div className="sla-call-badges">
                <StatusPill value={call.status} />
                <SoftPill tone={sla.deadlineTone}>{sla.deadlineStatus}</SoftPill>
                <button type="button" className="call-details-chip" onClick={() => onOpenDetails?.(call.id)}>
                  Detalhes
                </button>
                {!['CONCLUIDO', 'CANCELADO'].includes(call.status) && (
                  <button type="button" className="call-cancel-chip" onClick={() => onCancelCall?.(call)}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="sla-call-grid">
              <div>
                <small>Origem</small>
                <strong>{call.origin?.name || '-'}</strong>
              </div>

              <div>
                <small>Destino</small>
                <strong>{call.destination?.name || '-'}</strong>
              </div>

              <div>
                <small>Maqueiro</small>
                <strong>{call.maqueiro?.full_name || 'Não atribuído'}</strong>
              </div>

              <div>
                <small>Tipo</small>
                <strong>{formatValue(call.transport_type)}</strong>
              </div>

              <div>
                <small>Prioridade</small>
                <SoftPill tone={priorityClass(call.priority)}>{formatValue(call.priority)}</SoftPill>
              </div>

              <div>
                <small>Risco</small>
                <SoftPill tone={riskClass(call.risk)}>{formatValue(call.risk)}</SoftPill>
              </div>

              <div>
                <small>Criado</small>
                <strong>{formatDateTime(call.created_at)}</strong>
              </div>

              <div>
                <small>Atribuído</small>
                <strong>{formatDateTime(call.assigned_at)}</strong>
              </div>

              <div>
                <small>Prazo aceite</small>
                <strong className={sla.deadlineTone === 'danger-soft' ? 'danger-text' : ''}>{formatDateTime(call.accept_deadline_at)}</strong>
              </div>

              <div>
                <small>Aceito em</small>
                <strong>{formatDateTime(call.accepted_at)}</strong>
              </div>

              <div>
                <small>QR origem</small>
                <strong>{formatDateTime(call.qr_origin_read_at)}</strong>
              </div>

              <div>
                <small>QR destino / concluído</small>
                <strong>{formatDateTime(call.completed_at || call.qr_destination_read_at)}</strong>
              </div>
            </div>

            <div className="sla-time-grid">
              <div>
                <small>SLA aceite</small>
                <strong>{formatSeconds(sla.acceptSeconds)}</strong>
              </div>

              <div>
                <small>Até origem</small>
                <strong>{formatSeconds(sla.toOriginSeconds)}</strong>
              </div>

              <div>
                <small>Transporte</small>
                <strong>{formatSeconds(sla.transportSeconds)}</strong>
              </div>

              <div>
                <small>Tempo total</small>
                <strong>{formatSeconds(sla.totalSeconds)}</strong>
              </div>

              <div>
                <small>Timeouts</small>
                <strong>{call.timeout_count ?? 0}</strong>
              </div>
            </div>

            {call.observation && (
              <div className="sla-observation">
                <small>Observação</small>
                <p>{call.observation}</p>
              </div>
            )}

            <div className="sla-action-row">
              <select
                value={selectedMaqueiroByCall[call.id] || ''}
                onChange={(e) => setSelectedMaqueiroByCall(prev => ({ ...prev, [call.id]: e.target.value }))}
              >
                <option value="">{availableMaqueiros.length === 0 ? 'Sem maqueiro disponível' : 'Selecionar maqueiro'}</option>
                {availableMaqueiros.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>

              <button onClick={() => reassignCall(call.id)} disabled={loading || availableMaqueiros.length === 0}>
                Reatribuir
              </button>

              {!['CONCLUIDO', 'CANCELADO'].includes(call.status) && (
                <button type="button" className="danger-outline-button" onClick={() => onCancelCall?.(call)} disabled={loading}>
                  Cancelar
                </button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}


function isCallUnassigned(call) {
  const hasMaqueiro = Boolean(call.assigned_maqueiro_id || call.maqueiro?.id)
  return !hasMaqueiro && ['ABERTO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO', 'ATRASADO'].includes(call.status)
}

function getCallAgeMinutes(call) {
  const reference = call.created_at || call.assigned_at
  if (!reference) return null

  const start = new Date(reference)
  if (Number.isNaN(start.getTime())) return null

  return Math.max(0, Math.round((Date.now() - start.getTime()) / 60000))
}

function buildCoordinatorAlerts(calls, maqueiros, sectors, settings = DEFAULT_COORDINATOR_SETTINGS) {
  const alerts = []
  const config = normalizeCoordinatorSettings(settings)
  const longTransportSeconds = config.transportLongMinutes * 60
  const idleLimitMinutes = config.idleAlertMinutes
  const sectorAlertMinCalls = config.sectorAlertMinCalls
  const criticalSectorIds = new Set((config.criticalSectorIds || []).map(String))

  calls.forEach(call => {
    const sla = getCallSla(call)
    const age = getCallAgeMinutes(call)

    if (call.status === 'ATRASADO' || sla.deadlineTone === 'danger-soft') {
      alerts.push({
        id: `sla-${call.id}`,
        tone: 'danger',
        title: `Chamado #${call.number} com SLA crítico`,
        description: `${call.origin?.name || '-'} → ${call.destination?.name || '-'}`,
        meta: formatValue(call.status),
        call
      })
    } else if (isCallUnassigned(call)) {
      alerts.push({
        id: `sem-responsavel-${call.id}`,
        tone: 'warn',
        title: `Chamado #${call.number} sem responsável`,
        description: `${call.origin?.name || '-'} → ${call.destination?.name || '-'}`,
        meta: age !== null ? `${age} min aguardando` : 'Aguardando atribuição',
        call
      })
    } else if (ACTIVE_STATUSES.includes(call.status) && getCallSla(call).totalSeconds > longTransportSeconds) {
      alerts.push({
        id: `longo-${call.id}`,
        tone: 'warn',
        title: `Transporte #${call.number} acima do tempo esperado`,
        description: `${call.maqueiro?.full_name || 'Maqueiro não informado'} • ${formatSeconds(getCallSla(call).totalSeconds)}`,
        meta: formatValue(call.status),
        call
      })
    }
  })

  maqueiros.forEach(maqueiro => {
    const lastUpdate = maqueiro.updated_at ? new Date(maqueiro.updated_at) : null
    const minutesIdle = lastUpdate && !Number.isNaN(lastUpdate.getTime())
      ? Math.round((Date.now() - lastUpdate.getTime()) / 60000)
      : null

    if (maqueiro.status === 'DISPONIVEL' && minutesIdle !== null && minutesIdle >= idleLimitMinutes) {
      alerts.push({
        id: `idle-${maqueiro.id}`,
        tone: 'info',
        title: `${getMaqueiroName(maqueiro)} disponível há muito tempo`,
        description: maqueiro.current_sector_name || getSectorNameFromMaqueiro(maqueiro) || 'Setor não informado',
        meta: `${minutesIdle} min parado`
      })
    }
  })

  buildSectorDemand(calls.filter(call => ACTIVE_STATUSES.includes(call.status)), sectors)
    .filter(item => item.total >= sectorAlertMinCalls || criticalSectorIds.has(String(item.sector.id)))
    .slice(0, 2)
    .forEach(item => {
      alerts.push({
        id: `setor-${item.sector.id}`,
        tone: item.delayed > 0 ? 'danger' : 'warn',
        title: `${item.sector.name} com alta demanda`,
        description: `${item.total} chamado${item.total === 1 ? '' : 's'} ativo${item.total === 1 ? '' : 's'} no setor`,
        meta: item.delayed > 0 ? `${item.delayed} atraso${item.delayed === 1 ? '' : 's'}` : 'Monitorar fila'
      })
    })

  const toneOrder = { danger: 0, warn: 1, info: 2, ok: 3 }
  return alerts.sort((a, b) => (toneOrder[a.tone] ?? 9) - (toneOrder[b.tone] ?? 9))
}

function buildSectorDemand(calls, sectors) {
  return sectors.map(sector => {
    const sectorCalls = calls.filter(call => callTouchesSector(call, sector))
    const delayed = sectorCalls.filter(call => call.status === 'ATRASADO' || getCallSla(call).deadlineTone === 'danger-soft')
    const waiting = sectorCalls.filter(call => ['ABERTO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO'].includes(call.status))
    const finished = sectorCalls.filter(call => call.status === 'CONCLUIDO' || call.completed_at)

    return {
      sector,
      total: sectorCalls.length,
      delayed: delayed.length,
      waiting: waiting.length,
      finished: finished.length
    }
  }).sort((a, b) => b.total - a.total || b.delayed - a.delayed || a.sector.name.localeCompare(b.sector.name))
}

function buildHourlyPeaks(calls) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00 às ${String(hour).padStart(2, '0')}:59`,
    total: 0
  }))

  calls.forEach(call => {
    const reference = getCallReferenceDate(call) || call.created_at
    if (!reference) return

    const date = new Date(reference)
    if (Number.isNaN(date.getTime())) return

    buckets[date.getHours()].total += 1
  })

  return buckets.filter(item => item.total > 0).sort((a, b) => b.total - a.total || a.hour - b.hour)
}

function CoordinatorAlertPanel({ alerts, onNavigate }) {
  return (
    <section className="panel coord-alert-panel">
      <div className="coord-panel-head compact">
        <div>
          <span className="section-kicker">Inteligência operacional</span>
          <h2>Alertas do coordenador</h2>
        </div>
        <span className="count-badge">{alerts.length}</span>
      </div>

      <div className="coord-alert-list">
        {alerts.length === 0 && <div className="empty-side">Nenhum alerta importante agora.</div>}
        {alerts.slice(0, 6).map(alert => (
          <article key={alert.id} className={`coord-alert-item ${alert.tone}`}>
            <span className="coord-alert-dot" />
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.description}</p>
            </div>
            <small>{alert.meta}</small>
          </article>
        ))}
      </div>

      <button className="full-link" onClick={() => onNavigate('calls')}>Abrir fila de chamados</button>
    </section>
  )
}

function UnassignedCallsPanel({ calls, maqueiros, selectedMaqueiroByCall, setSelectedMaqueiroByCall, reassignCall, loading, onNavigate }) {
  const availableMaqueiros = maqueiros.filter(m => m.status === 'DISPONIVEL')

  return (
    <section className="panel coord-unassigned-panel">
      <div className="coord-panel-head compact">
        <div>
          <span className="section-kicker">Ação rápida</span>
          <h2>Chamados sem responsável</h2>
        </div>
        <span className="count-badge">{calls.length}</span>
      </div>

      <div className="unassigned-list">
        {calls.length === 0 && <div className="empty-side">Nenhum chamado aguardando atribuição.</div>}
        {calls.slice(0, 4).map(call => (
          <article key={call.id} className="unassigned-item">
            <div>
              <strong>#{call.number}</strong>
              <small>{call.origin?.name || '-'} → {call.destination?.name || '-'}</small>
            </div>

            <div className="unassigned-actions">
              <select
                value={selectedMaqueiroByCall[call.id] || ''}
                onChange={(event) => setSelectedMaqueiroByCall(prev => ({ ...prev, [call.id]: event.target.value }))}
              >
                <option value="">{availableMaqueiros.length === 0 ? 'Sem maqueiro disponível' : 'Selecionar'}</option>
                {availableMaqueiros.map(maqueiro => (
                  <option key={maqueiro.id} value={maqueiro.id}>{getMaqueiroName(maqueiro)}</option>
                ))}
              </select>

              <button onClick={() => reassignCall(call.id)} disabled={loading || availableMaqueiros.length === 0 || !selectedMaqueiroByCall[call.id]}>
                Atribuir
              </button>
            </div>
          </article>
        ))}
      </div>

      <button className="full-link" onClick={() => onNavigate('calls')}>Ver todos</button>
    </section>
  )
}

function SectorDemandPanel({ items }) {
  const maxTotal = Math.max(1, ...items.map(item => item.total))

  return (
    <section className="panel coord-demand-panel">
      <div className="coord-panel-head compact">
        <div>
          <span className="section-kicker">Demanda</span>
          <h2>Setores mais acionados</h2>
        </div>
      </div>

      <div className="sector-demand-list">
        {items.length === 0 && <div className="empty-side">Nenhum chamado no período.</div>}
        {items.slice(0, 6).map(item => (
          <article key={item.sector.id} className="sector-demand-item">
            <div>
              <strong>{item.sector.name}</strong>
              <small>{item.total} chamado{item.total === 1 ? '' : 's'} • {item.waiting} aguardando • {item.delayed} atraso{item.delayed === 1 ? '' : 's'}</small>
            </div>
            <span>{item.total}</span>
            <em><i style={{ width: `${Math.max(8, Math.round((item.total / maxTotal) * 100))}%` }} /></em>
          </article>
        ))}
      </div>
    </section>
  )
}

function TeamHighlightsPanel({ ranking }) {
  return (
    <section className="panel coord-ranking-panel">
      <div className="coord-panel-head compact">
        <div>
          <span className="section-kicker">Equipe</span>
          <h2>Destaques da equipe</h2>
        </div>
      </div>

      <div className="team-ranking-list">
        {ranking.length === 0 && <div className="empty-side">Nenhum transporte no período.</div>}
        {ranking.slice(0, 5).map((item, index) => (
          <article key={item.maqueiro.id} className="team-ranking-item">
            <span className="ranking-position">{index + 1}</span>
            <div>
              <strong>{getMaqueiroName(item.maqueiro)}</strong>
              <small>{item.completed} concluído{item.completed === 1 ? '' : 's'} • {item.onTimePercent}% no prazo</small>
            </div>
            <b>{item.total}</b>
          </article>
        ))}
      </div>
    </section>
  )
}

function PeakHoursPanel({ peaks }) {
  const maxTotal = Math.max(1, ...peaks.map(item => item.total))

  return (
    <section className="panel side-panel coord-peak-panel">
      <h3>Horários de pico <span>{peaks.length}</span></h3>
      <div className="peak-hour-list">
        {peaks.length === 0 && <div className="empty-side">Sem dados no período.</div>}
        {peaks.slice(0, 5).map(item => (
          <article key={item.hour} className="peak-hour-item">
            <div>
              <strong>{item.label}</strong>
              <small>{item.total} chamado{item.total === 1 ? '' : 's'}</small>
            </div>
            <em><i style={{ width: `${Math.max(8, Math.round((item.total / maxTotal) * 100))}%` }} /></em>
          </article>
        ))}
      </div>
    </section>
  )
}


function getCallBed(call) {
  const sources = [call?.patient_code, call?.observation].filter(Boolean).join('\n')
  const match = sources.match(/leito\s*:?\s*([^|\n]+)/i)
  return match ? match[1].trim() : '-'
}

function getCleanPatientCode(call) {
  const value = call?.patient_code || ''
  return value.split('|')[0]?.trim() || value || 'Paciente não informado'
}

function getTimelineStepStatus(step, call) {
  if (step.time) return 'done'

  const status = call?.status
  if (status === 'CANCELADO') return 'cancelled'
  if (step.key === 'assigned' && !call?.assigned_maqueiro_id) return 'waiting'
  if (step.key === 'accepted' && call?.assigned_maqueiro_id) return 'waiting'
  if (step.key === 'origin' && ['ACEITO', 'A_CAMINHO_ORIGEM'].includes(status)) return 'waiting'
  if (step.key === 'destination' && status === 'EM_TRANSITO') return 'waiting'
  if (step.key === 'completed' && status !== 'CONCLUIDO') return 'pending'

  return 'pending'
}

function buildCallTimeline(call) {
  const maqueiroName = call?.maqueiro?.full_name || 'Maqueiro não atribuído'

  return [
    {
      key: 'created',
      title: 'Chamado criado',
      time: call?.created_at,
      description: `${getCleanPatientCode(call)} • ${call?.origin?.name || '-'} para ${call?.destination?.name || '-'}`
    },
    {
      key: 'assigned',
      title: 'Maqueiro atribuído',
      time: call?.assigned_at,
      description: maqueiroName
    },
    {
      key: 'accepted',
      title: 'Chamado aceito',
      time: call?.accepted_at,
      description: call?.accepted_at ? `${maqueiroName} aceitou o transporte` : 'Aguardando aceite do maqueiro'
    },
    {
      key: 'origin',
      title: 'Chegada na origem',
      time: call?.qr_origin_read_at,
      description: call?.origin?.name || 'QR Code da origem ainda não lido'
    },
    {
      key: 'destination',
      title: 'Chegada no destino',
      time: call?.qr_destination_read_at,
      description: call?.destination?.name || 'QR Code do destino ainda não lido'
    },
    {
      key: 'completed',
      title: 'Transporte concluído',
      time: call?.completed_at,
      description: call?.completed_at ? 'Fluxo finalizado' : 'Aguardando conclusão do transporte'
    }
  ].map(step => ({
    ...step,
    status: getTimelineStepStatus(step, call)
  }))
}

function CallDetailInfo({ label, value, children }) {
  return (
    <div className="call-detail-info">
      <small>{label}</small>
      {children || <strong>{value || '-'}</strong>}
    </div>
  )
}

function CallTimeline({ call }) {
  const steps = buildCallTimeline(call)

  return (
    <div className="call-timeline">
      {steps.map((step, index) => (
        <article key={step.key} className={`call-timeline-item ${step.status}`}>
          <span className="call-timeline-marker">{index + 1}</span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </div>
          <time>{formatDateTime(step.time)}</time>
        </article>
      ))}
    </div>
  )
}

function CallDetailPage({
  call,
  maqueiros,
  selectedMaqueiroByCall,
  setSelectedMaqueiroByCall,
  reassignCall,
  loading,
  profile,
  refreshData,
  onBack,
  onCancelCall
}) {
  if (!call) {
    return (
      <>
        <PageHeader
          title="Detalhes do chamado"
          subtitle="O chamado selecionado não foi encontrado na lista atual"
          profile={profile}
          right={<button type="button" onClick={onBack}>Voltar para chamados</button>}
        />

        <section className="panel call-detail-empty">
          <h2>Chamado não encontrado</h2>
          <p>Ele pode ter sido removido, filtrado ou ainda não foi carregado. Atualize os dados ou volte para a fila de chamados.</p>
          <div>
            <button type="button" onClick={refreshData} disabled={loading}>Atualizar dados</button>
            <button type="button" className="light-button" onClick={onBack}>Voltar</button>
          </div>
        </section>
      </>
    )
  }

  const sla = getCallSla(call)
  const availableMaqueiros = maqueiros.filter(m => (
    m.status === 'DISPONIVEL' && m.id !== call.assigned_maqueiro_id
  ))

  return (
    <>
      <PageHeader
        title={`Chamado #${call.number}`}
        subtitle="Detalhamento completo do transporte, linha do tempo e SLA"
        profile={profile}
        right={
          <div className="call-detail-header-actions">
            <button type="button" className="light-button" onClick={onBack}>Voltar</button>
            <button type="button" onClick={refreshData} disabled={loading}>Atualizar</button>
            {call && !['CONCLUIDO', 'CANCELADO'].includes(call.status) && (
              <button type="button" className="danger-outline-button" onClick={() => onCancelCall?.(call)} disabled={loading}>Cancelar chamado</button>
            )}
          </div>
        }
      />

      <section className="panel call-detail-hero">
        <div className="call-detail-hero-main">
          <div>
            <span className="section-kicker">Detalhes do transporte</span>
            <h2>{getCleanPatientCode(call)}</h2>
            <p>{call.origin?.name || '-'} → {call.destination?.name || '-'}</p>
          </div>

          <div className="call-detail-status-box">
            <StatusPill value={call.status} />
            <SoftPill tone={sla.deadlineTone}>{sla.deadlineStatus}</SoftPill>
          </div>
        </div>

        <div className="call-detail-summary">
          <CallDetailInfo label="Paciente" value={getCleanPatientCode(call)} />
          <CallDetailInfo label="Leito" value={getCallBed(call)} />
          <CallDetailInfo label="Maqueiro" value={call.maqueiro?.full_name || 'Não atribuído'} />
          <CallDetailInfo label="Tempo total" value={formatSeconds(sla.totalSeconds)} />
        </div>
      </section>

      <section className="call-detail-layout">
        <div className="call-detail-main-column">
          <section className="panel call-detail-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Linha do tempo</span>
                <h2>Histórico do transporte</h2>
              </div>
            </div>

            <CallTimeline call={call} />
          </section>

          <section className="panel call-detail-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Informações</span>
                <h2>Dados operacionais</h2>
              </div>
            </div>

            <div className="call-detail-grid">
              <CallDetailInfo label="Origem" value={call.origin?.name || '-'} />
              <CallDetailInfo label="Destino" value={call.destination?.name || '-'} />
              <CallDetailInfo label="Tipo de transporte" value={formatValue(call.transport_type)} />
              <CallDetailInfo label="Prioridade">
                <SoftPill tone={priorityClass(call.priority)}>{formatValue(call.priority)}</SoftPill>
              </CallDetailInfo>
              <CallDetailInfo label="Risco">
                <SoftPill tone={riskClass(call.risk)}>{formatValue(call.risk)}</SoftPill>
              </CallDetailInfo>
              <CallDetailInfo label="Timeouts" value={call.timeout_count ?? 0} />
              <CallDetailInfo label="Criado em" value={formatDateTime(call.created_at)} />
              <CallDetailInfo label="Prazo de aceite" value={formatDateTime(call.accept_deadline_at)} />
            </div>

            {call.observation && (
              <div className="call-detail-observation">
                <small>Observações</small>
                <p>{call.observation}</p>
              </div>
            )}

            {call.status === 'CANCELADO' && (
              <div className="call-detail-observation danger">
                <small>Cancelamento</small>
                <p>{call.cancellation_reason || 'Motivo não informado.'}</p>
                <small>Cancelado em: {formatDateTime(call.cancelled_at)}</small>
              </div>
            )}
          </section>
        </div>

        <aside className="call-detail-side-column">
          <section className="panel call-detail-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Tempos</span>
                <h2>SLA do chamado</h2>
              </div>
            </div>

            <div className="call-detail-time-grid">
              <CallDetailInfo label="Tempo até aceitar" value={formatSeconds(sla.acceptSeconds)} />
              <CallDetailInfo label="Até origem" value={formatSeconds(sla.toOriginSeconds)} />
              <CallDetailInfo label="Transporte" value={formatSeconds(sla.transportSeconds)} />
              <CallDetailInfo label="Total" value={formatSeconds(sla.totalSeconds)} />
            </div>
          </section>

          <section className="panel call-detail-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">QR Code</span>
                <h2>Leituras registradas</h2>
              </div>
            </div>

            <div className="call-detail-qr-list">
              <CallDetailInfo label="QR origem" value={formatDateTime(call.qr_origin_read_at)} />
              <CallDetailInfo label="QR destino" value={formatDateTime(call.qr_destination_read_at)} />
              <CallDetailInfo label="Concluído em" value={formatDateTime(call.completed_at)} />
            </div>
          </section>

          <section className="panel call-detail-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Ação do coordenador</span>
                <h2>Reatribuição</h2>
              </div>
            </div>

            <div className="call-detail-reassign">
              <select
                value={selectedMaqueiroByCall[call.id] || ''}
                onChange={(event) => setSelectedMaqueiroByCall(prev => ({ ...prev, [call.id]: event.target.value }))}
              >
                <option value="">{availableMaqueiros.length === 0 ? 'Sem maqueiro disponível' : 'Selecionar maqueiro'}</option>
                {availableMaqueiros.map(maqueiro => (
                  <option key={maqueiro.id} value={maqueiro.id}>{getMaqueiroName(maqueiro)}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => reassignCall(call.id)}
                disabled={loading || availableMaqueiros.length === 0 || !selectedMaqueiroByCall[call.id]}
              >
                Reatribuir chamado
              </button>
            </div>
          </section>
        </aside>
      </section>
    </>
  )
}


function CoordinatorSettingsPage({
  settings,
  onSave,
  auditLog,
  onClearAudit,
  sectors,
  profile
}) {
  const [form, setForm] = useState(() => normalizeCoordinatorSettings(settings))

  useEffect(() => {
    setForm(normalizeCoordinatorSettings(settings))
  }, [settings])

  function updateField(name, value) {
    setForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  function toggleCriticalSector(sectorId) {
    const id = String(sectorId)

    setForm(prev => {
      const current = new Set((prev.criticalSectorIds || []).map(String))

      if (current.has(id)) {
        current.delete(id)
      } else {
        current.add(id)
      }

      return {
        ...prev,
        criticalSectorIds: Array.from(current)
      }
    })
  }

  function submitSettings(event) {
    event.preventDefault()
    onSave(normalizeCoordinatorSettings(form))
  }

  const notificationOptions = [
    {
      key: 'notifyNewCalls',
      title: 'Chamados novos',
      description: 'Destacar novas solicitações abertas pela enfermagem.'
    },
    {
      key: 'notifyDelayedCalls',
      title: 'Chamados atrasados',
      description: 'Mostrar alertas quando o SLA estiver crítico.'
    },
    {
      key: 'notifyUnassignedCalls',
      title: 'Sem responsável',
      description: 'Alertar chamados aguardando maqueiro.'
    }
  ]

  return (
    <>
      <PageHeader
        title="Configurações do Coordenador"
        subtitle="Ajuste regras operacionais, alertas e acompanhe a auditoria multiusuário do portal"
        profile={profile}
        right={
          <button type="button" className="light-button" onClick={() => setForm(DEFAULT_COORDINATOR_SETTINGS)}>
            Restaurar padrão
          </button>
        }
      />

      <section className="coord-settings-layout">
        <div className="coord-settings-main">
          <form className="panel coord-settings-panel" onSubmit={submitSettings}>
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Regras operacionais</span>
                <h2>Tempos e limites do sistema</h2>
              </div>
            </div>

            <div className="coord-settings-grid">
              <label>
                <span>Tempo limite para aceite</span>
                <input
                  type="number"
                  min="1"
                  value={form.acceptDeadlineMinutes}
                  onChange={(event) => updateField('acceptDeadlineMinutes', event.target.value)}
                />
                <small>Minutos para o maqueiro aceitar o chamado.</small>
              </label>

              <label>
                <span>Tempo para chegar na origem</span>
                <input
                  type="number"
                  min="1"
                  value={form.originDeadlineMinutes}
                  onChange={(event) => updateField('originDeadlineMinutes', event.target.value)}
                />
                <small>Referência interna para monitoramento.</small>
              </label>

              <label>
                <span>Transporte acima do esperado</span>
                <input
                  type="number"
                  min="1"
                  value={form.transportLongMinutes}
                  onChange={(event) => updateField('transportLongMinutes', event.target.value)}
                />
                <small>Gera alerta quando o transporte passa desse tempo.</small>
              </label>

              <label>
                <span>Maqueiro parado há</span>
                <input
                  type="number"
                  min="1"
                  value={form.idleAlertMinutes}
                  onChange={(event) => updateField('idleAlertMinutes', event.target.value)}
                />
                <small>Alerta quando disponível por muito tempo.</small>
              </label>

              <label>
                <span>Alta demanda por setor</span>
                <input
                  type="number"
                  min="1"
                  value={form.sectorAlertMinCalls}
                  onChange={(event) => updateField('sectorAlertMinCalls', event.target.value)}
                />
                <small>Quantidade mínima de chamados ativos para alertar.</small>
              </label>

              <label>
                <span>Atualização automática</span>
                <input
                  type="number"
                  min="5"
                  value={form.autoRefreshSeconds}
                  onChange={(event) => updateField('autoRefreshSeconds', event.target.value)}
                />
                <small>Intervalo em segundos para atualizar o painel.</small>
              </label>

              <label>
                <span>Prioridade padrão</span>
                <select
                  value={form.priorityDefault}
                  onChange={(event) => updateField('priorityDefault', event.target.value)}
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="MEDIA">Média</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
                <small>Referência para novas regras futuras.</small>
              </label>
            </div>

            <div className="coord-settings-actions">
              <button type="submit">Salvar configurações</button>
            </div>
          </form>

          <section className="panel coord-settings-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Notificações</span>
                <h2>Alertas dentro do portal</h2>
              </div>
            </div>

            <div className="notification-settings-list">
              {notificationOptions.map(option => (
                <label key={option.key} className="notification-toggle-card">
                  <div>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(form[option.key])}
                    onChange={(event) => updateField(option.key, event.target.checked)}
                  />
                </label>
              ))}
            </div>

            <div className="coord-settings-actions">
              <button type="button" onClick={() => onSave(normalizeCoordinatorSettings(form))}>Aplicar alertas</button>
            </div>
          </section>

          <section className="panel coord-settings-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Setores críticos</span>
                <h2>Monitoramento prioritário</h2>
              </div>
              <span className="count-badge">{form.criticalSectorIds?.length || 0}</span>
            </div>

            <div className="critical-sector-grid">
              {sectors.length === 0 && <div className="empty-side">Nenhum setor carregado.</div>}

              {sectors.map(sector => {
                const checked = (form.criticalSectorIds || []).map(String).includes(String(sector.id))

                return (
                  <label key={sector.id} className={`critical-sector-card ${checked ? 'active' : ''}`}>
                    <div>
                      <strong>{sector.name}</strong>
                      <small>{sector.active ? 'Ativo' : 'Inativo'} • QR: {sector.qr_token || '-'}</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCriticalSector(sector.id)}
                    />
                  </label>
                )
              })}
            </div>

            <div className="coord-settings-actions">
              <button type="button" onClick={() => onSave(normalizeCoordinatorSettings(form))}>
                Salvar setores críticos
              </button>
            </div>
          </section>
        </div>

        <aside className="coord-settings-side">
          <section className="panel coord-audit-panel">
            <div className="coord-panel-head compact">
              <div>
                <span className="section-kicker">Auditoria</span>
                <h2>Registro de ações</h2>
              </div>
              <span className="count-badge">{auditLog.length}</span>
            </div>

            <p className="audit-helper">
              Auditoria centralizada no Supabase. Todos os coordenadores e administradores autorizados podem acompanhar as ações registradas.
            </p>

            <div className="audit-list">
              {auditLog.length === 0 && <div className="empty-side">Nenhuma ação registrada ainda.</div>}

              {auditLog.slice(0, 14).map(entry => (
                <article key={entry.id} className="audit-item">
                  <span>{entry.type}</span>
                  <div>
                    <strong>{entry.description}</strong>
                    <small>{entry.user} • {formatDateTime(entry.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>

            <button type="button" className="light-button audit-clear-button" onClick={onClearAudit}>
              Atualizar auditoria
            </button>
          </section>
        </aside>
      </section>
    </>
  )
}

function OverviewPage(props) {
  const { dashboardStats, counters, maqueiros, calls, sectors, coordinatorSettings, registerAudit, onNavigate, openCallDetails, profile, loading, refreshData, selectedMaqueiroByCall, setSelectedMaqueiroByCall, reassignCall, cancelCall } = props
  const [operationMonth, setOperationMonth] = useState(getCurrentMonthValue())
  const operationMonthLabel = getMonthLabel(operationMonth)

  const monthlyCalls = useMemo(() => calls.filter(call => isSameMonth(getCallReferenceDate(call), operationMonth)), [calls, operationMonth])
  const visibleCalls = calls.slice(0, 6)
  const unassignedCalls = calls.filter(isCallUnassigned)
  const intelligentAlerts = buildCoordinatorAlerts(calls, maqueiros, sectors, coordinatorSettings)
  const visibleTeam = maqueiros.slice(0, 5)
  const slaSummary = buildSlaSummary(calls)
  const monthlySlaSummary = buildSlaSummary(monthlyCalls)
  const sectorDemand = buildSectorDemand(monthlyCalls, sectors).filter(item => item.total > 0)
  const peakHours = buildHourlyPeaks(monthlyCalls)
  const teamRanking = maqueiros
    .map(maqueiro => buildMaqueiroMonthlyProgress(maqueiro, calls, operationMonth))
    .filter(item => item.total > 0)
    .sort((a, b) => b.completed - a.completed || b.total - a.total || a.delayedCount - b.delayedCount)

  function handleOperationReportPdf() {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const generatedAt = getPdfDateTime()
      let y = 40

      doc.setFillColor(6, 43, 88)
      doc.rect(0, 0, pageWidth, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Relatório mensal da operação', 14, 13)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Período: ${operationMonthLabel}`, 14, 22)
      doc.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 22, { align: 'right' })

      const summaryCards = [
        ['Chamados', monthlyCalls.length],
        ['Concluídos', monthlySlaSummary.finished],
        ['Atrasos', monthlySlaSummary.delayed],
        ['SLA no prazo', `${monthlySlaSummary.onTimePercent}%`],
        ['Tempo médio', formatSeconds(monthlySlaSummary.avgTransportSeconds)]
      ]
      const gap = 4
      const cardWidth = (pageWidth - 28 - gap * (summaryCards.length - 1)) / summaryCards.length

      summaryCards.forEach(([label, value], index) => {
        const x = 14 + index * (cardWidth + gap)
        doc.setFillColor(245, 250, 252)
        doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'F')
        doc.setDrawColor(220, 232, 239)
        doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'S')
        doc.setTextColor(100, 116, 139)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text(String(label).toUpperCase(), x + 3, y + 7)
        doc.setTextColor(6, 43, 88)
        doc.setFontSize(13)
        doc.text(safePdfText(value), x + 3, y + 16)
      })

      y += 34

      function drawSectionTable(title, columns, rows) {
        doc.setTextColor(6, 43, 88)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, 14, y)
        y += 6

        const headerHeight = 9
        const rowHeight = 10
        if (y + headerHeight + rowHeight > pageHeight - 14) {
          doc.addPage()
          y = 22
        }

        let x = 14
        columns.forEach(col => {
          drawPdfCell(doc, col.label, x, y, col.width, headerHeight, {
            fill: [6, 43, 88],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            align: col.align || 'left'
          })
          x += col.width
        })
        y += headerHeight

        if (rows.length === 0) {
          doc.setTextColor(100, 116, 139)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text('Nenhum dado encontrado.', 16, y + 7)
          y += 13
          return
        }

        rows.forEach((row, index) => {
          if (y + rowHeight > pageHeight - 14) {
            doc.addPage()
            y = 22
          }
          let cellX = 14
          columns.forEach(col => {
            drawPdfCell(doc, row[col.key], cellX, y, col.width, rowHeight, {
              fill: index % 2 === 0 ? [255, 255, 255] : [245, 250, 252],
              fontSize: 7,
              align: col.align || 'left'
            })
            cellX += col.width
          })
          y += rowHeight
        })

        y += 10
      }

      drawSectionTable('Setores com mais demanda', [
        { label: 'Setor', key: 'setor', width: 72 },
        { label: 'Chamados', key: 'total', width: 28, align: 'center' },
        { label: 'Aguardando', key: 'waiting', width: 32, align: 'center' },
        { label: 'Atrasos', key: 'delayed', width: 28, align: 'center' },
        { label: 'Concluídos', key: 'finished', width: 32, align: 'center' }
      ], sectorDemand.slice(0, 8).map(item => ({
        setor: item.sector.name,
        total: item.total,
        waiting: item.waiting,
        delayed: item.delayed,
        finished: item.finished
      })))

      drawSectionTable('Destaques da equipe', [
        { label: 'Maqueiro', key: 'maqueiro', width: 58 },
        { label: 'Transportes', key: 'total', width: 28, align: 'center' },
        { label: 'Concluídos', key: 'completed', width: 28, align: 'center' },
        { label: 'Atrasos', key: 'delayed', width: 24, align: 'center' },
        { label: 'SLA', key: 'sla', width: 22, align: 'center' },
        { label: 'Tempo médio', key: 'avg', width: 32 }
      ], teamRanking.slice(0, 10).map(item => ({
        maqueiro: getMaqueiroName(item.maqueiro),
        total: item.total,
        completed: item.completed,
        delayed: item.delayedCount,
        sla: item.completed ? `${item.onTimePercent}%` : '-',
        avg: formatSeconds(item.avgTransportSeconds)
      })))

      drawSectionTable('Horários de pico', [
        { label: 'Faixa horária', key: 'label', width: 70 },
        { label: 'Chamados', key: 'total', width: 28, align: 'center' }
      ], peakHours.slice(0, 8))

      const totalPages = doc.internal.getNumberOfPages()
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('MoverCare - Portal do Coordenador', 14, pageHeight - 8)
        doc.text(`Página ${page} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
      }

      doc.save(`relatorio-operacao-${sanitizeFileName(operationMonthLabel)}.pdf`)
      registerAudit?.('RELATORIO', `Gerou relatório mensal da operação - ${operationMonthLabel}`, { period: operationMonth })
    } catch (error) {
      console.error('Erro ao gerar relatório geral:', error)
      alert('Não foi possível gerar o relatório geral em PDF. Verifique se o jsPDF está instalado.')
    }
  }

  return (
    <>
      <PageHeader
        title="Painel do Coordenador"
        subtitle="Visão geral em tempo real das operações de transporte"
        profile={profile}
        right={
          <div className="live-update">
            <span>Atualizado agora</span>
            <b>A vivo</b>
            <button onClick={refreshData} disabled={loading}>↻</button>
          </div>
        }
      />

      <section className="metrics-row">
        <MetricCard label="Chamados abertos" value={dashboardStats?.calls_today ?? 0} sub="hoje" tone="teal" />
        <MetricCard label="Aguardando aceite" value={counters.aguardando} sub="precisam de ação" tone="blue" />
        <MetricCard label="Em andamento" value={dashboardStats?.active_calls ?? 0} sub="operação ativa" tone="teal" />
        <MetricCard label="Atrasados" value={dashboardStats?.delayed_calls ?? 0} sub="SLA crítico" tone="red" />
        <MetricCard label="Maqueiros disponíveis" value={counters.disponiveis} sub="para atribuição" tone="teal" />
        <MetricCard label="Maqueiros ocupados" value={dashboardStats?.busy_maqueiros ?? 0} sub="em transporte" tone="amber" />
        <MetricCard label="SLA no prazo" value={`${slaSummary.onTimePercent}%`} sub={`${slaSummary.onTime}/${calls.filter(c => c.accept_deadline_at).length || 0} chamados`} tone="teal" />
        <MetricCard label="Tempo médio aceite" value={formatSeconds(slaSummary.avgAcceptSeconds)} sub="média geral" tone="blue" />
        <MetricCard label="Tempo médio transporte" value={formatSeconds(slaSummary.avgTransportSeconds)} sub="origem até destino" tone="amber" />
      </section>

      <section className="coord-intelligence-grid">
        <CoordinatorAlertPanel alerts={intelligentAlerts} onNavigate={onNavigate} />
        <UnassignedCallsPanel
          calls={unassignedCalls}
          maqueiros={maqueiros}
          selectedMaqueiroByCall={selectedMaqueiroByCall}
          setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
          reassignCall={reassignCall}
          loading={loading}
          onNavigate={onNavigate}
        />

        <section className="panel coord-month-report-card">
          <div className="coord-panel-head compact">
            <div>
              <span className="section-kicker">Relatório</span>
              <h2>Operação mensal</h2>
            </div>
          </div>

          <div className="operation-report-controls">
            <label>
              <span>Mês do relatório</span>
              <input type="month" value={operationMonth} onChange={(event) => setOperationMonth(event.target.value || getCurrentMonthValue())} />
            </label>
            <button type="button" onClick={handleOperationReportPdf}>Gerar PDF geral</button>
          </div>

          <div className="operation-report-mini">
            <div><small>Chamados</small><strong>{monthlyCalls.length}</strong></div>
            <div><small>SLA</small><strong>{monthlySlaSummary.onTimePercent}%</strong></div>
            <div><small>Atrasos</small><strong>{monthlySlaSummary.delayed}</strong></div>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <section className="coord-insights-grid">
            <TeamHighlightsPanel ranking={teamRanking} />
            <SectorDemandPanel items={sectorDemand} />
          </section>

          <div className="panel table-panel">
            <div className="panel-title-row">
              <div>
                <h2>Chamados em tempo real</h2>
                <span className="count-badge">{calls.length}</span>
              </div>

              <div className="filter-row">
                <button className="filter-button" onClick={() => onNavigate('calls')}>Abrir filtros</button>
              </div>
            </div>

            <CallRows
              calls={visibleCalls}
              maqueiros={maqueiros}
              selectedMaqueiroByCall={selectedMaqueiroByCall}
              setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
              reassignCall={reassignCall}
              loading={loading}
              compact
              onOpenDetails={openCallDetails}
              onCancelCall={cancelCall}
            />

            <div className="table-footer">
              <span>Mostrando 1 a {visibleCalls.length} de {calls.length} chamados</span>
              <button onClick={() => onNavigate('calls')}>Ver todos os chamados</button>
            </div>
          </div>

          <div className="quick-card-row">
            <button onClick={() => onNavigate('calls')}>Reatribuir <small>Selecionar e reatribuir chamado</small></button>
            <button onClick={() => onNavigate('maqueiros')}>Histórico dos maqueiros <small>Ver progresso e relatório individual</small></button>
            <button onClick={() => onNavigate('sectors')}>Setores <small>Gerenciar setores e QR Codes</small></button>
            <button onClick={() => onNavigate('qrcodes')}>QR Codes <small>Imprimir códigos físicos</small></button>
          </div>
        </div>

        <aside className="right-column">
          <PeakHoursPanel peaks={peakHours} />

          <div className="panel side-panel">
            <h3>Maqueiros em tempo real <span>{maqueiros.length}</span></h3>
            <div className="team-mini-table">
              {visibleTeam.map(m => (
                <div key={m.id}>
                  <span className="mini-avatar">{String(m.full_name || 'M').slice(0, 1).toUpperCase()}</span>
                  <strong>{m.full_name}</strong>
                  <small>{m.current_sector_name || '-'}</small>
                  <StatusPill value={m.status || 'SEM_STATUS'} />
                </div>
              ))}
            </div>
            <button className="full-link" onClick={() => onNavigate('maqueiros')}>Ver todos os maqueiros</button>
          </div>

          <div className="panel side-panel">
            <h3>Mapa de setores <span>Ao vivo</span></h3>
            <SectorMapVisual sectors={sectors} maqueiros={maqueiros} calls={calls} compact onSelectSector={() => onNavigate('map')} />
            <button className="full-link" onClick={() => onNavigate('map')}>Abrir mapa completo</button>
          </div>
        </aside>
      </section>
    </>
  )
}
function CallsPage({
  calls,
  maqueiros,
  sectors,
  statusFilter,
  setStatusFilter,
  selectedMaqueiroByCall,
  setSelectedMaqueiroByCall,
  reassignCall,
  loading,
  profile,
  refreshData,
  openCallDetails,
  cancelCall
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('TODOS')
  const [riskFilter, setRiskFilter] = useState('TODOS')
  const [sectorFilter, setSectorFilter] = useState('TODOS')

  const filteredCalls = useMemo(() => {
    const cleanSearch = normalizeText(searchTerm)

    return calls.filter(call => {
      if (priorityFilter !== 'TODOS' && call.priority !== priorityFilter) return false
      if (riskFilter !== 'TODOS' && call.risk !== riskFilter) return false

      if (sectorFilter !== 'TODOS') {
        const originId = call.origin?.id || call.origin_sector_id
        const destinationId = call.destination?.id || call.destination_sector_id
        if (originId !== sectorFilter && destinationId !== sectorFilter) return false
      }

      if (cleanSearch) {
        const searchable = [
          call.number,
          call.patient_code,
          call.origin?.name,
          call.destination?.name,
          call.priority,
          call.risk,
          call.status,
          formatValue(call.status),
          call.maqueiro?.full_name,
          call.observation,
          call.created_at,
          call.assigned_at,
          call.accepted_at,
          call.qr_origin_read_at,
          call.qr_destination_read_at,
          call.completed_at,
          formatSeconds(getCallSla(call).acceptSeconds),
          formatSeconds(getCallSla(call).transportSeconds),
          formatSeconds(getCallSla(call).totalSeconds)
        ].map(normalizeText).join(' | ')

        if (!searchable.includes(cleanSearch)) return false
      }

      return true
    })
  }, [calls, searchTerm, priorityFilter, riskFilter, sectorFilter])

  function clearFilters() {
    setSearchTerm('')
    setStatusFilter('TODOS')
    setPriorityFilter('TODOS')
    setRiskFilter('TODOS')
    setSectorFilter('TODOS')
  }

  const hasFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'TODOS' ||
    priorityFilter !== 'TODOS' ||
    riskFilter !== 'TODOS' ||
    sectorFilter !== 'TODOS'

  const slaSummary = buildSlaSummary(filteredCalls)

  return (
    <>
      <PageHeader
        title="Chamados"
        subtitle="Gerencie a fila operacional, aceite, timeout e reatribuição"
        profile={profile}
        right={
          <>
            <button onClick={refreshData} disabled={loading}>Atualizar</button>
          </>
        }
      />

      <section className="panel table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Filtros de chamados</h2>
            <span className="count-badge">{filteredCalls.length} resultado{filteredCalls.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="sla-summary-row">
          <MetricCard label="Total filtrado" value={slaSummary.total} sub="chamados" tone="teal" />
          <MetricCard label="SLA no prazo" value={`${slaSummary.onTimePercent}%`} sub={`${slaSummary.onTime} no prazo`} tone="teal" />
          <MetricCard label="SLA estourado" value={slaSummary.delayed} sub="fora do prazo" tone="red" />
          <MetricCard label="Média aceite" value={formatSeconds(slaSummary.avgAcceptSeconds)} sub="tempo médio" tone="blue" />
          <MetricCard label="Média transporte" value={formatSeconds(slaSummary.avgTransportSeconds)} sub="origem → destino" tone="amber" />
        </div>

        <div className="filter-row filters-working-row">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por protocolo, paciente, origem, destino ou maqueiro..."
          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {ALL_CALL_STATUSES.map(status => (
              <option key={status} value={status}>{formatValue(status)}</option>
            ))}
          </select>

          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
            <option value="TODOS">Todos os setores</option>
            {sectors.map(sector => (
              <option key={sector.id} value={sector.id}>{sector.name}</option>
            ))}
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="TODOS">Todas prioridades</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENTE">Urgente</option>
            <option value="CRITICO">Crítico</option>
          </select>

          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="TODOS">Todos os riscos</option>
            <option value="BAIXO">Baixo</option>
            <option value="MEDIO">Médio</option>
            <option value="ALTO">Alto</option>
          </select>

          <button className={hasFilters ? 'filter-button active' : 'filter-button'} onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>

        <CallRows
          calls={filteredCalls}
          maqueiros={maqueiros}
          selectedMaqueiroByCall={selectedMaqueiroByCall}
          setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
          reassignCall={reassignCall}
          loading={loading}
          onOpenDetails={openCallDetails}
          onCancelCall={cancelCall}
        />
      </section>
    </>
  )
}


function getCallReferenceDate(call) {
  return call.completed_at || call.created_at || call.assigned_at || null
}

function getCurrentMonthValue() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

function isSameMonth(dateString, monthValue) {
  if (!dateString || !monthValue) return false

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return false

  const [year, month] = monthValue.split('-').map(Number)
  return date.getFullYear() === year && date.getMonth() + 1 === month
}

function getMonthLabel(monthValue = getCurrentMonthValue()) {
  if (!monthValue) return 'Mês não informado'

  const [year, month] = monthValue.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function getMaqueiroName(maqueiro) {
  return maqueiro?.full_name || maqueiro?.name || 'Maqueiro'
}

function getMaqueiroCallsForMonth(maqueiro, calls, monthValue) {
  return calls
    .filter(call => {
      const assignedId = call.assigned_maqueiro_id || call.maqueiro?.id
      if (assignedId !== maqueiro.id) return false

      return isSameMonth(getCallReferenceDate(call), monthValue)
    })
    .slice()
    .sort((a, b) => {
      const dateA = new Date(getCallReferenceDate(a) || 0).getTime()
      const dateB = new Date(getCallReferenceDate(b) || 0).getTime()
      return dateB - dateA
    })
}

function buildMaqueiroMonthlyProgress(maqueiro, calls, monthValue) {
  const monthCalls = getMaqueiroCallsForMonth(maqueiro, calls, monthValue)
  const finished = monthCalls.filter(call => call.status === 'CONCLUIDO' || call.completed_at)
  const active = monthCalls.filter(call => ACTIVE_STATUSES.includes(call.status))
  const delayed = monthCalls.filter(call => {
    const sla = getCallSla(call)
    return call.status === 'ATRASADO' || sla.deadlineTone === 'danger-soft'
  })

  const totalSeconds = finished
    .map(call => getCallSla(call).totalSeconds)
    .filter(value => Number.isFinite(value))

  const transportSeconds = finished
    .map(call => getCallSla(call).transportSeconds)
    .filter(value => Number.isFinite(value))

  const acceptSeconds = monthCalls
    .map(call => getCallSla(call).acceptSeconds)
    .filter(value => Number.isFinite(value))

  const totalOperationSeconds = totalSeconds.reduce((sum, value) => sum + value, 0)
  const onTime = finished.filter(call => getCallSla(call).deadlineTone !== 'danger-soft')
  const onTimePercent = finished.length ? Math.round((onTime.length / finished.length) * 100) : 0

  return {
    maqueiro,
    monthCalls,
    finished,
    active,
    delayed,
    total: monthCalls.length,
    completed: finished.length,
    activeCount: active.length,
    delayedCount: delayed.length,
    avgAcceptSeconds: averageSeconds(acceptSeconds),
    avgTransportSeconds: averageSeconds(transportSeconds),
    avgTotalSeconds: averageSeconds(totalSeconds),
    totalOperationSeconds,
    onTimePercent,
    lastCall: monthCalls[0] || null
  }
}


function sanitizeFileName(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function safePdfText(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function getPdfDateTime() {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date())
}


function splitPdfText(doc, value, maxWidth) {
  return doc.splitTextToSize(safePdfText(value), maxWidth)
}

function drawPdfCell(doc, text, x, y, width, height, options = {}) {
  const {
    fill = null,
    textColor = [15, 23, 42],
    fontStyle = 'normal',
    fontSize = 8,
    align = 'left'
  } = options

  if (fill) {
    doc.setFillColor(...fill)
    doc.rect(x, y, width, height, 'F')
  }

  doc.setDrawColor(220, 232, 239)
  doc.setLineWidth(0.15)
  doc.rect(x, y, width, height)

  doc.setTextColor(...textColor)
  doc.setFont('helvetica', fontStyle)
  doc.setFontSize(fontSize)

  const padding = 2
  const lines = splitPdfText(doc, text, width - padding * 2).slice(0, 2)
  const textX = align === 'center' ? x + width / 2 : x + padding
  doc.text(lines, textX, y + 5, { align })
}

function ensurePdfPageSpace(doc, y, neededHeight, pageWidth, pageHeight) {
  if (y + neededHeight <= pageHeight - 14) return y

  doc.addPage()
  doc.setFillColor(6, 43, 88)
  doc.rect(0, 0, pageWidth, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Relatório de maqueiros', 14, 10)
  return 22
}

function ProgressKpi({ label, value, helper }) {
  return (
    <article className="maqueiro-progress-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </article>
  )
}

function MaqueiroProgressCard({ progress, onOpenHistory }) {
  const { maqueiro, total, completed, activeCount, delayedCount, avgTransportSeconds, totalOperationSeconds, onTimePercent, lastCall } = progress
  const initials = String(getMaqueiroName(maqueiro)).slice(0, 1).toUpperCase()
  const efficiencyTone = onTimePercent >= 90 ? 'ok' : onTimePercent >= 70 ? 'warn' : 'danger'

  return (
    <article className="maqueiro-progress-card">
      <div className="maqueiro-progress-card-head">
        <div className="person-cell">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{getMaqueiroName(maqueiro)}</strong>
            <small>{maqueiro.current_sector_name || getSectorNameFromMaqueiro(maqueiro) || 'Sem setor informado'}</small>
          </div>
        </div>

        <StatusPill value={maqueiro.status || 'SEM_STATUS'} />
      </div>

      <div className="maqueiro-progress-numbers">
        <div>
          <small>Transportes</small>
          <strong>{total}</strong>
        </div>

        <div>
          <small>Concluídos</small>
          <strong>{completed}</strong>
        </div>

        <div>
          <small>Em andamento</small>
          <strong>{activeCount}</strong>
        </div>

        <div>
          <small>Atrasos</small>
          <strong className={delayedCount > 0 ? 'danger-text' : ''}>{delayedCount}</strong>
        </div>
      </div>

      <div className="maqueiro-progress-bars">
        <div>
          <span>
            <b>SLA no prazo</b>
            <small>{completed ? `${onTimePercent}%` : 'Sem concluídos'}</small>
          </span>
          <em>
            <i className={efficiencyTone} style={{ width: `${Math.max(0, Math.min(100, onTimePercent))}%` }} />
          </em>
        </div>
      </div>

      <div className="maqueiro-progress-details">
        <div>
          <small>Tempo médio transporte</small>
          <strong>{formatSeconds(avgTransportSeconds)}</strong>
        </div>

        <div>
          <small>Tempo total</small>
          <strong>{formatSeconds(totalOperationSeconds)}</strong>
        </div>
      </div>

      {lastCall ? (
        <div className="maqueiro-progress-last">
          <small>Último transporte</small>
          <strong>#{lastCall.number} • {formatValue(lastCall.status)}</strong>
          <span>{lastCall.origin?.name || '-'} → {lastCall.destination?.name || '-'}</span>
        </div>
      ) : (
        <div className="maqueiro-progress-last empty">
          <small>Último transporte</small>
          <strong>Nenhum registro neste mês</strong>
        </div>
      )}

      <button type="button" className="maqueiro-history-button" onClick={() => onOpenHistory?.(maqueiro.id)}>
        Ver histórico
      </button>
    </article>
  )
}


function MaqueirosPage({ maqueiros, calls, profile, refreshData, loading, registerAudit }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue())
  const [historyMaqueiroId, setHistoryMaqueiroId] = useState(null)
  const selectedMonthLabel = getMonthLabel(selectedMonth)

  const progressList = useMemo(() => {
    return maqueiros
      .map(maqueiro => buildMaqueiroMonthlyProgress(maqueiro, calls, selectedMonth))
      .sort((a, b) => b.completed - a.completed || b.total - a.total || getMaqueiroName(a.maqueiro).localeCompare(getMaqueiroName(b.maqueiro)))
  }, [maqueiros, calls, selectedMonth])

  const totalTransports = progressList.reduce((sum, item) => sum + item.total, 0)
  const totalCompleted = progressList.reduce((sum, item) => sum + item.completed, 0)
  const totalDelayed = progressList.reduce((sum, item) => sum + item.delayedCount, 0)
  const totalOperationSeconds = progressList.reduce((sum, item) => sum + item.totalOperationSeconds, 0)
  const avgTeamTransport = averageSeconds(
    progressList
      .map(item => item.avgTransportSeconds)
      .filter(value => Number.isFinite(value))
  )
  const bestPerformer = progressList.find(item => item.completed > 0)
  const historyProgress = progressList.find(item => item.maqueiro.id === historyMaqueiroId)

  function handleDownloadPdf() {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const generatedAt = getPdfDateTime()

      doc.setFillColor(6, 43, 88)
      doc.rect(0, 0, pageWidth, 30, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Relatório de desempenho dos maqueiros', 14, 13)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Período: ${selectedMonthLabel}`, 14, 22)
      doc.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 22, { align: 'right' })

      let y = 40

      doc.setTextColor(6, 43, 88)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Resumo geral', 14, y)
      y += 6

      const summaryCards = [
        ['Transportes', safePdfText(totalTransports)],
        ['Concluídos', safePdfText(totalCompleted)],
        ['Atrasos', safePdfText(totalDelayed)],
        ['Tempo médio', safePdfText(formatSeconds(avgTeamTransport))],
        ['Tempo total', safePdfText(formatSeconds(totalOperationSeconds))]
      ]

      const cardGap = 4
      const cardWidth = (pageWidth - 28 - cardGap * (summaryCards.length - 1)) / summaryCards.length
      summaryCards.forEach(([label, value], index) => {
        const x = 14 + index * (cardWidth + cardGap)
        doc.setFillColor(245, 250, 252)
        doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'F')
        doc.setDrawColor(220, 232, 239)
        doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'S')
        doc.setTextColor(100, 116, 139)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text(label.toUpperCase(), x + 3, y + 7)
        doc.setTextColor(6, 43, 88)
        doc.setFontSize(13)
        doc.text(value, x + 3, y + 16)
      })

      y += 34

      if (bestPerformer) {
        doc.setFillColor(235, 251, 252)
        doc.roundedRect(14, y, pageWidth - 28, 13, 3, 3, 'F')
        doc.setTextColor(6, 43, 88)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(
          `Destaque do período: ${getMaqueiroName(bestPerformer.maqueiro)} • ${bestPerformer.completed} concluído(s) • ${bestPerformer.onTimePercent}% no prazo`,
          18,
          y + 8
        )
        y += 21
      }

      doc.setTextColor(6, 43, 88)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Detalhamento por maqueiro', 14, y)
      y += 6

      const columns = [
        { label: 'Maqueiro', key: 'maqueiro', width: 34 },
        { label: 'Setor', key: 'setor', width: 30 },
        { label: 'Status', key: 'status', width: 23 },
        { label: 'Transp.', key: 'transportes', width: 16, align: 'center' },
        { label: 'Conc.', key: 'concluidos', width: 15, align: 'center' },
        { label: 'Andam.', key: 'andamento', width: 16, align: 'center' },
        { label: 'Atrasos', key: 'atrasos', width: 16, align: 'center' },
        { label: 'SLA', key: 'sla', width: 14, align: 'center' },
        { label: 'Médio', key: 'medio', width: 20 },
        { label: 'Total', key: 'total', width: 20 },
        { label: 'Último transporte', key: 'ultimo', width: 52 }
      ]

      const rows = progressList.map((item) => ({
        maqueiro: getMaqueiroName(item.maqueiro),
        setor: item.maqueiro.current_sector_name || getSectorNameFromMaqueiro(item.maqueiro) || '-',
        status: formatValue(item.maqueiro.status || 'SEM_STATUS'),
        transportes: item.total,
        concluidos: item.completed,
        andamento: item.activeCount,
        atrasos: item.delayedCount,
        sla: item.completed ? `${item.onTimePercent}%` : '-',
        medio: formatSeconds(item.avgTransportSeconds),
        total: formatSeconds(item.totalOperationSeconds),
        ultimo: item.lastCall ? `#${item.lastCall.number} - ${formatValue(item.lastCall.status)}` : '-'
      }))

      if (rows.length === 0) {
        doc.setTextColor(100, 116, 139)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text('Nenhum dado encontrado para o período selecionado.', 14, y + 8)
      } else {
        const rowHeight = 10
        const headerHeight = 9

        y = ensurePdfPageSpace(doc, y, headerHeight + rowHeight, pageWidth, pageHeight)

        let x = 14
        columns.forEach((col) => {
          drawPdfCell(doc, col.label, x, y, col.width, headerHeight, {
            fill: [6, 43, 88],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            align: col.align || 'left'
          })
          x += col.width
        })
        y += headerHeight

        rows.forEach((row, rowIndex) => {
          y = ensurePdfPageSpace(doc, y, rowHeight, pageWidth, pageHeight)

          let cellX = 14
          columns.forEach((col) => {
            drawPdfCell(doc, row[col.key], cellX, y, col.width, rowHeight, {
              fill: rowIndex % 2 === 0 ? [255, 255, 255] : [245, 250, 252],
              textColor: [15, 23, 42],
              fontSize: 7,
              align: col.align || 'left'
            })
            cellX += col.width
          })
          y += rowHeight
        })
      }

      const totalPages = doc.internal.getNumberOfPages()
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('MoverCare - Portal do Coordenador', 14, pageHeight - 8)
        doc.text(`Página ${page} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
      }

      doc.save(`relatorio-maqueiros-${sanitizeFileName(selectedMonthLabel)}.pdf`)
      registerAudit?.('RELATORIO', `Gerou relatório de maqueiros - ${selectedMonthLabel}`, { period: selectedMonth })
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Não foi possível gerar o PDF. Verifique se a biblioteca jsPDF foi instalada com: npm install jspdf')
    }
  }

  return (
    <>
      <PageHeader
        title="Maqueiros"
        subtitle="Acompanhe status, produtividade mensal, tempo de transporte e evolução da equipe"
        profile={profile}
        right={<button onClick={refreshData} disabled={loading}>Atualizar</button>}
      />

      <section className="panel maqueiro-progress-panel maqueiro-report-area">
        <div className="maqueiro-progress-title">
          <div>
            <span className="section-kicker">Desempenho mensal</span>
            <h2>Progresso dos maqueiros</h2>
            <p>Resumo de {selectedMonthLabel} com quantidade de transportes, tempo médio, atrasos e últimos atendimentos.</p>
          </div>

          <div className="maqueiro-report-actions no-pdf">
            <label>
              <span>Filtrar mês</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value || getCurrentMonthValue())
                  setHistoryMaqueiroId(null)
                }}
              />
            </label>

            <button type="button" className="light-button" onClick={() => {
              setSelectedMonth(getCurrentMonthValue())
              setHistoryMaqueiroId(null)
            }}>
              Mês atual
            </button>

            <button type="button" onClick={handleDownloadPdf}>
              Gerar PDF
            </button>
          </div>

          <span className="month-badge pdf-only">{selectedMonthLabel}</span>
        </div>

        <div className="maqueiro-progress-summary">
          <ProgressKpi label="Transportes do período" value={totalTransports} helper={`${totalCompleted} concluídos`} />
          <ProgressKpi label="Tempo médio transporte" value={formatSeconds(avgTeamTransport)} helper="média da equipe" />
          <ProgressKpi label="Tempo total operacional" value={formatSeconds(totalOperationSeconds)} helper="soma dos concluídos" />
          <ProgressKpi label="Atrasos no período" value={totalDelayed} helper="SLA estourado ou atrasado" />
        </div>

        {bestPerformer && (
          <div className="maqueiro-progress-highlight">
            <span>🏆 Destaque do período</span>
            <strong>{getMaqueiroName(bestPerformer.maqueiro)}</strong>
            <small>{bestPerformer.completed} transporte{bestPerformer.completed === 1 ? '' : 's'} concluído{bestPerformer.completed === 1 ? '' : 's'} • {bestPerformer.onTimePercent}% no prazo</small>
          </div>
        )}

        <div className="maqueiro-progress-grid">
          {progressList.length === 0 && <div className="empty-row">Nenhum maqueiro encontrado.</div>}

          {progressList.map(progress => (
            <MaqueiroProgressCard key={progress.maqueiro.id} progress={progress} onOpenHistory={setHistoryMaqueiroId} />
          ))}
        </div>
      </section>

      {historyProgress && (
        <section className="panel maqueiro-history-panel no-pdf">
          <div className="maqueiro-history-head">
            <div>
              <span className="section-kicker">Histórico individual</span>
              <h2>{getMaqueiroName(historyProgress.maqueiro)}</h2>
              <p>Transportes registrados em {selectedMonthLabel}.</p>
            </div>
            <button type="button" className="light-button" onClick={() => setHistoryMaqueiroId(null)}>Fechar</button>
          </div>

          <div className="maqueiro-history-summary">
            <ProgressKpi label="Transportes" value={historyProgress.total} helper="no período" />
            <ProgressKpi label="Concluídos" value={historyProgress.completed} helper="finalizados" />
            <ProgressKpi label="Atrasos" value={historyProgress.delayedCount} helper="SLA crítico" />
            <ProgressKpi label="Tempo total" value={formatSeconds(historyProgress.totalOperationSeconds)} helper="operação" />
          </div>

          <div className="maqueiro-history-table">
            <div className="maqueiro-history-row head">
              <span>Chamado</span>
              <span>Origem</span>
              <span>Destino</span>
              <span>Status</span>
              <span>Tempo</span>
              <span>Data</span>
            </div>

            {historyProgress.monthCalls.length === 0 && <div className="empty-row">Nenhum transporte para este maqueiro no período selecionado.</div>}

            {historyProgress.monthCalls.slice(0, 18).map(call => (
              <div className="maqueiro-history-row" key={call.id}>
                <strong>#{call.number}</strong>
                <span>{call.origin?.name || '-'}</span>
                <span>{call.destination?.name || '-'}</span>
                <StatusPill value={call.status} />
                <span>{formatSeconds(getCallSla(call).totalSeconds)}</span>
                <span>{formatDateTime(getCallReferenceDate(call))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel table-panel no-pdf">
        <div className="panel-title-row">
          <div>
            <h2>Status da equipe</h2>
            <span className="count-badge">{maqueiros.length}</span>
          </div>
        </div>

        <div className="team-table">
          <div className="team-head">
            <span>Maqueiro</span>
            <span>Setor atual</span>
            <span>Status</span>
            <span>Atualização</span>
          </div>

          {maqueiros.length === 0 && <div className="empty-row">Nenhum maqueiro encontrado.</div>}

          {maqueiros.map(m => (
            <div className="team-row" key={m.id}>
              <div className="person-cell">
                <span className="avatar">{String(m.full_name || 'M').slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{m.full_name}</strong>
                  <small>{m.id}</small>
                </div>
              </div>
              <span>{m.current_sector_name || '-'}</span>
              <StatusPill value={m.status || 'SEM_STATUS'} />
              <span>{formatTime(m.updated_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
function SectorsPage(props) {
  const {
    sectors, sectorForm, setSectorForm, sectorSaving, saveSector, generateTokenForForm,
    resetSectorForm, editSector, regenerateSectorQr, toggleSectorActive, profile
  } = props

  return (
    <>
      <PageHeader
        title="Setores"
        subtitle="Gerencie a malha operacional, ordem de proximidade e QR tokens"
        profile={profile}
      />

      <section className="panel form-panel">
        <form className="sector-form" onSubmit={saveSector}>
          <div>
            <label>Nome do setor</label>
            <input
              value={sectorForm.name}
              onChange={(e) => setSectorForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Ala 5"
              required
            />
          </div>

          <div>
            <label>Posição</label>
            <input
              type="number"
              value={sectorForm.order_position}
              onChange={(e) => setSectorForm(prev => ({ ...prev, order_position: e.target.value }))}
              placeholder="Ex: 6"
              required
            />
          </div>

          <div className="token-field">
            <label>QR Token</label>
            <div className="inline-input">
              <input
                value={sectorForm.qr_token}
                onChange={(e) => setSectorForm(prev => ({ ...prev, qr_token: e.target.value.trim() }))}
                placeholder="Gerado automaticamente se deixar vazio"
              />
              <button type="button" className="light-button" onClick={generateTokenForForm}>Gerar</button>
            </div>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={sectorForm.active}
              onChange={(e) => setSectorForm(prev => ({ ...prev, active: e.target.checked }))}
            />
            Setor ativo
          </label>

          <div className="form-actions">
            <button type="submit" disabled={sectorSaving}>{sectorForm.id ? 'Salvar' : 'Criar setor'}</button>
            <button type="button" className="light-button" onClick={resetSectorForm}>Limpar</button>
          </div>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="sector-table">
          <div className="sector-head">
            <span>Setor</span>
            <span>Ordem</span>
            <span>QR Token</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {sectors.map(sector => (
            <div className="sector-row" key={sector.id}>
              <div>
                <strong>{sector.name}</strong>
                <small>{sector.id}</small>
              </div>
              <span>{sector.order_position}</span>
              <span className="token-text">{sector.qr_token || '-'}</span>
              <span className={`status-pill ${sector.active ? 'ok' : 'muted'}`}>{sector.active ? 'Ativo' : 'Inativo'}</span>
              <div className="sector-actions">
                <button type="button" className="light-button" onClick={() => editSector(sector)}>Editar</button>
                <button type="button" className="light-button" onClick={() => regenerateSectorQr(sector)}>Novo QR</button>
                <button type="button" className={sector.active ? 'danger small' : 'small'} onClick={() => toggleSectorActive(sector)}>
                  {sector.active ? 'Inativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function QrCodesPage({ sectors, printQrCodes, profile }) {
  return (
    <>
      <PageHeader
        title="QR Codes"
        subtitle="Imprima os códigos oficiais para validar origem e destino no app"
        profile={profile}
        right={<button onClick={printQrCodes}>Imprimir QR Codes</button>}
      />

      <div className="print-title only-print">
        <h1>MoverCare - QR Codes dos Setores</h1>
        <p>Impressão oficial para leitura pelo app do maqueiro.</p>
      </div>

      <div className="qr-grid">
        {sectors.length === 0 && <div className="empty-row panel">Nenhum setor encontrado.</div>}
        {sectors.map(sector => <SectorQrCard key={sector.id} sector={sector} />)}
      </div>
    </>
  )
}


function profileField(profile, keys, fallback) {
  for (const key of keys) {
    if (profile?.[key]) return profile[key]
  }

  return fallback
}

function resolveProfileSector(profile, sectors) {
  if (profile?.sector?.name) return profile.sector.name
  if (profile?.sector_name) return profile.sector_name

  const sector = sectors.find(item => item.id === profile?.sector_id)
  if (sector?.name) return sector.name

  if (profile?.role === 'COORDENADOR' || profile?.role === 'ADMIN') return 'Coordenação'

  return 'Setor não cadastrado'
}


function NewCallPage({ sectors, profile, onCreated, onNavigate }) {
  const [form, setForm] = useState({
    patientCode: '',
    bedNumber: '',
    originSectorId: '',
    destinationSectorId: '',
    transportType: 'MACA',
    priority: 'NORMAL',
    risk: 'BAIXO',
    destinationCommunicated: false,
    teamConfirmed: false,
    equipmentConfirmed: false,
    infectionPrecaution: 'PADRAO',
    observation: ''
  })

  const [savingCall, setSavingCall] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localSuccess, setLocalSuccess] = useState('')
  const [bulkRows, setBulkRows] = useState([])
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      originSectorId: sectors.some(sector => sector.id === prev.originSectorId) ? prev.originSectorId : '',
      destinationSectorId: sectors.some(sector => sector.id === prev.destinationSectorId) ? prev.destinationSectorId : ''
    }))
  }, [sectors])

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function createCall(event) {
    event.preventDefault()
    setSavingCall(true)
    setLocalError('')
    setLocalSuccess('')

    try {
      if (!form.patientCode.trim()) {
        throw new Error('Informe o nome ou código do paciente.')
      }

      if (!form.bedNumber.trim()) {
        throw new Error('Informe o número do leito.')
      }

      if (!form.originSectorId || !form.destinationSectorId) {
        throw new Error('Informe origem e destino.')
      }

      if (form.originSectorId === form.destinationSectorId) {
        throw new Error('Origem e destino não podem ser iguais.')
      }

      if (!form.transportType || !form.priority || !form.risk || !form.infectionPrecaution) {
        throw new Error('Preencha tipo de transporte, prioridade, risco e precaução.')
      }

      if (!form.destinationCommunicated || !form.teamConfirmed || !form.equipmentConfirmed) {
        throw new Error('Confirme o checklist operacional antes de criar o chamado.')
      }

      const patientIdentifier = `${form.patientCode.trim()} | Leito ${form.bedNumber.trim()}`
      const observationWithBed = [
        `Leito: ${form.bedNumber.trim()}`,
        form.observation?.trim() ? form.observation.trim() : null
      ].filter(Boolean).join('\n')

      const { error: rpcError } = await supabase.rpc('create_transport_call', {
        p_patient_code: patientIdentifier,
        p_origin_sector_id: form.originSectorId,
        p_destination_sector_id: form.destinationSectorId,
        p_transport_type: form.transportType,
        p_priority: form.priority,
        p_risk: form.risk,
        p_destination_communicated: form.destinationCommunicated,
        p_team_confirmed: form.teamConfirmed,
        p_equipment_confirmed: form.equipmentConfirmed,
        p_infection_precaution: form.infectionPrecaution || null,
        p_observation: observationWithBed || null
      })

      if (rpcError) throw rpcError

      setLocalSuccess('Chamado criado com sucesso.')
      setForm(prev => ({
        ...prev,
        patientCode: '',
        bedNumber: '',
        transportType: 'MACA',
        priority: 'NORMAL',
        risk: 'BAIXO',
        destinationCommunicated: false,
        teamConfirmed: false,
        equipmentConfirmed: false,
        infectionPrecaution: 'PADRAO',
        observation: ''
      }))

      await onCreated()
      onNavigate('calls')
    } catch (err) {
      setLocalError(err?.message || 'Erro ao criar chamado.')
    } finally {
      setSavingCall(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Novo Chamado"
        subtitle="Criar uma nova solicitação de transporte pelo painel do coordenador"
        profile={profile}
        right={
          <button onClick={() => onNavigate('calls')} type="button">
            Ver chamados
          </button>
        }
      />

      <section className="panel new-call-panel">
        <div className="panel-title-row">
          <div>
            <h2>Dados do transporte</h2>
            <span className="count-badge">Solicitação operacional</span>
          </div>
        </div>

        {localError && <div className="error no-print">{localError}</div>}
        {localSuccess && <div className="success no-print">{localSuccess}</div>}

        <form className="new-call-form" onSubmit={createCall}>
          <label>
            <span>Nome ou código do paciente</span>
            <input
              value={form.patientCode}
              onChange={(event) => updateForm('patientCode', event.target.value)}
              placeholder="Ex.: Maria Silva, PAC-1024 ou iniciais"
              required
            />
          </label>

          <label>
            <span>Número do leito</span>
            <input
              value={form.bedNumber}
              onChange={(event) => updateForm('bedNumber', event.target.value)}
              placeholder="Ex.: 204A, 12, UTI-03"
              required
            />
          </label>

          <label>
            <span>Origem</span>
            <select
              value={form.originSectorId}
              onChange={(event) => updateForm('originSectorId', event.target.value)}
              required
            >
              <option value="">Selecione a origem</option>
              {sectors.map(sector => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Destino</span>
            <select
              value={form.destinationSectorId}
              onChange={(event) => updateForm('destinationSectorId', event.target.value)}
              required
            >
              <option value="">Selecione o destino</option>
              {sectors.map(sector => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Tipo de transporte</span>
            <select
              value={form.transportType}
              onChange={(event) => updateForm('transportType', event.target.value)}
              required
            >
              <option value="MACA">Maca</option>
              <option value="CADEIRA_RODAS">Cadeira de rodas</option>
              <option value="ACOMPANHAMENTO">Acompanhamento</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>

          <label>
            <span>Prioridade</span>
            <select
              value={form.priority}
              onChange={(event) => updateForm('priority', event.target.value)}
              required
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENTE">Urgente</option>
              <option value="CRITICO">Crítico</option>
            </select>
          </label>

          <label>
            <span>Risco</span>
            <select
              value={form.risk}
              onChange={(event) => updateForm('risk', event.target.value)}
              required
            >
              <option value="BAIXO">Baixo</option>
              <option value="MEDIO">Médio</option>
              <option value="ALTO">Alto</option>
            </select>
          </label>

          <label>
            <span>Precaução</span>
            <select
              value={form.infectionPrecaution}
              onChange={(event) => updateForm('infectionPrecaution', event.target.value)}
              required
            >
              <option value="PADRAO">Padrão</option>
              <option value="CONTATO">Contato</option>
              <option value="GOTICULAS">Gotículas</option>
              <option value="AEROSSOIS">Aerossóis</option>
              <option value="NAO_SE_APLICA">Não se aplica</option>
            </select>
          </label>

          <div className="new-call-checks">
            <label>
              <input
                type="checkbox"
                checked={form.destinationCommunicated}
                onChange={(event) => updateForm('destinationCommunicated', event.target.checked)}
                required
              />
              Destino comunicado
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.teamConfirmed}
                onChange={(event) => updateForm('teamConfirmed', event.target.checked)}
                required
              />
              Equipe confirmada
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.equipmentConfirmed}
                onChange={(event) => updateForm('equipmentConfirmed', event.target.checked)}
                required
              />
              Equipamento confirmado
            </label>
          </div>

          <label className="new-call-wide">
            <span>Observação</span>
            <textarea
              value={form.observation}
              onChange={(event) => updateForm('observation', event.target.value)}
              placeholder="Ex.: paciente em jejum, cuidado especial, acompanhante, oxigênio..."
              rows={4}
            />
          </label>

          <div className="new-call-actions">
            <button type="button" className="light-button" onClick={() => onNavigate('calls')}>
              Cancelar
            </button>

            <button type="submit" disabled={savingCall || sectors.length < 2}>
              {savingCall ? 'Criando chamado...' : 'Criar chamado'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}


const EMPLOYEE_ROLES = [
  { value: 'MAQUEIRO', label: 'Maqueiro' },
  { value: 'ENFERMEIRA', label: 'Enfermagem' },
  { value: 'COORDENADOR', label: 'Coordenador' },
  { value: 'ADMIN', label: 'Administrador' }
]

const EMPTY_EMPLOYEE_FORM = {
  id: null,
  full_name: '',
  email: '',
  phone: '',
  role: 'MAQUEIRO',
  password: '',
  active: true
}

function employeeDisplayName(employee) {
  return employee?.full_name || employee?.name || employee?.email || 'Funcionário'
}

function employeeInitials(employee) {
  return String(employeeDisplayName(employee))
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function normalizeEmployeeForm(employee = {}) {
  return {
    id: employee.id || null,
    full_name: employee.full_name || employee.name || '',
    email: employee.email || '',
    phone: employee.phone || employee.telefone || employee.phone_number || '',
    role: employee.role || 'MAQUEIRO',
    password: '',
    active: employee.active !== false
  }
}



const EMPLOYEE_BULK_TEMPLATE_ROWS = [
  ['full_name', 'email', 'phone', 'role', 'password', 'active'],
  ['João Silva', 'joao@movercare.com', '11999999999', 'MAQUEIRO', 'MoverCare@123', 'SIM'],
  ['Maria Souza', 'maria@movercare.com', '11988888888', 'ENFERMEIRA', 'MoverCare@123', 'SIM'],
  ['Carlos Lima', 'carlos@movercare.com', '11977777777', 'COORDENADOR', 'MoverCare@123', 'SIM']
]

const EMPLOYEE_BULK_HEADER_MAP = {
  full_name: 'full_name',
  fullname: 'full_name',
  nome: 'full_name',
  nomecompleto: 'full_name',
  nome_completo: 'full_name',
  name: 'full_name',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  phone: 'phone',
  telefone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  role: 'role',
  cargo: 'role',
  perfil: 'role',
  funcao: 'role',
  função: 'role',
  password: 'password',
  senha: 'password',
  senhatemporaria: 'password',
  senha_temporaria: 'password',
  active: 'active',
  ativo: 'active',
  status: 'active'
}

function normalizeBulkHeader(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9_-]/g, '')
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      insideQuotes = !insideQuotes
      continue
    }

    if ((char === ',' || char === ';') && !insideQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(current.trim())
      if (row.some(cell => String(cell || '').trim())) rows.push(row)
      row = []
      current = ''
      continue
    }

    current += char
  }

  row.push(current.trim())
  if (row.some(cell => String(cell || '').trim())) rows.push(row)

  return rows
}

function normalizeBulkRole(value) {
  const role = normalizeText(value).replace(/[^a-z0-9]/g, '')

  if (role === 'maqueiro' || role === 'maca' || role === 'maqueiros') return 'MAQUEIRO'
  if (role === 'enfermeira' || role === 'enfermagem' || role === 'enfermeiro') return 'ENFERMEIRA'
  if (role === 'coordenador' || role === 'coordenacao' || role === 'coordenação') return 'COORDENADOR'
  if (role === 'admin' || role === 'administrador') return 'ADMIN'

  return cleanText(value).toUpperCase()
}

function normalizeBulkActive(value) {
  const active = normalizeText(value)

  if (!active) return true
  if (['sim', 's', 'true', 'ativo', '1', 'yes'].includes(active)) return true
  if (['nao', 'não', 'n', 'false', 'inativo', '0', 'no'].includes(active)) return false

  return true
}

function createCsvDownload(rows, filename) {
  const csv = rows
    .map(row => row.map(cell => {
      const value = String(cell ?? '')
      return /[",;\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
    }).join(','))
    .join('\n')

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadEmployeesCsvTemplate() {
  createCsvDownload(EMPLOYEE_BULK_TEMPLATE_ROWS, 'modelo_funcionarios_movercare.csv')
}

function parseEmployeesCsv(text) {
  const rows = parseCsvText(text)

  if (rows.length < 2) {
    throw new Error('A planilha precisa ter cabeçalho e pelo menos uma linha de funcionário.')
  }

  const header = rows[0].map(cell => EMPLOYEE_BULK_HEADER_MAP[normalizeBulkHeader(cell)] || '')

  const required = ['full_name', 'email', 'role']
  const missing = required.filter(field => !header.includes(field))

  if (missing.length > 0) {
    throw new Error('Cabeçalho inválido. Use as colunas: full_name, email, phone, role, password, active.')
  }

  return rows.slice(1).map((row, index) => {
    const item = {
      line: index + 2,
      full_name: '',
      email: '',
      phone: '',
      role: 'MAQUEIRO',
      password: '',
      active: true,
      valid: true,
      error: ''
    }

    header.forEach((field, columnIndex) => {
      if (!field) return
      const value = row[columnIndex] || ''

      if (field === 'role') item.role = normalizeBulkRole(value)
      else if (field === 'active') item.active = normalizeBulkActive(value)
      else item[field] = String(value || '').trim()
    })

    if (!item.password) item.password = generateTemporaryPassword()
    item.email = item.email.toLowerCase()

    const errors = []

    if (!item.full_name) errors.push('nome vazio')
    if (!item.email || !item.email.includes('@')) errors.push('e-mail inválido')
    if (!EMPLOYEE_ROLES.some(role => role.value === item.role)) errors.push('cargo inválido')
    if (!item.password || item.password.length < 6) errors.push('senha menor que 6 caracteres')

    if (errors.length > 0) {
      item.valid = false
      item.error = errors.join(', ')
    }

    return item
  })
}

function EmployeeModal({ title, subtitle, children, onClose }) {
  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="employee-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="employee-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="employee-icon-button" onClick={onClose} aria-label="Fechar modal">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function EmployeesPage({ employees, profile, refreshEmployees, registerAudit, setGlobalSuccess, setGlobalError }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('TODOS')
  const [modalMode, setModalMode] = useState(null)
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localSuccess, setLocalSuccess] = useState('')
  const [bulkRows, setBulkRows] = useState([])
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const bulkFileInputRef = useRef(null)

  const filteredEmployees = useMemo(() => {
    const term = normalizeText(search)

    return (employees || [])
      .filter(employee => {
        const matchesSearch = !term || [
          employeeDisplayName(employee),
          employee.email,
          employee.phone,
          employee.role
        ].some(value => normalizeText(value).includes(term))

        const matchesRole = roleFilter === 'TODOS' || employee.role === roleFilter

        return matchesSearch && matchesRole
      })
      .sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b)))
  }, [employees, search, roleFilter])

  const activeCount = (employees || []).filter(employee => employee.active !== false).length
  const inactiveCount = (employees || []).filter(employee => employee.active === false).length
  const maqueiroCount = (employees || []).filter(employee => employee.role === 'MAQUEIRO').length

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function openCreateModal() {
    setForm({ ...EMPTY_EMPLOYEE_FORM, password: generateTemporaryPassword() })
    setSelectedEmployee(null)
    setLocalError('')
    setLocalSuccess('')
    setModalMode('create')
  }


  function openBulkModal() {
    setBulkRows([])
    setBulkFileName('')
    setBulkResult(null)
    setSelectedEmployee(null)
    setLocalError('')
    setLocalSuccess('')

    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = ''
    }

    setModalMode('bulk')
  }

  function openEditModal(employee) {
    setForm(normalizeEmployeeForm(employee))
    setSelectedEmployee(employee)
    setLocalError('')
    setLocalSuccess('')
    setModalMode('edit')
  }

  function openResetPasswordModal(employee) {
    setForm({ ...normalizeEmployeeForm(employee), password: generateTemporaryPassword() })
    setSelectedEmployee(employee)
    setLocalError('')
    setLocalSuccess('')
    setModalMode('reset-password')
  }

  function closeModal() {
    if (saving) return
    setModalMode(null)
    setSelectedEmployee(null)
    setForm(EMPTY_EMPLOYEE_FORM)
    setBulkRows([])
    setBulkFileName('')
    setBulkResult(null)
    setLocalError('')
    setLocalSuccess('')
  }

  function validateEmployeeForm({ requirePassword = false } = {}) {
    if (!form.full_name.trim()) throw new Error('Informe o nome completo.')
    if (!form.email.trim()) throw new Error('Informe o e-mail.')
    if (!form.email.includes('@')) throw new Error('Informe um e-mail válido.')
    if (!form.role) throw new Error('Selecione o cargo.')
    if (requirePassword && (!form.password || form.password.length < 6)) {
      throw new Error('A senha precisa ter pelo menos 6 caracteres.')
    }
  }

  async function invokeAdminUsers(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke('coordinator-admin-users', {
      body: {
        action,
        payload
      }
    })

    if (error) {
      let message = error.message || 'Erro ao chamar função segura do Supabase.'

      try {
        if (error.context) {
          const responseBody = await error.context.json()
          message = responseBody?.error || responseBody?.message || message
        }
      } catch (_parseError) {
        // Mantém a mensagem padrão se a resposta da Edge Function não vier em JSON.
      }

      throw new Error(message)
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    return data
  }

  async function handleCreateEmployee(event) {
    event.preventDefault()
    setSaving(true)
    setLocalError('')
    setLocalSuccess('')

    try {
      validateEmployeeForm({ requirePassword: true })

      await invokeAdminUsers('create', {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
        active: form.active
      })

      await refreshEmployees()
      await registerAudit?.('FUNCIONÁRIO', `Cadastrou funcionário ${form.full_name.trim()} (${form.role})`, { email: form.email, role: form.role })
      setGlobalSuccess?.('Funcionário cadastrado com sucesso.')
      setLocalSuccess('Funcionário cadastrado com sucesso.')
      closeModal()
    } catch (error) {
      setLocalError(error?.message || 'Erro ao cadastrar funcionário.')
      setGlobalError?.(error?.message || 'Erro ao cadastrar funcionário.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditEmployee(event) {
    event.preventDefault()
    if (!selectedEmployee?.id) return

    setSaving(true)
    setLocalError('')
    setLocalSuccess('')

    try {
      validateEmployeeForm()

      await invokeAdminUsers('update', {
        id: selectedEmployee.id,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        role: form.role,
        active: form.active
      })

      await refreshEmployees()
      await registerAudit?.('FUNCIONÁRIO', `Editou funcionário ${form.full_name.trim()}`, { id: selectedEmployee.id, role: form.role })
      setGlobalSuccess?.('Funcionário atualizado com sucesso.')
      closeModal()
    } catch (error) {
      setLocalError(error?.message || 'Erro ao editar funcionário.')
      setGlobalError?.(error?.message || 'Erro ao editar funcionário.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    if (!selectedEmployee?.id) return

    setSaving(true)
    setLocalError('')
    setLocalSuccess('')

    try {
      if (!form.password || form.password.length < 6) {
        throw new Error('A nova senha precisa ter pelo menos 6 caracteres.')
      }

      await invokeAdminUsers('reset-password', {
        id: selectedEmployee.id,
        password: form.password
      })

      await registerAudit?.('SENHA', `Resetou senha de ${employeeDisplayName(selectedEmployee)}`, { id: selectedEmployee.id })
      setGlobalSuccess?.('Senha redefinida com sucesso.')
      setLocalSuccess(`Senha redefinida. Informe a senha temporária: ${form.password}`)
    } catch (error) {
      setLocalError(error?.message || 'Erro ao resetar senha.')
      setGlobalError?.(error?.message || 'Erro ao resetar senha.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEmployeeActive(employee) {
    const nextActive = employee.active === false
    const label = nextActive ? 'ativar' : 'desativar'
    const ok = window.confirm(`Deseja ${label} ${employeeDisplayName(employee)}?`)
    if (!ok) return

    setSaving(true)
    setGlobalError?.('')
    setGlobalSuccess?.('')

    try {
      await invokeAdminUsers('set-active', {
        id: employee.id,
        active: nextActive
      })

      await refreshEmployees()
      await registerAudit?.('FUNCIONÁRIO', `${nextActive ? 'Ativou' : 'Desativou'} funcionário ${employeeDisplayName(employee)}`, { id: employee.id })
      setGlobalSuccess?.(nextActive ? 'Funcionário ativado.' : 'Funcionário desativado.')
    } catch (error) {
      setGlobalError?.(error?.message || 'Erro ao alterar status do funcionário.')
    } finally {
      setSaving(false)
    }
  }


  async function handleBulkFileChange(event) {
    const file = event.target.files?.[0]
    setLocalError('')
    setLocalSuccess('')
    setBulkResult(null)
    setBulkRows([])

    if (!file) return

    setBulkFileName(file.name)

    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!['csv', 'txt'].includes(extension)) {
      setLocalError('No momento o portal importa arquivo CSV. Abra o modelo no Excel/Google Sheets e salve como CSV UTF-8 antes de enviar.')
      setBulkRows([])
      setBulkResult(null)
      return
    }

    try {
      const text = await file.text()
      const rows = parseEmployeesCsv(text)
      const duplicatedEmails = new Set()
      const seenEmails = new Set()

      const checkedRows = rows.map(row => {
        if (seenEmails.has(row.email)) duplicatedEmails.add(row.email)
        seenEmails.add(row.email)
        return row
      }).map(row => {
        if (duplicatedEmails.has(row.email)) {
          return {
            ...row,
            valid: false,
            error: row.error ? `${row.error}, e-mail duplicado na planilha` : 'e-mail duplicado na planilha'
          }
        }
        return row
      })

      setBulkRows(checkedRows)

      const invalidCount = checkedRows.filter(row => !row.valid).length
      if (invalidCount > 0) {
        setLocalError(`${invalidCount} linha(s) precisam de correção antes da importação.`)
      } else {
        setLocalSuccess(`${checkedRows.length} funcionário(s) prontos para importar.`)
      }
    } catch (error) {
      setLocalError(error?.message || 'Erro ao ler planilha.')
    }
  }

  async function handleBulkImport() {
    const validRows = bulkRows.filter(row => row.valid)

    if (validRows.length === 0) {
      setLocalError('Nenhuma linha válida para importar.')
      return
    }

    const ok = window.confirm(`Deseja importar ${validRows.length} funcionário(s)?`)
    if (!ok) return

    setBulkImporting(true)
    setLocalError('')
    setLocalSuccess('')
    setBulkResult(null)

    const results = []

    try {
      for (const row of validRows) {
        try {
          await invokeAdminUsers('create', {
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            role: row.role,
            password: row.password,
            active: row.active
          })

          results.push({ ...row, status: 'ok', message: 'Importado' })
        } catch (error) {
          results.push({ ...row, status: 'error', message: error?.message || 'Erro ao importar' })
        }
      }

      const successCount = results.filter(result => result.status === 'ok').length
      const errorCount = results.length - successCount

      setBulkResult({ successCount, errorCount, rows: results })
      await refreshEmployees()
      await registerAudit?.('FUNCIONÁRIOS', `Importação em massa: ${successCount} sucesso(s), ${errorCount} erro(s)`, { total: results.length })

      if (errorCount > 0) {
        setGlobalError?.(`Importação finalizada com ${errorCount} erro(s). Veja o resultado no modal.`)
      } else {
        setGlobalSuccess?.(`${successCount} funcionário(s) importado(s) com sucesso.`)
      }
    } finally {
      setBulkImporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Funcionários"
        subtitle="Cadastre acessos para app do maqueiro, portal enfermagem e portal coordenador"
        profile={profile}
        right={
          <div className="employee-header-actions">
            <button type="button" className="light-button" onClick={openBulkModal}>Importar em massa</button>
            <button type="button" onClick={openCreateModal}>+ Novo funcionário</button>
          </div>
        }
      />

      <section className="employee-stats-grid">
        <MetricCard label="Funcionários" value={(employees || []).length} sub="Total cadastrado" tone="info" />
        <MetricCard label="Ativos" value={activeCount} sub="Podem acessar" tone="ok" />
        <MetricCard label="Inativos" value={inactiveCount} sub="Acesso bloqueado" tone="warn" />
        <MetricCard label="Maqueiros" value={maqueiroCount} sub="Operação mobile" tone="info" />
      </section>

      <section className="panel table-panel employees-panel">
        <div className="panel-title-row employees-toolbar">
          <div>
            <h2>Equipe cadastrada</h2>
            <span className="count-badge">{filteredEmployees.length}</span>
          </div>

          <div className="employee-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail, telefone..."
            />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="TODOS">Todos os cargos</option>
              {EMPLOYEE_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <button type="button" className="light-button" onClick={refreshEmployees}>Atualizar</button>
          </div>
        </div>

        <div className="employees-table">
          <div className="employees-head">
            <span>Funcionário</span>
            <span>Cargo</span>
            <span>Status</span>
            <span>Contato</span>
            <span>Ações</span>
          </div>

          {filteredEmployees.length === 0 && <div className="empty-row">Nenhum funcionário encontrado.</div>}

          {filteredEmployees.map(employee => (
            <div className="employees-row" key={employee.id}>
              <div className="person-cell">
                <span className="avatar">{employeeInitials(employee)}</span>
                <div>
                  <strong>{employeeDisplayName(employee)}</strong>
                  <small>{employee.email || 'E-mail não cadastrado'}</small>
                </div>
              </div>

              <SoftPill tone={employee.role === 'MAQUEIRO' ? 'success-soft' : employee.role === 'COORDENADOR' || employee.role === 'ADMIN' ? 'warning-soft' : 'neutral-soft'}>
                {formatValue(employee.role)}
              </SoftPill>

              <span className={`status-pill ${employee.active === false ? 'muted' : 'ok'}`}>
                {employee.active === false ? 'Inativo' : 'Ativo'}
              </span>

              <div className="employee-contact-cell">
                <strong>{employee.phone || 'Sem telefone'}</strong>
                <small>{employee.id}</small>
              </div>

              <div className="employee-actions">
                <button type="button" className="light-button small" onClick={() => openEditModal(employee)}>Editar</button>
                <button type="button" className="light-button small" onClick={() => openResetPasswordModal(employee)}>Resetar senha</button>
                <button type="button" className={employee.active === false ? 'small' : 'danger small'} onClick={() => toggleEmployeeActive(employee)} disabled={saving || employee.id === profile?.id}>
                  {employee.active === false ? 'Ativar' : 'Desativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {modalMode === 'create' && (
        <EmployeeModal title="Novo funcionário" subtitle="Cria usuário no Supabase Auth e perfil no MoverCare" onClose={closeModal}>
          <EmployeeForm
            form={form}
            updateForm={updateForm}
            saving={saving}
            localError={localError}
            localSuccess={localSuccess}
            submitLabel="Cadastrar funcionário"
            onSubmit={handleCreateEmployee}
            showPassword
            showActive
          />
        </EmployeeModal>
      )}


      {modalMode === 'bulk' && (
        <EmployeeModal title="Importar funcionários em massa" subtitle="Envie uma planilha CSV com nome, e-mail, telefone, cargo, senha e status" onClose={closeModal}>
          <div className="employee-form bulk-import-form">
            {localError && <div className="error no-print">{localError}</div>}
            {localSuccess && <div className="success no-print">{localSuccess}</div>}

            <div className="employee-warning-box">
              <strong>Modelo reconhecido pelo MoverCare</strong>
              <p>Use as colunas: full_name, email, phone, role, password, active. Os cargos aceitos são MAQUEIRO, ENFERMEIRA, COORDENADOR e ADMIN.</p>
            </div>

            <div className="bulk-import-actions">
              <button type="button" className="light-button" onClick={downloadEmployeesCsvTemplate}>Baixar modelo CSV</button>
              <input
                ref={bulkFileInputRef}
                className="bulk-hidden-file-input"
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={handleBulkFileChange}
              />

              <button
                type="button"
                className="bulk-file-input"
                onClick={() => bulkFileInputRef.current?.click()}
              >
                {bulkFileName || 'Selecionar planilha CSV'}
              </button>
            </div>

            {bulkRows.length > 0 && (
              <div className="bulk-preview-box">
                <div className="bulk-preview-head">
                  <strong>Prévia da importação</strong>
                  <span>{bulkRows.filter(row => row.valid).length} válidas • {bulkRows.filter(row => !row.valid).length} com erro</span>
                </div>

                <div className="bulk-preview-table">
                  <div className="bulk-preview-row bulk-preview-title">
                    <span>Linha</span>
                    <span>Nome</span>
                    <span>E-mail</span>
                    <span>Cargo</span>
                    <span>Status</span>
                  </div>

                  {bulkRows.slice(0, 80).map(row => (
                    <div key={`${row.line}-${row.email}`} className={`bulk-preview-row ${row.valid ? 'ok' : 'error'}`}>
                      <span>{row.line}</span>
                      <span>{row.full_name || '-'}</span>
                      <span>{row.email || '-'}</span>
                      <span>{row.role || '-'}</span>
                      <span>{row.valid ? 'OK' : row.error}</span>
                    </div>
                  ))}
                </div>

                {bulkRows.length > 80 && <small>Mostrando as primeiras 80 linhas.</small>}
              </div>
            )}

            {bulkResult && (
              <div className="bulk-result-box">
                <strong>Resultado</strong>
                <p>{bulkResult.successCount} sucesso(s) • {bulkResult.errorCount} erro(s)</p>
                {bulkResult.errorCount > 0 && (
                  <div className="bulk-result-errors">
                    {bulkResult.rows.filter(row => row.status === 'error').slice(0, 20).map(row => (
                      <small key={`${row.line}-${row.email}-error`}>Linha {row.line}: {row.email} — {row.message}</small>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="employee-modal-actions">
              <button type="button" className="light-button" onClick={closeModal} disabled={bulkImporting}>Fechar</button>
              <button type="button" onClick={handleBulkImport} disabled={bulkImporting || bulkRows.filter(row => row.valid).length === 0}>
                {bulkImporting ? 'Importando...' : 'Importar funcionários'}
              </button>
            </div>
          </div>
        </EmployeeModal>
      )}

      {modalMode === 'edit' && (
        <EmployeeModal title="Editar funcionário" subtitle={employeeDisplayName(selectedEmployee)} onClose={closeModal}>
          <EmployeeForm
            form={form}
            updateForm={updateForm}
            saving={saving}
            localError={localError}
            localSuccess={localSuccess}
            submitLabel="Salvar alterações"
            onSubmit={handleEditEmployee}
            showActive
          />
        </EmployeeModal>
      )}

      {modalMode === 'reset-password' && (
        <EmployeeModal title="Resetar senha" subtitle={employeeDisplayName(selectedEmployee)} onClose={closeModal}>
          <form className="employee-form" onSubmit={handleResetPassword}>
            {localError && <div className="error no-print">{localError}</div>}
            {localSuccess && <div className="success no-print">{localSuccess}</div>}

            <div className="employee-warning-box">
              <strong>Atenção</strong>
              <p>O coordenador não vê a senha antiga. Aqui você define uma nova senha temporária para o funcionário acessar novamente.</p>
            </div>

            <label>
              <span>Nova senha temporária</span>
              <div className="employee-password-line">
                <input
                  type="text"
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  minLength={6}
                  required
                />
                <button type="button" className="light-button" onClick={() => updateForm('password', generateTemporaryPassword())}>Gerar</button>
              </div>
            </label>

            <div className="employee-modal-actions">
              <button type="button" className="light-button" onClick={closeModal} disabled={saving}>Fechar</button>
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Resetar senha'}</button>
            </div>
          </form>
        </EmployeeModal>
      )}
    </>
  )
}


function EmployeeForm({ form, updateForm, saving, localError, localSuccess, submitLabel, onSubmit, showPassword = false, showActive = false }) {
  return (
    <form className="employee-form" onSubmit={onSubmit}>
      {localError && <div className="error no-print">{localError}</div>}
      {localSuccess && <div className="success no-print">{localSuccess}</div>}

      <label>
        <span>Nome completo</span>
        <input
          value={form.full_name}
          onChange={(event) => updateForm('full_name', event.target.value)}
          placeholder="Ex.: João Silva"
          required
        />
      </label>

      <label>
        <span>E-mail de acesso</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => updateForm('email', event.target.value)}
          placeholder="funcionario@movercare.com"
          required
        />
      </label>

      <label>
        <span>Telefone</span>
        <input
          value={form.phone}
          onChange={(event) => updateForm('phone', event.target.value)}
          placeholder="(00) 00000-0000"
        />
      </label>

      <label>
        <span>Cargo</span>
        <select value={form.role} onChange={(event) => updateForm('role', event.target.value)} required>
          {EMPLOYEE_ROLES.map(role => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </label>

      {showPassword && (
        <label>
          <span>Senha temporária</span>
          <div className="employee-password-line">
            <input
              type="text"
              value={form.password}
              onChange={(event) => updateForm('password', event.target.value)}
              minLength={6}
              required
            />
            <button type="button" className="light-button" onClick={() => updateForm('password', generateTemporaryPassword())}>Gerar</button>
          </div>
        </label>
      )}

      {showActive && (
        <label className="check-row employee-check-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => updateForm('active', event.target.checked)}
          />
          Funcionário ativo
        </label>
      )}

      <div className="employee-modal-actions">
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : submitLabel}</button>
      </div>
    </form>
  )
}

function generateTemporaryPassword() {
  const number = Math.floor(100 + Math.random() * 900)
  return `MoverCare@${number}`
}


function ProfilePage({ profile, sectors }) {
  const fullName = profileField(profile, ['full_name', 'name'], 'Usuário')
  const email = profileField(profile, ['email'], 'E-mail não cadastrado')
  const phone = profileField(profile, ['phone', 'telefone', 'phone_number'], 'Telefone não cadastrado')
  const sectorName = resolveProfileSector(profile, sectors)
  const initials = String(fullName)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  return (
    <>
      <PageHeader
        title="Perfil"
        subtitle="Dados do coordenador e informações de contato"
        profile={profile}
      />

      <section className="profile-page-grid">
        <article className="profile-hero-card">
          <div className="profile-avatar-large">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Foto de perfil" /> : initials}
          </div>

          <div>
            <span className="profile-role-badge">{formatValue(profile?.role || 'COORDENADOR')}</span>
            <h2>{fullName}</h2>
            <p>Perfil operacional vinculado ao painel de coordenação.</p>
          </div>
        </article>

        <article className="profile-info-card">
          <h3>Informações principais</h3>

          <div className="profile-info-list">
            <div>
              <small>Nome</small>
              <strong>{fullName}</strong>
            </div>

            <div>
              <small>Setor</small>
              <strong>{sectorName}</strong>
            </div>

            <div>
              <small>E-mail</small>
              <strong>{email}</strong>
            </div>

            <div>
              <small>Telefone</small>
              <strong>{phone}</strong>
            </div>
          </div>
        </article>

        <article className="profile-info-card">
          <h3>Status do acesso</h3>

          <div className="profile-status-row">
            <span className={profile?.active ? 'profile-status-dot ok' : 'profile-status-dot muted'} />
            <div>
              <strong>{profile?.active ? 'Perfil ativo' : 'Perfil inativo'}</strong>
              <small>{profile?.role || 'COORDENADOR'}</small>
            </div>
          </div>

          <p className="profile-helper-text">
            Para alterar e-mail, telefone ou foto, atualize os dados do usuário na tabela profiles.
          </p>
        </article>
      </section>
    </>
  )
}



function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function Spinner({ className = '', ...props }) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn('spinner-icon', className)}
      {...props}
    />
  )
}

function SpinnerCustom() {
  return (
    <div className="spinner-custom">
      <Spinner />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-card spinner-loading-card">
        <div className="loading-brand">
          <BrandLogo />
          <span>Carregando operação</span>
        </div>

        <div className="spinner-loading-area">
          <SpinnerCustom />
        </div>

        <h1>Preparando o MoverCare</h1>
        <p>Sincronizando chamados, maqueiros, setores e indicadores em tempo real.</p>
      </div>
    </div>
  )
}


function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activePage, setActivePage] = useState('overview')
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [cancelTargetCall, setCancelTargetCall] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [panelTheme, setPanelTheme] = useState('light')
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [calls, setCalls] = useState([])
  const [maqueiros, setMaqueiros] = useState([])
  const [employees, setEmployees] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [sectors, setSectors] = useState([])
  const [sectorForm, setSectorForm] = useState(EMPTY_SECTOR_FORM)
  const [sectorSaving, setSectorSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [selectedMaqueiroByCall, setSelectedMaqueiroByCall] = useState({})
  const [coordinatorSettings, setCoordinatorSettings] = useState(() => normalizeCoordinatorSettings(readStoredJson(COORD_SETTINGS_STORAGE_KEY, DEFAULT_COORDINATOR_SETTINGS)))
  const [auditLog, setAuditLog] = useState(() => readStoredJson(COORD_AUDIT_STORAGE_KEY, []))

  useEffect(() => {
    bootstrap()

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)

      if (newSession?.user) {
        loadProfileAndData(newSession.user.id)
      } else {
        setProfile(null)
        setCalls([])
        setMaqueiros([])
        setEmployees([])
        setDashboardStats(null)
        setSectors([])
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function bootstrap() {
    setChecking(true)
    const { data } = await supabase.auth.getSession()
    setSession(data.session)

    if (data.session?.user) {
      await loadProfileAndData(data.session.user.id)
    }

    setChecking(false)
  }

  async function loadProfileAndData(userId) {
    setError('')

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      setError(profileError.message)
      return
    }

    if (!profileData || !profileData.active || !['COORDENADOR', 'ADMIN'].includes(profileData.role)) {
      setProfile(null)
      setError('Este painel é permitido apenas para COORDENADOR ou ADMIN.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()

    const normalizedProfile = {
      ...profileData,
      email: profileData.email || userData?.user?.email || ''
    }

    setProfile(normalizedProfile)

    await Promise.all([
      loadCoordinatorSettingsFromSupabase(),
      loadAuditLogFromSupabase()
    ])

    await refreshData()
  }

  async function refreshData() {
    setLoading(true)
    setError('')

    await Promise.all([
      loadCalls(),
      loadMaqueiros(),
      loadEmployees(),
      loadDashboardStats(),
      loadSectors()
    ])

    setLoading(false)
  }

  async function loadCalls() {
    let query = supabase
      .from('transport_calls')
      .select(`
        id,
        number,
        patient_code,
        transport_type,
        priority,
        risk,
        status,
        observation,
        created_at,
        origin_sector_id,
        destination_sector_id,
        assigned_maqueiro_id,
        assigned_at,
        accept_deadline_at,
        accepted_at,
        qr_origin_read_at,
        qr_destination_read_at,
        completed_at,
        cancellation_reason,
        cancelled_at,
        cancelled_by,
        timeout_count,
        origin:origin_sector_id(id, name, qr_token),
        destination:destination_sector_id(id, name, qr_token),
        maqueiro:assigned_maqueiro_id(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(0, 999)

    if (statusFilter !== 'TODOS') {
      query = query.eq('status', statusFilter)
    }

    const { data, error: callsError } = await query

    if (callsError) {
      setError(callsError.message)
      return
    }

    setCalls(data || [])
  }

  async function loadMaqueiros() {
    const { data, error: maqueirosError } = await supabase.rpc('coordinator_get_maqueiros')

    if (maqueirosError) {
      setError(maqueirosError.message)
      return
    }

    setMaqueiros(data || [])
  }


  async function loadEmployees() {
    const { data, error: functionError } = await supabase.functions.invoke('coordinator-admin-users', {
      body: { action: 'list' }
    })

    if (!functionError && data?.employees) {
      setEmployees(data.employees)
      return
    }

    console.warn('Edge Function coordinator-admin-users indisponível:', functionError?.message || functionError)

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true, nullsFirst: false })

    if (fallbackError) {
      setEmployees([])
      setError(`Não foi possível carregar funcionários. Rode o SQL e publique a Edge Function. ${functionError?.message || fallbackError.message || ''}`)
      return
    }

    setEmployees(fallbackData || [])
  }

  async function loadDashboardStats() {
    const { data, error: statsError } = await supabase.rpc('coordinator_get_dashboard_stats')

    if (statsError) {
      setError(statsError.message)
      return
    }

    setDashboardStats(Array.isArray(data) ? data[0] : data)
  }

  async function loadSectors() {
    const { data, error: sectorsError } = await supabase.rpc('coordinator_get_sectors')

    if (sectorsError) {
      setError(sectorsError.message)
      return
    }

    setSectors(data || [])
  }

  async function loadCoordinatorSettingsFromSupabase() {
    try {
      const { data, error: settingsError } = await supabase
        .from('coordinator_settings')
        .select('settings')
        .eq('scope', 'global')
        .maybeSingle()

      if (settingsError) {
        console.warn('Configurações do coordenador ainda não estão no Supabase:', settingsError.message)
        return
      }

      const cleanSettings = normalizeCoordinatorSettings(data?.settings || DEFAULT_COORDINATOR_SETTINGS)

      setCoordinatorSettings(cleanSettings)
      writeStoredJson(COORD_SETTINGS_STORAGE_KEY, cleanSettings)

      if (!data) {
        await supabase
          .from('coordinator_settings')
          .upsert({
            scope: 'global',
            settings: cleanSettings,
            updated_by: session?.user?.id || null
          }, { onConflict: 'scope' })
      }
    } catch (settingsError) {
      console.warn('Falha ao carregar configurações do Supabase:', settingsError)
    }
  }

  async function loadAuditLogFromSupabase() {
    try {
      const { data, error: auditError } = await supabase
        .from('coordinator_audit_logs')
        .select('id, action_type, description, user_id, user_name, user_email, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (auditError) {
        console.warn('Auditoria multiusuário ainda não está no Supabase:', auditError.message)
        return
      }

      const formattedEntries = (data || []).map(entry => ({
        id: entry.id,
        type: entry.action_type,
        description: entry.description,
        user_id: entry.user_id,
        user: entry.user_name || entry.user_email || 'Coordenador',
        user_email: entry.user_email || '',
        created_at: entry.created_at,
        metadata: entry.metadata || {}
      }))

      setAuditLog(formattedEntries)
      writeStoredJson(COORD_AUDIT_STORAGE_KEY, formattedEntries)
    } catch (auditError) {
      console.warn('Falha ao carregar auditoria do Supabase:', auditError)
    }
  }

  useEffect(() => {
    if (profile) loadCalls()
  }, [statusFilter])

  useEffect(() => {
    if (!profile) return

    const refresh = () => {
      refreshData()
    }

    const callsChannel = supabase
      .channel('coordinator-transport-calls-auto-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transport_calls'
        },
        refresh
      )
      .subscribe()

    const maqueiroStatusChannel = supabase
      .channel('coordinator-maqueiro-status-auto-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maqueiro_statuses'
        },
        refresh
      )
      .subscribe()

    const sectorsChannel = supabase
      .channel('coordinator-sectors-auto-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sectors'
        },
        refresh
      )
      .subscribe()

    const settingsChannel = supabase
      .channel('coordinator-settings-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coordinator_settings'
        },
        loadCoordinatorSettingsFromSupabase
      )
      .subscribe()

    const auditChannel = supabase
      .channel('coordinator-audit-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coordinator_audit_logs'
        },
        loadAuditLogFromSupabase
      )
      .subscribe()

    const interval = window.setInterval(refresh, Math.max(5, Number(coordinatorSettings.autoRefreshSeconds) || 10) * 1000)

    const handleFocus = () => refresh()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(callsChannel)
      supabase.removeChannel(maqueiroStatusChannel)
      supabase.removeChannel(sectorsChannel)
      supabase.removeChannel(settingsChannel)
      supabase.removeChannel(auditChannel)
    }
  }, [profile, statusFilter, coordinatorSettings.autoRefreshSeconds])

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  async function registerAudit(type, description, metadata = {}) {
    const entry = buildAuditEntry(type, description, profile, metadata)

    setAuditLog(prev => {
      const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 100)
      writeStoredJson(COORD_AUDIT_STORAGE_KEY, next)
      return next
    })

    try {
      const { error: auditError } = await supabase
        .from('coordinator_audit_logs')
        .insert({
          action_type: type,
          description,
          user_id: profile?.id || session?.user?.id || null,
          user_name: profile?.full_name || profile?.name || profile?.email || 'Coordenador',
          user_email: profile?.email || '',
          metadata: metadata || {}
        })

      if (auditError) {
        console.warn('Não foi possível salvar auditoria no Supabase:', auditError.message)
        return
      }

      await loadAuditLogFromSupabase()
    } catch (auditError) {
      console.warn('Falha ao registrar auditoria no Supabase:', auditError)
    }
  }

  async function saveCoordinatorSettings(nextSettings) {
    const cleanSettings = normalizeCoordinatorSettings(nextSettings)

    setCoordinatorSettings(cleanSettings)
    writeStoredJson(COORD_SETTINGS_STORAGE_KEY, cleanSettings)

    try {
      const { error: settingsError } = await supabase
        .from('coordinator_settings')
        .upsert({
          scope: 'global',
          settings: cleanSettings,
          updated_by: profile?.id || session?.user?.id || null
        }, { onConflict: 'scope' })

      if (settingsError) {
        setError(`Não foi possível salvar no Supabase: ${settingsError.message}`)
        setSuccess('Configurações salvas apenas neste navegador. Rode o SQL de multiusuário no Supabase.')
        window.setTimeout(() => setSuccess(''), 3800)
        return
      }

      await registerAudit('CONFIGURAÇÃO', 'Atualizou configurações globais do portal do coordenador', cleanSettings)
      setSuccess('Configurações globais salvas no Supabase.')
      window.setTimeout(() => setSuccess(''), 2800)
    } catch (settingsError) {
      console.warn('Falha ao salvar configurações no Supabase:', settingsError)
      setError('Não foi possível salvar as configurações globais no Supabase.')
    }
  }

  async function clearAuditLog() {
    await loadAuditLogFromSupabase()
    setSuccess('Auditoria multiusuário atualizada.')
    window.setTimeout(() => setSuccess(''), 2200)
  }

  async function reassignCall(callId) {
    const maqueiroId = selectedMaqueiroByCall[callId]

    if (!maqueiroId) {
      alert('Selecione um maqueiro para reatribuir.')
      return
    }

    setLoading(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('coordinator_reassign_call', {
      p_call_id: callId,
      p_maqueiro_id: maqueiroId
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    const call = calls.find(item => item.id === callId)
    const maqueiro = maqueiros.find(item => item.id === maqueiroId)
    registerAudit('REATRIBUIÇÃO', `Reatribuiu chamado #${call?.number || callId} para ${getMaqueiroName(maqueiro)}`, { callId, maqueiroId })

    await refreshData()
    setLoading(false)
  }

  function openCancelCallModal(call) {
    setCancelTargetCall(call)
    setCancelReason('')
    setCancelError('')
  }

  function closeCancelCallModal() {
    if (cancelSaving) return
    setCancelTargetCall(null)
    setCancelReason('')
    setCancelError('')
  }

  async function confirmCancelCall() {
    if (!cancelTargetCall?.id) return

    const reason = cancelReason.trim()

    if (reason.length < 5) {
      setCancelError('Informe um motivo com pelo menos 5 caracteres.')
      return
    }

    setCancelSaving(true)
    setCancelError('')
    setError('')

    const { error: rpcError } = await supabase.rpc('cancel_transport_call', {
      p_call_id: cancelTargetCall.id,
      p_reason: reason
    })

    if (rpcError) {
      setCancelError(rpcError.message)
      setCancelSaving(false)
      return
    }

    await registerAudit('CANCELAMENTO', `Cancelou chamado #${cancelTargetCall.number || cancelTargetCall.id}`, {
      callId: cancelTargetCall.id,
      reason
    })

    setSuccess('Chamado cancelado com sucesso.')
    window.setTimeout(() => setSuccess(''), 2600)
    setCancelTargetCall(null)
    setCancelReason('')
    await refreshData()
    setCancelSaving(false)
  }

  function openCallDetails(callId) {
    setSelectedCallId(callId)
    setActivePage('call-detail')
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  function printQrCodes() {
    registerAudit('IMPRESSÃO', 'Abriu impressão de QR Codes dos setores', { totalSectors: sectors.length })
    window.print()
  }

  function resetSectorForm() {
    setSectorForm(EMPTY_SECTOR_FORM)
    setError('')
    setSuccess('')
  }

  function editSector(sector) {
    setSectorForm({
      id: sector.id,
      name: sector.name || '',
      order_position: sector.order_position ?? '',
      qr_token: sector.qr_token || '',
      active: Boolean(sector.active)
    })

    setActivePage('sectors')
    setSuccess('')
    setError('')
  }

  function generateTokenForForm() {
    setSectorForm(prev => ({ ...prev, qr_token: slugQrToken(prev.name) }))
  }

  async function saveSector(e) {
    e.preventDefault()
    setSectorSaving(true)
    setError('')
    setSuccess('')

    const cleanName = sectorForm.name.trim()
    const orderPosition = Number(sectorForm.order_position)

    if (!cleanName) {
      setError('Informe o nome do setor.')
      setSectorSaving(false)
      return
    }

    if (!Number.isFinite(orderPosition)) {
      setError('Informe uma posição operacional válida.')
      setSectorSaving(false)
      return
    }

    const token = sectorForm.qr_token.trim() || slugQrToken(cleanName)

    const { error: rpcError } = await supabase.rpc('coordinator_upsert_sector', {
      p_sector_id: sectorForm.id,
      p_name: cleanName,
      p_order_position: orderPosition,
      p_qr_token: token,
      p_active: sectorForm.active
    })

    if (rpcError) {
      setError(rpcError.message)
      setSectorSaving(false)
      return
    }

    setSuccess(sectorForm.id ? 'Setor atualizado com sucesso.' : 'Setor criado com sucesso.')
    registerAudit('SETOR', sectorForm.id ? `Atualizou setor ${cleanName}` : `Criou setor ${cleanName}`, { sectorId: sectorForm.id, name: cleanName })
    setSectorForm(EMPTY_SECTOR_FORM)
    await refreshData()
    setSectorSaving(false)
  }

  async function toggleSectorActive(sector) {
    setSectorSaving(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc('coordinator_upsert_sector', {
      p_sector_id: sector.id,
      p_name: sector.name,
      p_order_position: sector.order_position,
      p_qr_token: sector.qr_token,
      p_active: !sector.active
    })

    if (rpcError) {
      setError(rpcError.message)
      setSectorSaving(false)
      return
    }

    setSuccess(!sector.active ? 'Setor ativado.' : 'Setor inativado.')
    registerAudit('SETOR', !sector.active ? `Ativou setor ${sector.name}` : `Inativou setor ${sector.name}`, { sectorId: sector.id })
    await refreshData()
    setSectorSaving(false)
  }

  async function regenerateSectorQr(sector) {
    const ok = window.confirm(`Gerar novo QR token para "${sector.name}"? O QR impresso antigo deixará de funcionar.`)
    if (!ok) return

    setSectorSaving(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc('coordinator_regenerate_sector_qr', {
      p_sector_id: sector.id
    })

    if (rpcError) {
      setError(rpcError.message)
      setSectorSaving(false)
      return
    }

    setSuccess('QR token regenerado. Reimprima o QR do setor.')
    registerAudit('QR CODE', `Regenerou QR Code do setor ${sector.name}`, { sectorId: sector.id })
    await refreshData()
    setSectorSaving(false)
  }

  const selectedCall = useMemo(() => {
    return calls.find(call => call.id === selectedCallId) || null
  }, [calls, selectedCallId])

  const counters = useMemo(() => ({
    aguardando: dashboardStats?.waiting_calls ?? calls.filter(c => c.status === 'AGUARDANDO_MAQUEIRO').length,
    enviados: dashboardStats?.sent_calls ?? calls.filter(c => c.status === 'ENVIADO').length,
    transito: dashboardStats?.in_transit_calls ?? calls.filter(c => c.status === 'EM_TRANSITO').length,
    disponiveis: dashboardStats?.available_maqueiros ?? maqueiros.filter(m => m.status === 'DISPONIVEL').length
  }), [calls, maqueiros, dashboardStats])

  if (checking) return <LoadingScreen />

  if (!session || !profile) {
    return (
      <>
        <Login onLogged={bootstrap} />
        {error && <div className="floating-error">{error}</div>}
      </>
    )
  }

  return (
    <div className={`app-shell coord-shell ${sidebarCollapsed ? 'coord-shell--collapsed' : ''} ${panelTheme === 'dark' ? 'coord-shell--dark' : ''}`}>
      <aside className="sidebar no-print">
        <div className="coord-sidebar-top">
          <BrandLogo />

          <button
            type="button"
            className="coord-sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Menu size={18} />
            <span>{sidebarCollapsed ? 'Abrir' : 'Recolher'}</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          {PAGES.map(page => (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? 'active' : ''}
              onClick={() => setActivePage(page.id)}
            >
              <span>{page.mark}</span>
              <span className="sidebar-nav-label">{page.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <strong>Segurança e qualidade em cada movimento.</strong>

          <button
            type="button"
            className="coord-theme-button"
            onClick={() => setPanelTheme((current) => current === 'light' ? 'dark' : 'light')}
          >
            <span>{panelTheme === 'dark' ? '☀' : '☾'}</span>
            {panelTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>

          <button type="button" className="logout-button" onClick={logout}>
            <span>↩</span>
            Sair do painel
          </button>

          <div className="watermark-cross">+</div>
        </div>
      </aside>

      <main className="content">
        <div className="mobile-brand no-print">
          <BrandLogo />
          <div className="mobile-actions">
            <button
              type="button"
              className="coord-mobile-theme"
              onClick={() => setPanelTheme((current) => current === 'light' ? 'dark' : 'light')}
            >
              {panelTheme === 'dark' ? 'Claro' : 'Escuro'}
            </button>
            <button onClick={refreshData} disabled={loading}>Atualizar</button>
            <button type="button" className="logout-button mobile-logout" onClick={logout}>Sair</button>
          </div>
        </div>

        <div className="mobile-tabs no-print">
          {PAGES.map(page => (
            <button
              key={page.id}
              className={activePage === page.id ? 'active' : ''}
              onClick={() => setActivePage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </div>

        {error && <div className="error no-print">{error}</div>}
        {success && <div className="success no-print">{success}</div>}

        <section className={activePage === 'qrcodes' ? 'page print-page' : 'page'}>
          {activePage === 'overview' && (
            <OverviewPage
              dashboardStats={dashboardStats}
              counters={counters}
              maqueiros={maqueiros}
              calls={calls}
              sectors={sectors}
              coordinatorSettings={coordinatorSettings}
              registerAudit={registerAudit}
              onNavigate={setActivePage}
              openCallDetails={openCallDetails}
              profile={profile}
              loading={loading}
              refreshData={refreshData}
              selectedMaqueiroByCall={selectedMaqueiroByCall}
              setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
              reassignCall={reassignCall}
              cancelCall={openCancelCallModal}
            />
          )}

          {activePage === 'calls' && (
            <CallsPage
              calls={calls}
              maqueiros={maqueiros}
              sectors={sectors}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedMaqueiroByCall={selectedMaqueiroByCall}
              setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
              reassignCall={reassignCall}
              loading={loading}
              profile={profile}
              refreshData={refreshData}
              openCallDetails={openCallDetails}
              cancelCall={openCancelCallModal}
            />
          )}

          {activePage === 'call-detail' && (
            <CallDetailPage
              call={selectedCall}
              maqueiros={maqueiros}
              selectedMaqueiroByCall={selectedMaqueiroByCall}
              setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
              reassignCall={reassignCall}
              loading={loading}
              profile={profile}
              refreshData={refreshData}
              onBack={() => setActivePage('calls')}
              onCancelCall={openCancelCallModal}
            />
          )}

          {activePage === 'newcall' && (
            <NewCallPage
              sectors={sectors}
              profile={profile}
              onCreated={refreshData}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'maqueiros' && (
            <MaqueirosPage
              maqueiros={maqueiros}
              calls={calls}
              profile={profile}
              refreshData={refreshData}
              loading={loading}
              registerAudit={registerAudit}
            />
          )}

          {activePage === 'employees' && (
            <EmployeesPage
              employees={employees}
              profile={profile}
              refreshEmployees={loadEmployees}
              registerAudit={registerAudit}
              setGlobalSuccess={setSuccess}
              setGlobalError={setError}
            />
          )}

          {activePage === 'map' && (
            <SectorMapPage
              sectors={sectors}
              maqueiros={maqueiros}
              calls={calls}
              profile={profile}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'sectors' && (
            <SectorsPage
              sectors={sectors}
              sectorForm={sectorForm}
              setSectorForm={setSectorForm}
              sectorSaving={sectorSaving}
              saveSector={saveSector}
              generateTokenForForm={generateTokenForForm}
              resetSectorForm={resetSectorForm}
              editSector={editSector}
              regenerateSectorQr={regenerateSectorQr}
              toggleSectorActive={toggleSectorActive}
              profile={profile}
            />
          )}

          {activePage === 'qrcodes' && (
            <QrCodesPage sectors={sectors} printQrCodes={printQrCodes} profile={profile} />
          )}

          {activePage === 'settings' && (
            <CoordinatorSettingsPage
              settings={coordinatorSettings}
              onSave={saveCoordinatorSettings}
              auditLog={auditLog}
              onClearAudit={clearAuditLog}
              sectors={sectors}
              profile={profile}
            />
          )}

          {activePage === 'profile' && (
            <ProfilePage profile={profile} sectors={sectors} />
          )}
        </section>

        {cancelTargetCall && (
          <div className="call-cancel-modal-backdrop no-print" role="dialog" aria-modal="true">
            <div className="call-cancel-modal">
              <div className="call-cancel-modal-header">
                <div>
                  <span className="section-kicker">Cancelamento de chamado</span>
                  <h2>Cancelar chamado #{cancelTargetCall.number || '-'}</h2>
                  <p>Informe o motivo. O chamado ficará como CANCELADO e continuará no histórico.</p>
                </div>
                <button type="button" className="call-modal-close" onClick={closeCancelCallModal} aria-label="Fechar cancelamento">×</button>
              </div>

              <div className="cancel-call-summary">
                <div><small>Paciente</small><strong>{cancelTargetCall.patient_code || 'Não informado'}</strong></div>
                <div><small>Rota</small><strong>{cancelTargetCall.origin?.name || '-'} → {cancelTargetCall.destination?.name || '-'}</strong></div>
                <div><small>Status atual</small><strong>{formatValue(cancelTargetCall.status)}</strong></div>
              </div>

              <label className="cancel-reason-field">
                Motivo do cancelamento
                <textarea
                  rows={4}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Ex.: paciente não está mais no setor, exame cancelado, transporte duplicado..."
                  autoFocus
                />
              </label>

              {cancelError && <div className="error">{cancelError}</div>}

              <div className="call-cancel-modal-actions">
                <button type="button" className="light-button" onClick={closeCancelCallModal} disabled={cancelSaving}>Voltar</button>
                <button type="button" className="danger-button" onClick={confirmCancelCall} disabled={cancelSaving}>
                  {cancelSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
