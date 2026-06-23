import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  MapPin,
  PlusCircle,
  Route,
  ShieldCheck,
  X,
} from 'lucide-react';
import { createTransportCall } from '../services/movercareService';
import type { CallPriority, CreateCallForm, Sector, TransportRisk, TransportType } from '../types/movercare';
import '../styles/emergency-mode-v52.css';

interface CreateCallScreenProps {
  sectors: Sector[];
  onCreated: () => void;
}

const transportTypes: TransportType[] = ['MACA', 'CADEIRA_RODAS', 'ACOMPANHAMENTO', 'AMBULANTE', 'LEITO_HOSPITALAR', 'POLTRONA', 'INCUBADORA', 'BERCO_COMUM', 'BERCO_AQUECIDO', 'MACA_BARIATRICA', 'CADEIRA_BARIATRICA', 'PRANCHA_RIGIDA', 'ISOLAMENTO', 'OXIGENIO', 'MONITORIZADO', 'BOMBA_INFUSAO', 'VENTILACAO_MECANICA', 'UTI_MOVEL', 'NEONATAL', 'PEDIATRICO', 'OBESO_BARIATRICO', 'OUTRO'];
const priorities: CallPriority[] = ['NORMAL', 'URGENTE', 'CRITICO'];
const risks: TransportRisk[] = ['BAIXO', 'MEDIO', 'ALTO'];
const infectionPrecautions = [
  { value: 'PADRAO', label: 'Padrão' },
  { value: 'CONTATO', label: 'Contato' },
  { value: 'GOTICULAS', label: 'Gotículas' },
  { value: 'AEROSSOIS', label: 'Aerossóis' },
  { value: 'NAO_SE_APLICA', label: 'Não se aplica' },
];

function labelTransportType(value: TransportType) {
  const labels: Record<TransportType, string> = {
    MACA: 'Maca',
    CADEIRA_RODAS: 'Cadeira de rodas',
    ACOMPANHAMENTO: 'Acompanhamento',
    AMBULANTE: 'Paciente deambulando',
    LEITO_HOSPITALAR: 'Leito hospitalar',
    POLTRONA: 'Poltrona',
    INCUBADORA: 'Incubadora',
    BERCO_COMUM: 'Berço comum',
    BERCO_AQUECIDO: 'Berço aquecido',
    MACA_BARIATRICA: 'Maca bariátrica',
    CADEIRA_BARIATRICA: 'Cadeira bariátrica',
    PRANCHA_RIGIDA: 'Prancha rígida',
    ISOLAMENTO: 'Isolamento',
    OXIGENIO: 'Com oxigênio',
    MONITORIZADO: 'Monitorizado',
    BOMBA_INFUSAO: 'Com bomba de infusão',
    VENTILACAO_MECANICA: 'Ventilação mecânica',
    UTI_MOVEL: 'UTI móvel interna',
    NEONATAL: 'Neonatal',
    PEDIATRICO: 'Pediátrico',
    OBESO_BARIATRICO: 'Obeso / bariátrico',
    OUTRO: 'Outro',
  };

  return labels[value];
}

function findSectorName(sectors: Sector[], id: string) {
  return sectors.find((sector) => sector.id === id)?.name ?? '-';
}

interface SuccessModalData {
  patientCode: string;
  bedNumber: string;
  originName: string;
  destinationName: string;
  priority: CallPriority;
  risk: TransportRisk;
  transportType: TransportType;
}

interface ConfirmationModalData extends SuccessModalData {
  infectionPrecaution: string;
  observation: string;
}


function ConfirmationModal({
  data,
  loading,
  onCancel,
  onConfirm,
}: {
  data: ConfirmationModalData;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="success-modal-backdrop" role="dialog" aria-modal="true">
      <div className="success-modal confirm-modal">
        <button type="button" className="success-modal-close" onClick={onCancel} aria-label="Cancelar confirmação" disabled={loading}>
          <X size={18} />
        </button>

        <div className="confirm-icon">
          <ClipboardPlus size={34} />
        </div>

        <span className="success-kicker">Confirmar solicitação</span>
        <h2>Revise antes de enviar</h2>
        <p>
          Confira os dados do transporte. Após confirmar, o chamado será enviado para distribuição automática.
        </p>

        <div className="success-route">
          <div>
            <small>Origem</small>
            <strong>{data.originName}</strong>
          </div>
          <ArrowRight size={22} />
          <div>
            <small>Destino</small>
            <strong>{data.destinationName}</strong>
          </div>
        </div>

        <div className="confirm-summary">
          <div>
            <small>Paciente</small>
            <strong>{data.patientCode}</strong>
          </div>

          <div>
            <small>Leito</small>
            <strong>{data.bedNumber}</strong>
          </div>

          <div>
            <small>Transporte</small>
            <strong>{labelTransportType(data.transportType)}</strong>
          </div>

          <div>
            <small>Prioridade</small>
            <strong className={`confirm-priority ${data.priority.toLowerCase()}`}>{data.priority}</strong>
          </div>

          <div>
            <small>Risco</small>
            <strong className={`confirm-risk ${data.risk.toLowerCase()}`}>{data.risk}</strong>
          </div>

          <div>
            <small>Precaução</small>
            <strong>{data.infectionPrecaution}</strong>
          </div>
        </div>

        {data.observation?.trim() && (
          <div className="confirm-observation">
            <small>Observações</small>
            <p>{data.observation}</p>
          </div>
        )}

        <div className="success-actions">
          <button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Enviando...' : 'Confirmar chamado'}
          </button>
          <button type="button" className="light-button" onClick={onCancel} disabled={loading}>
            Revisar dados
          </button>
        </div>
      </div>
    </div>
  );
}


function SuccessModal({
  data,
  onClose,
  onFollow,
}: {
  data: SuccessModalData;
  onClose: () => void;
  onFollow: () => void;
}) {
  return (
    <div className="success-modal-backdrop" role="dialog" aria-modal="true">
      <div className="success-modal">
        <button type="button" className="success-modal-close" onClick={onClose} aria-label="Fechar confirmação">
          <X size={18} />
        </button>

        <div className="success-animation">
          <span className="success-pulse" />
          <div className="success-check">
            <CheckCircle2 size={42} />
          </div>
        </div>

        <span className="success-kicker">Solicitação enviada</span>
        <h2>Chamado criado com sucesso</h2>
        <p>
          O MoverCare já iniciou a distribuição automática para o maqueiro disponível mais adequado.
        </p>

        <div className="success-route">
          <div>
            <small>Origem</small>
            <strong>{data.originName}</strong>
          </div>
          <ArrowRight size={22} />
          <div>
            <small>Destino</small>
            <strong>{data.destinationName}</strong>
          </div>
        </div>

        <div className="success-summary">
          <div>
            <small>Paciente</small>
            <strong>{data.patientCode || 'Não informado'}</strong>
          </div>

          <div>
            <small>Leito</small>
            <strong>{data.bedNumber || 'Não informado'}</strong>
          </div>
          <div>
            <small>Transporte</small>
            <strong>{labelTransportType(data.transportType)}</strong>
          </div>
          <div>
            <small>Prioridade</small>
            <strong>{data.priority}</strong>
          </div>
          <div>
            <small>Risco</small>
            <strong>{data.risk}</strong>
          </div>
        </div>

        <div className="success-steps">
          <div className="active"><span />Chamado registrado</div>
          <div><span />Distribuição automática</div>
          <div><span />Aguardando aceite</div>
        </div>

        <div className="success-actions">
          <button type="button" onClick={onFollow}>
            Acompanhar chamados
          </button>
          <button type="button" className="light-button" onClick={onClose}>
            <PlusCircle size={17} />
            Criar outro
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateCallScreen({ sectors, onCreated }: CreateCallScreenProps) {
  const initialForm = useMemo<CreateCallForm>(
    () => ({
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
      observation: '',
    }),
    []
  );

  const [form, setForm] = useState<CreateCallForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<SuccessModalData | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalData | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      originSectorId: sectors.some((sector) => sector.id === current.originSectorId) ? current.originSectorId : '',
      destinationSectorId: sectors.some((sector) => sector.id === current.destinationSectorId) ? current.destinationSectorId : '',
    }));
  }, [sectors]);

  function update<K extends keyof CreateCallForm>(key: K, value: CreateCallForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function activateEmergencyMode() {
    setEmergencyMode(true);
    setError(null);
    setForm((current) => ({
      ...current,
      transportType: 'MACA',
      priority: 'CRITICO',
      risk: 'ALTO',
      destinationCommunicated: true,
      teamConfirmed: true,
      equipmentConfirmed: true,
      observation: current.observation.trim()
        ? current.observation
        : 'MODO EMERGÊNCIA: transporte crítico solicitado pela enfermagem.',
    }));
  }

  function deactivateEmergencyMode() {
    setEmergencyMode(false);
    setForm((current) => ({
      ...current,
      priority: current.priority === 'CRITICO' ? 'NORMAL' : current.priority,
      risk: current.risk === 'ALTO' ? 'BAIXO' : current.risk,
      observation: current.observation === 'MODO EMERGÊNCIA: transporte crítico solicitado pela enfermagem.' ? '' : current.observation,
    }));
  }

  function validateForm() {
    if (!form.patientCode.trim()) {
      throw new Error('Informe o nome ou código do paciente.');
    }

    if (!form.bedNumber.trim()) {
      throw new Error('Informe o número do leito.');
    }

    if (!form.originSectorId || !form.destinationSectorId) {
      throw new Error('Informe origem e destino.');
    }

    if (form.originSectorId === form.destinationSectorId) {
      throw new Error('Origem e destino não podem ser iguais.');
    }

    if (!form.transportType || !form.priority || !form.risk || !form.infectionPrecaution.trim()) {
      throw new Error('Preencha tipo de transporte, prioridade, risco e precaução.');
    }

    if (!form.destinationCommunicated || !form.teamConfirmed || !form.equipmentConfirmed) {
      throw new Error('Confirme o checklist operacional antes de solicitar o transporte.');
    }
  }

  function buildConfirmationData(): ConfirmationModalData {
    return {
      patientCode: form.patientCode.trim(),
      bedNumber: form.bedNumber.trim(),
      originName: findSectorName(sectors, form.originSectorId),
      destinationName: findSectorName(sectors, form.destinationSectorId),
      priority: form.priority,
      risk: form.risk,
      transportType: form.transportType,
      infectionPrecaution: form.infectionPrecaution,
      observation: form.observation,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      validateForm();
      setConfirmationModal(buildConfirmationData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revise os dados do chamado.');
    }
  }

  async function handleConfirmCreate() {
    setLoading(true);
    setError(null);

    try {
      validateForm();

      const modalData: SuccessModalData = {
        patientCode: form.patientCode.trim(),
        bedNumber: form.bedNumber.trim(),
        originName: findSectorName(sectors, form.originSectorId),
        destinationName: findSectorName(sectors, form.destinationSectorId),
        priority: form.priority,
        risk: form.risk,
        transportType: form.transportType,
      };

      await createTransportCall({
        ...form,
        patientCode: form.patientCode.trim(),
        bedNumber: form.bedNumber.trim(),
        observation: form.observation.trim(),
      });

      setConfirmationModal(null);
      setForm(initialForm);
      setSuccessModal(modalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar chamado.');
    } finally {
      setLoading(false);
    }
  }

  function handleFollowCalls() {
    setSuccessModal(null);
    onCreated();
  }

  return (
    <>
      <style>
        {`
          .success-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: grid;
            place-items: center;
            padding: 24px;
            background: rgba(15, 23, 42, .38);
            backdrop-filter: blur(9px);
            animation: modalBackdropIn .22s ease both;
          }

          .success-modal {
            position: relative;
            width: min(620px, 100%);
            background: white;
            border: 1px solid #dcecef;
            border-radius: 26px;
            padding: 34px;
            text-align: center;
            box-shadow: 0 30px 90px rgba(15, 23, 42, .24);
            overflow: hidden;
            animation: modalPopIn .35s cubic-bezier(.2, .9, .2, 1.15) both;
          }

          .success-modal::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 8px;
            background: linear-gradient(90deg, #00898b, #20c7c9, #f4bc1c);
          }

          .confirm-modal::before {
            background: linear-gradient(90deg, #00898b, #20c7c9, #16a34a);
          }

          .confirm-icon {
            width: 78px;
            height: 78px;
            margin: 4px auto 18px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            color: #00898b;
            background: #e9f8f8;
            border: 1px solid #cfeeee;
            box-shadow: 0 16px 36px rgba(0, 137, 139, .14);
          }

          .success-modal-close {
            position: absolute;
            right: 18px;
            top: 18px;
            width: 38px;
            height: 38px;
            padding: 0;
            border-radius: 999px;
            background: #f5f8fa;
            color: #334155;
            box-shadow: none;
          }

          .success-modal-close:hover {
            background: #edf4f7;
            box-shadow: none;
          }

          .success-animation {
            position: relative;
            width: 104px;
            height: 104px;
            margin: 4px auto 18px;
            display: grid;
            place-items: center;
          }

          .success-pulse {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: rgba(0, 137, 139, .12);
            animation: successPulse 1.5s ease-out infinite;
          }

          .success-check {
            position: relative;
            z-index: 1;
            width: 82px;
            height: 82px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #00898b, #00a5a6);
            color: white;
            box-shadow: 0 16px 36px rgba(0, 137, 139, .26);
            animation: checkPop .42s cubic-bezier(.2, .9, .2, 1.25) .12s both;
          }

          .success-kicker {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #00898b;
            background: #e9f8f8;
            padding: 7px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .08em;
          }

          .success-modal h2 {
            margin: 16px 0 8px;
            color: #101828;
            font-size: clamp(28px, 3vw, 38px);
            letter-spacing: -1px;
          }

          .success-modal p {
            margin: 0 auto 22px;
            color: #667085;
            max-width: 460px;
            line-height: 1.55;
          }

          .success-route {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 14px;
            padding: 16px;
            border: 1px solid #dcecef;
            border-radius: 18px;
            background: linear-gradient(135deg, #f7fcfc, #ffffff);
            margin: 0 0 16px;
            color: #00898b;
          }

          .success-route div {
            display: grid;
            gap: 4px;
          }

          .success-route small,
          .success-summary small {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .04em;
          }

          .success-route strong,
          .success-summary strong {
            color: #101828;
            word-break: break-word;
          }

          .success-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }

          .confirm-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }

          .confirm-summary div,
          .confirm-observation {
            display: grid;
            gap: 4px;
            padding: 12px;
            border-radius: 14px;
            background: #fbfcfd;
            border: 1px solid #edf2f5;
            text-align: left;
          }

          .confirm-summary small,
          .confirm-observation small {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .04em;
          }

          .confirm-summary strong {
            color: #101828;
            word-break: break-word;
          }

          .confirm-priority.urgente,
          .confirm-risk.medio {
            color: #b45309;
          }

          .confirm-priority.critico,
          .confirm-risk.alto {
            color: #b42318;
          }

          .confirm-priority.normal,
          .confirm-risk.baixo {
            color: #08747c;
          }

          .confirm-observation {
            margin: 0 0 18px;
          }

          .confirm-observation p {
            margin: 0;
            color: #344054;
            max-width: none;
            text-align: left;
          }

          .success-summary div {
            display: grid;
            gap: 4px;
            padding: 12px;
            border-radius: 14px;
            background: #fbfcfd;
            border: 1px solid #edf2f5;
          }

          .success-steps {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 0 0 22px;
            color: #667085;
            font-size: 13px;
            font-weight: 800;
          }

          .success-steps div {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 10px;
            border-radius: 999px;
            background: #f5f8fa;
          }

          .success-steps span {
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: #cbd5df;
          }

          .success-steps .active {
            color: #047857;
            background: #e9f9ef;
          }

          .success-steps .active span {
            background: #22c55e;
            box-shadow: 0 0 0 5px rgba(34, 197, 94, .12);
          }

          .success-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
          }

          .success-actions button {
            min-width: 180px;
          }

          @keyframes modalBackdropIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes modalPopIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(.96);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }

          @keyframes checkPop {
            from {
              opacity: 0;
              transform: scale(.65) rotate(-8deg);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }

          @keyframes successPulse {
            0% {
              opacity: .9;
              transform: scale(.78);
            }
            70% {
              opacity: 0;
              transform: scale(1.18);
            }
            100% {
              opacity: 0;
              transform: scale(1.18);
            }
          }

          @media (max-width: 640px) {
            .success-modal {
              padding: 28px 18px;
              border-radius: 22px;
            }

            .success-summary,
            .success-steps {
              grid-template-columns: 1fr;
            }

            .success-route {
              grid-template-columns: 1fr;
            }

            .success-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <form className={emergencyMode ? "panel request-form emergency-form-active" : "panel request-form"} onSubmit={handleSubmit}>
        <div className={emergencyMode ? 'emergency-mode-top active' : 'emergency-mode-top'}>
          <div>
            <span><AlertTriangle size={18} /> Modo emergência</span>
            <strong>{emergencyMode ? 'Emergência ativada' : 'Atalho para chamado crítico'}</strong>
            <p>Preenche automaticamente maca, prioridade crítica, risco alto e checklist.</p>
          </div>

          {emergencyMode ? (
            <button type="button" onClick={deactivateEmergencyMode}>Desativar emergência</button>
          ) : (
            <button type="button" onClick={activateEmergencyMode}>Ativar emergência</button>
          )}
        </div>

        <div className="form-title">
          <span className="section-kicker"><ClipboardPlus size={14} /> Solicitação de transporte</span>
          <h2>Dados do chamado</h2>
          <p>Preencha as informações principais para acionar o maqueiro correto.</p>
        </div>

        <div className={emergencyMode ? 'emergency-mode-card active' : 'emergency-mode-card'}>
          <div className="emergency-mode-main">
            <span className="emergency-mode-icon"><AlertTriangle size={22} /></span>
            <div>
              <strong>Modo emergência</strong>
              <p>Preenche automaticamente: maca, prioridade crítica, risco alto e checklist operacional.</p>
            </div>
          </div>

          {emergencyMode ? (
            <button type="button" className="emergency-mode-secondary" onClick={deactivateEmergencyMode}>
              Desativar
            </button>
          ) : (
            <button type="button" className="emergency-mode-button" onClick={activateEmergencyMode}>
              Ativar emergência
            </button>
          )}
        </div>

        {emergencyMode && (
          <div className="emergency-mode-alert">
            <AlertTriangle size={18} />
            <span>Emergência ativa: revise paciente, leito, origem e destino antes de confirmar.</span>
          </div>
        )}

        <div className="form-grid">
          <label>

            Nome ou código do paciente

            <input

              value={form.patientCode}

              onChange={(event) => update('patientCode', event.target.value)}

              placeholder="Ex.: Maria Silva, PAC-001 ou iniciais"

              required

            />

          </label>


          <label>

            Número do leito

            <input

              value={form.bedNumber}

              onChange={(event) => update('bedNumber', event.target.value)}

              placeholder="Ex.: 204A, 12, UTI-03"

              required

            />

          </label>

          <label>
            Meio de transporte
            <select value={form.transportType} onChange={(event) => update('transportType', event.target.value as TransportType)} required>
              {transportTypes.map((item) => <option key={item} value={item}>{labelTransportType(item)}</option>)}
            </select>
          </label>

          <label>
            Origem
            <div className="input-icon">
              <MapPin size={18} />
              <select value={form.originSectorId} onChange={(event) => update('originSectorId', event.target.value)} required>
                <option value="">Selecione</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>{sector.name}</option>
                ))}
              </select>
            </div>
          </label>

          <label>
            Destino
            <div className="input-icon">
              <Route size={18} />
              <select value={form.destinationSectorId} onChange={(event) => update('destinationSectorId', event.target.value)} required>
                <option value="">Selecione</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>{sector.name}</option>
                ))}
              </select>
            </div>
          </label>

          <label>
            Prioridade operacional
            <div className="input-icon">
              <AlertTriangle size={18} />
              <select value={form.priority} onChange={(event) => update('priority', event.target.value as CallPriority)} required>
                {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </label>

          <label>
            Risco do transporte
            <div className="input-icon">
              <ShieldCheck size={18} />
              <select value={form.risk} onChange={(event) => update('risk', event.target.value as TransportRisk)} required>
                {risks.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </label>
        </div>

        <div className="form-section">
          <div>
            <h3>Checklist operacional</h3>
            <p>Confirme as etapas antes de solicitar o transporte.</p>
          </div>

          <div className="check-card-grid">
            <label className={form.destinationCommunicated ? 'check-card checked' : 'check-card'}>
              <input type="checkbox" checked={form.destinationCommunicated} onChange={(event) => update('destinationCommunicated', event.target.checked)} required />
              <CheckCircle2 size={22} />
              <strong>Destino comunicado</strong>
              <small>Equipe do destino está ciente.</small>
            </label>

            <label className={form.teamConfirmed ? 'check-card checked' : 'check-card'}>
              <input type="checkbox" checked={form.teamConfirmed} onChange={(event) => update('teamConfirmed', event.target.checked)} required />
              <CheckCircle2 size={22} />
              <strong>Equipe confirmada</strong>
              <small>Equipe mínima está preparada.</small>
            </label>

            <label className={form.equipmentConfirmed ? 'check-card checked' : 'check-card'}>
              <input type="checkbox" checked={form.equipmentConfirmed} onChange={(event) => update('equipmentConfirmed', event.target.checked)} required />
              <CheckCircle2 size={22} />
              <strong>Equipamentos confirmados</strong>
              <small>Maca/cadeira e acessórios disponíveis.</small>
            </label>
          </div>
        </div>

        <div className="form-grid bottom-grid">
          <label>
            Precaução
            <select
              value={form.infectionPrecaution}
              onChange={(event) => update('infectionPrecaution', event.target.value)}
              required
            >
              {infectionPrecautions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Observações
            <textarea
              value={form.observation}
              onChange={(event) => update('observation', event.target.value)}
              placeholder="Cuidados operacionais do transporte"
              rows={4}
            />
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="form-footer">
          <button type="submit" disabled={loading} className={loading ? 'button-loading' : ''}>
            {loading ? 'Criando...' : <><ClipboardPlus size={18} /> Solicitar transporte</>}
          </button>
          <span>O chamado será distribuído automaticamente para o maqueiro disponível mais adequado.</span>
        </div>
      </form>

      {confirmationModal && (
        <ConfirmationModal
          data={confirmationModal}
          loading={loading}
          onCancel={() => setConfirmationModal(null)}
          onConfirm={handleConfirmCreate}
        />
      )}

      {successModal && (
        <SuccessModal
          data={successModal}
          onClose={() => setSuccessModal(null)}
          onFollow={handleFollowCalls}
        />
      )}
    </>
  );
}
