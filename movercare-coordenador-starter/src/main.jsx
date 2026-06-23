import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import { LoaderIcon, SquareEqual } from 'lucide-react'
import { supabase } from './supabaseClient'
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
  { id: 'map', label: 'Mapa', mark: <LocateFixed size={24} /> },
  { id: 'sectors', label: 'Setores', mark: '▦' },
  { id: 'qrcodes', label: 'QR Codes', mark: <ScanQrCode size={24} /> },
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
      <div className="logo-cross">
        <span />
        <span />
      </div>
      <strong>Mover<span>Care</span></strong>
    </div>
  )
}

function Login({ onLogged }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    <div className="login-page">
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

          <div className="hospital-illustration">
            <div className="doctor-figure" />
            <div className="bed-figure" />
            <div className="patient-figure" />
          </div>

          <div className="feature-list">
            <div>
              <span className="line-icon">□</span>
              <strong>Segurança</strong>
              <small>Processos padronizados e rastreáveis</small>
            </div>
            <div>
              <span className="line-icon">◷</span>
              <strong>Agilidade</strong>
              <small>Fluxos inteligentes e integrados</small>
            </div>
            <div>
              <span className="line-icon">▥</span>
              <strong>Visão</strong>
              <small>Relatórios e indicadores em tempo real</small>
            </div>
          </div>
        </section>

        <form className="login-card" onSubmit={handleLogin}>
          <h2>Bem-vindo ao <span>MoverCare</span></h2>
          <p>Acesse sua conta para continuar</p>

          <label>Usuário ou e-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Digite seu usuário ou e-mail" required />

          <label>Senha</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Digite sua senha" required />

          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked />
              Lembrar de mim
            </label>
            <a>Esqueci minha senha</a>
          </div>

          {error && <div className="error">{error}</div>}

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

function CallRows({ calls, maqueiros, selectedMaqueiroByCall, setSelectedMaqueiroByCall, reassignCall, loading, compact }) {
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
            </div>
          </article>
        )
      })}
    </div>
  )
}

function OverviewPage(props) {
  const { dashboardStats, counters, maqueiros, calls, sectors, onNavigate, profile, loading, refreshData, selectedMaqueiroByCall, setSelectedMaqueiroByCall, reassignCall } = props
  const visibleCalls = calls.slice(0, 8)
  const alerts = calls.filter(c => ['ATRASADO', 'AGUARDANDO_MAQUEIRO', 'ENVIADO'].includes(c.status)).slice(0, 3)
  const visibleTeam = maqueiros.slice(0, 5)
  const slaSummary = buildSlaSummary(calls)

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
        <MetricCard label="Chamados abertos" value={dashboardStats?.calls_today ?? 0} sub="+12% vs ontem" tone="teal" />
        <MetricCard label="Aguardando aceite" value={counters.aguardando} sub="+3% vs ontem" tone="blue" />
        <MetricCard label="Em andamento" value={dashboardStats?.active_calls ?? 0} sub="+8% vs ontem" tone="teal" />
        <MetricCard label="Atrasados" value={dashboardStats?.delayed_calls ?? 0} sub="-2 vs ontem" tone="red" />
        <MetricCard label="Maqueiros disponíveis" value={counters.disponiveis} sub="do total" tone="teal" />
        <MetricCard label="Maqueiros ocupados" value={dashboardStats?.busy_maqueiros ?? 0} sub="em transporte" tone="amber" />
        <MetricCard label="SLA no prazo" value={`${slaSummary.onTimePercent}%`} sub={`${slaSummary.onTime}/${calls.filter(c => c.accept_deadline_at).length || 0} chamados`} tone="teal" />
        <MetricCard label="Tempo médio aceite" value={formatSeconds(slaSummary.avgAcceptSeconds)} sub="média geral" tone="blue" />
        <MetricCard label="Tempo médio transporte" value={formatSeconds(slaSummary.avgTransportSeconds)} sub="origem até destino" tone="amber" />
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <div className="panel table-panel">
            <div className="panel-title-row">
              <div>
                <h2>Chamados em tempo real</h2>
                <span className="count-badge">{calls.length}</span>
              </div>

              <div className="filter-row">
                <select><option>Todos os setores</option></select>
                <select><option>Todos os status</option></select>
                <button className="filter-button">Filtros</button>
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
            />

            <div className="table-footer">
              <span>Mostrando 1 a {visibleCalls.length} de {calls.length} chamados</span>
              <button onClick={() => onNavigate('calls')}>Ver todos os chamados</button>
            </div>
          </div>

          <div className="quick-card-row">
            <button onClick={() => onNavigate('calls')}>Reatribuir <small>Selecionar e reatribuir chamado</small></button>
            <button onClick={() => onNavigate('sectors')}>Setores <small>Gerenciar setores e QR Codes</small></button>
            <button onClick={() => onNavigate('qrcodes')}>QR Codes <small>Imprimir códigos físicos</small></button>
          </div>
        </div>

        <aside className="right-column">
          <div className="panel side-panel">
            <h3>Alertas críticos <span>{alerts.length}</span></h3>
            <div className="alert-list">
              {alerts.length === 0 && <div className="empty-side">Nenhum alerta crítico.</div>}
              {alerts.map(call => (
                <article key={call.id} className="alert-item">
                  <div className="alert-icon" />
                  <div>
                    <strong>Chamado #{call.number}</strong>
                    <p>{call.origin?.name || '-'} → {call.destination?.name || '-'}</p>
                  </div>
                  <small>{formatValue(call.status)}</small>
                </article>
              ))}
            </div>
          </div>

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
  refreshData
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
        />
      </section>
    </>
  )
}

function MaqueirosPage({ maqueiros, profile, refreshData, loading }) {
  return (
    <>
      <PageHeader
        title="Maqueiros"
        subtitle="Acompanhe status, localização operacional e disponibilidade da equipe"
        profile={profile}
        right={<button onClick={refreshData} disabled={loading}>Atualizar</button>}
      />

      <section className="panel table-panel">
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
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [calls, setCalls] = useState([])
  const [maqueiros, setMaqueiros] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [sectors, setSectors] = useState([])
  const [sectorForm, setSectorForm] = useState(EMPTY_SECTOR_FORM)
  const [sectorSaving, setSectorSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [selectedMaqueiroByCall, setSelectedMaqueiroByCall] = useState({})

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

    setProfile({
      ...profileData,
      email: profileData.email || userData?.user?.email || ''
    })

    await refreshData()
  }

  async function refreshData() {
    setLoading(true)
    setError('')

    await Promise.all([
      loadCalls(),
      loadMaqueiros(),
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

    const interval = window.setInterval(refresh, 10000)

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
    }
  }, [profile, statusFilter])

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
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

    await refreshData()
    setLoading(false)
  }

  function printQrCodes() {
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
    await refreshData()
    setSectorSaving(false)
  }

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
    <div className="app-shell">
      <aside className="sidebar no-print">
        <BrandLogo />

        <nav className="sidebar-nav">
          {PAGES.map(page => (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? 'active' : ''}
              onClick={() => setActivePage(page.id)}
            >
              <span>{page.mark}</span>
              {page.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <strong>Segurança e qualidade em cada movimento.</strong>

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
              onNavigate={setActivePage}
              profile={profile}
              loading={loading}
              refreshData={refreshData}
              selectedMaqueiroByCall={selectedMaqueiroByCall}
              setSelectedMaqueiroByCall={setSelectedMaqueiroByCall}
              reassignCall={reassignCall}
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
              profile={profile}
              refreshData={refreshData}
              loading={loading}
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

          {activePage === 'profile' && (
            <ProfilePage profile={profile} sectors={sectors} />
          )}
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
