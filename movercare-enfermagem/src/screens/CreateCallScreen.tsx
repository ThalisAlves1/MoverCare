import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  MapPin,
  PlusCircle,
  RefreshCw,
  Route,
  UsersRound,
  ShieldCheck,
  X,
} from 'lucide-react';

import { createTransportCall, getAvailableMaqueirosForCall } from '../services/movercareService';
import type {
  CallPriority,
  CreateCallForm,
  MaqueiroOption,
  Sector,
  TransportRisk,
  TransportType,
} from '../types/movercare';

interface CreateCallScreenProps {
  sectors: Sector[];
  onCreated: () => void;
}

const transportTypes: TransportType[] = [
  'MACA',
  'CADEIRA_RODAS',
  'ACOMPANHAMENTO',
  'AMBULANTE',
  'LEITO_HOSPITALAR',
  'POLTRONA',
  'INCUBADORA',
  'BERCO_COMUM',
  'BERCO_AQUECIDO',
  'MACA_BARIATRICA',
  'CADEIRA_BARIATRICA',
  'PRANCHA_RIGIDA',
  'ISOLAMENTO',
  'OXIGENIO',
  'MONITORIZADO',
  'BOMBA_INFUSAO',
  'VENTILACAO_MECANICA',
  'UTI_MOVEL',
  'NEONATAL',
  'PEDIATRICO',
  'OBESO_BARIATRICO',
  'OUTRO',
];

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

function labelPrecaution(value: string) {
  return infectionPrecautions.find((item) => item.value === value)?.label ?? value;
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
  assignedMaqueiroName?: string | null;
  assignedMaqueiroSector?: string | null;
  assignedMaqueiroTag?: string | null;
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
    <div className="mc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="mc-modal mc-confirm-modal">
        <button
          type="button"
          className="mc-modal-close"
          onClick={onCancel}
          aria-label="Cancelar confirmação"
          disabled={loading}
        >
          <X size={18} />
        </button>

        <div className="mc-modal-icon mc-confirm-icon">
          <ClipboardPlus size={34} />
        </div>

        <span className="mc-modal-kicker">Confirmar solicitação</span>
        <h2>Revise antes de enviar</h2>
        <p>
          Confira os dados do transporte. Após confirmar, o chamado será criado e enviado
          ao maqueiro selecionado, quando houver seleção.
        </p>

        <div className="mc-modal-route">
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

        <div className="mc-confirm-summary">
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
            <strong className={`mc-priority mc-priority-${data.priority.toLowerCase()}`}>
              {data.priority}
            </strong>
          </div>

          <div>
            <small>Risco</small>
            <strong className={`mc-risk mc-risk-${data.risk.toLowerCase()}`}>{data.risk}</strong>
          </div>

          <div>
            <small>Maqueiro</small>
            <strong>{data.assignedMaqueiroName || 'Sem atribuição'}</strong>
          </div>

          <div>
            <small>Setor do maqueiro</small>
            <strong>{data.assignedMaqueiroSector || '-'}</strong>
          </div>

          <div>
            <small>Precaução</small>
            <strong>{labelPrecaution(data.infectionPrecaution)}</strong>
          </div>
        </div>

        {data.observation?.trim() && (
          <div className="mc-observation-card">
            <small>Observações</small>
            <p>{data.observation}</p>
          </div>
        )}

        <div className="mc-modal-actions">
          <button type="button" className="mc-primary-action" onClick={onConfirm} disabled={loading}>
            {loading ? 'Enviando...' : 'Confirmar chamado'}
          </button>

          <button type="button" className="mc-secondary-action" onClick={onCancel} disabled={loading}>
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
    <div className="mc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="mc-modal">
        <button
          type="button"
          className="mc-modal-close"
          onClick={onClose}
          aria-label="Fechar confirmação"
        >
          <X size={18} />
        </button>

        <div className="mc-success-animation">
          <span className="mc-success-pulse" />
          <div className="mc-modal-icon mc-success-icon">
            <CheckCircle2 size={42} />
          </div>
        </div>

        <span className="mc-modal-kicker">Solicitação enviada</span>
        <h2>Chamado criado com sucesso</h2>
        <p>
          O MoverCare registrou a solicitação. Quando um maqueiro foi selecionado,
          o chamado já foi enviado para aceite no app.
        </p>

        <div className="mc-modal-route">
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

        <div className="mc-success-summary">
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

          <div>
            <small>Maqueiro</small>
            <strong>{data.assignedMaqueiroName || 'Sem atribuição'}</strong>
          </div>
        </div>

        <div className="mc-success-steps">
          <div className="active">
            <span />
            Chamado registrado
          </div>

          <div>
            <span />
            Maqueiro selecionado
          </div>

          <div>
            <span />
            Aguardando aceite
          </div>
        </div>

        <div className="mc-modal-actions">
          <button type="button" className="mc-primary-action" onClick={onFollow}>
            Acompanhar chamados
          </button>

          <button type="button" className="mc-secondary-action" onClick={onClose}>
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
      assignedMaqueiroId: '',
      observation: '',
    }),
    []
  );

  const [form, setForm] = useState<CreateCallForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<SuccessModalData | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalData | null>(null);
  const [availableMaqueiros, setAvailableMaqueiros] = useState<MaqueiroOption[]>([]);
  const [loadingMaqueiros, setLoadingMaqueiros] = useState(false);
  const [maqueirosError, setMaqueirosError] = useState<string | null>(null);

  const originName = form.originSectorId ? findSectorName(sectors, form.originSectorId) : 'Selecione a origem';
  const destinationName = form.destinationSectorId
    ? findSectorName(sectors, form.destinationSectorId)
    : 'Selecione o destino';

  const selectedMaqueiro = availableMaqueiros.find((maqueiro) => maqueiro.id === form.assignedMaqueiroId) ?? null;

  function maqueiroDisplayName(maqueiro?: MaqueiroOption | null) {
    return maqueiro?.full_name || maqueiro?.name || maqueiro?.email || 'Maqueiro';
  }

  function maqueiroSectorName(maqueiro?: MaqueiroOption | null) {
    return maqueiro?.current_sector_name || maqueiro?.sector_name || 'Sem setor informado';
  }

  function maqueiroTag(maqueiro?: MaqueiroOption | null) {
    if (!maqueiro) return null;
    if (maqueiro.same_origin_sector) return 'Disponível no setor de origem';
    if (maqueiro.same_destination_sector) return 'Disponível no setor de destino';
    return 'Disponível em outro setor';
  }

  async function loadAvailableMaqueiros() {
    setMaqueirosError(null);

    if (!form.originSectorId) {
      setAvailableMaqueiros([]);
      return;
    }

    setLoadingMaqueiros(true);

    try {
      const data = await getAvailableMaqueirosForCall(form.originSectorId, form.destinationSectorId || null);
      setAvailableMaqueiros(data);

      if (form.assignedMaqueiroId && !data.some((maqueiro) => maqueiro.id === form.assignedMaqueiroId)) {
        setForm((current) => ({ ...current, assignedMaqueiroId: '' }));
      }
    } catch (err) {
      setAvailableMaqueiros([]);
      setMaqueirosError(err instanceof Error ? err.message : 'Erro ao carregar maqueiros disponíveis.');
    } finally {
      setLoadingMaqueiros(false);
    }
  }

  useEffect(() => {
    setForm((current) => ({
      ...current,
      originSectorId: sectors.some((sector) => sector.id === current.originSectorId)
        ? current.originSectorId
        : '',
      destinationSectorId: sectors.some((sector) => sector.id === current.destinationSectorId)
        ? current.destinationSectorId
        : '',
    }));
  }, [sectors]);

  useEffect(() => {
    let active = true;

    async function run() {
      setMaqueirosError(null);

      if (!form.originSectorId) {
        if (active) {
          setAvailableMaqueiros([]);
          setLoadingMaqueiros(false);
        }
        return;
      }

      setLoadingMaqueiros(true);

      try {
        const data = await getAvailableMaqueirosForCall(form.originSectorId, form.destinationSectorId || null);

        if (!active) return;

        setAvailableMaqueiros(data);

        if (form.assignedMaqueiroId && !data.some((maqueiro) => maqueiro.id === form.assignedMaqueiroId)) {
          setForm((current) => ({ ...current, assignedMaqueiroId: '' }));
        }
      } catch (err) {
        if (!active) return;
        setAvailableMaqueiros([]);
        setMaqueirosError(err instanceof Error ? err.message : 'Erro ao carregar maqueiros disponíveis.');
      } finally {
        if (active) setLoadingMaqueiros(false);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [form.originSectorId, form.destinationSectorId]);

  function update<K extends keyof CreateCallForm>(key: K, value: CreateCallForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
      assignedMaqueiroName: selectedMaqueiro ? maqueiroDisplayName(selectedMaqueiro) : null,
      assignedMaqueiroSector: selectedMaqueiro ? maqueiroSectorName(selectedMaqueiro) : null,
      assignedMaqueiroTag: selectedMaqueiro ? maqueiroTag(selectedMaqueiro) : null,
      infectionPrecaution: form.infectionPrecaution,
      observation: form.observation,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
        assignedMaqueiroName: selectedMaqueiro ? maqueiroDisplayName(selectedMaqueiro) : null,
        assignedMaqueiroSector: selectedMaqueiro ? maqueiroSectorName(selectedMaqueiro) : null,
        assignedMaqueiroTag: selectedMaqueiro ? maqueiroTag(selectedMaqueiro) : null,
      };

      await createTransportCall({
        ...form,
        patientCode: form.patientCode.trim(),
        bedNumber: form.bedNumber.trim(),
        assignedMaqueiroId: form.assignedMaqueiroId || null,
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
          .mc-create-screen {
            --mc-create-bg: linear-gradient(135deg, #f7fbff 0%, #eef8ff 52%, #f4fffd 100%);
            --mc-create-title: #062b58;
            --mc-create-text: #0f172a;
            --mc-create-muted: #64748b;
            --mc-create-soft: rgba(255, 255, 255, 0.84);
            --mc-create-card: rgba(255, 255, 255, 0.94);
            --mc-create-input: #ffffff;
            --mc-create-border: rgba(148, 163, 184, 0.28);
            --mc-create-accent-border: rgba(20, 201, 204, 0.26);
            --mc-create-accent: #14c9cc;
            --mc-create-blue: #0077d9;
            --mc-create-shadow: 0 26px 70px rgba(6, 43, 88, 0.12);
            --mc-create-soft-shadow: 0 14px 36px rgba(6, 43, 88, 0.07);
            --mc-create-button: linear-gradient(135deg, #062b58, #0077d9, #14c9cc);
            --mc-create-error-bg: #fef2f2;
            --mc-create-error-text: #b91c1c;
            --mc-create-error-border: rgba(220, 38, 38, 0.18);

            width: 100%;
            padding: clamp(18px, 3vw, 34px);
            border-radius: 34px;
            background: var(--mc-create-bg);
            color: var(--mc-create-text);
            overflow: hidden;
          }

          [data-theme='dark'] .mc-create-screen,
          .dark .mc-create-screen,
          .movercare-dark .mc-create-screen,
          .mover-login-page--dark .mc-create-screen {
            --mc-create-bg: linear-gradient(135deg, #020617 0%, #06162b 48%, #062b58 100%);
            --mc-create-title: #f8fbff;
            --mc-create-text: #e5f5ff;
            --mc-create-muted: #a8bdd4;
            --mc-create-soft: rgba(15, 35, 61, 0.72);
            --mc-create-card: rgba(6, 22, 43, 0.9);
            --mc-create-input: rgba(4, 16, 32, 0.88);
            --mc-create-border: rgba(148, 163, 184, 0.2);
            --mc-create-accent-border: rgba(34, 211, 238, 0.24);
            --mc-create-accent: #22d3ee;
            --mc-create-blue: #38bdf8;
            --mc-create-shadow: 0 30px 80px rgba(0, 0, 0, 0.32);
            --mc-create-soft-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
            --mc-create-button: linear-gradient(135deg, #0f766e, #0284c7, #22d3ee);
            --mc-create-error-bg: rgba(127, 29, 29, 0.22);
            --mc-create-error-text: #fecaca;
            --mc-create-error-border: rgba(248, 113, 113, 0.25);
          }

          .mc-create-card {
            position: relative;
            display: grid;
            gap: 26px;
            width: 100%;
            padding: clamp(20px, 3vw, 34px);
            border: 1px solid var(--mc-create-accent-border);
            border-radius: 30px;
            background: var(--mc-create-card);
            box-shadow: var(--mc-create-shadow);
            backdrop-filter: blur(18px);
          }

          .mc-create-card::before {
            content: "";
            position: absolute;
            inset: 0 0 auto;
            height: 7px;
            background: linear-gradient(90deg, #062b58, #0077d9, #14c9cc);
          }

          .mc-create-header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
            gap: 20px;
            align-items: stretch;
          }

          .mc-create-title-block {
            min-width: 0;
          }

          .mc-create-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            padding: 8px 13px;
            border-radius: 999px;
            border: 1px solid var(--mc-create-accent-border);
            background: var(--mc-create-soft);
            color: var(--mc-create-title);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .mc-create-kicker svg {
            color: var(--mc-create-accent);
          }

          .mc-create-title-block h2 {
            margin: 16px 0 8px;
            color: var(--mc-create-title);
            font-size: clamp(30px, 4vw, 48px);
            line-height: 1;
            letter-spacing: -0.055em;
          }

          .mc-create-title-block p {
            max-width: 620px;
            margin: 0;
            color: var(--mc-create-muted);
            font-size: 15px;
            line-height: 1.7;
          }

          .mc-route-preview {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            gap: 12px;
            min-height: 132px;
            padding: 18px;
            border-radius: 24px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-soft);
            box-shadow: var(--mc-create-soft-shadow);
          }

          .mc-route-preview div {
            min-width: 0;
          }

          .mc-route-preview small {
            display: block;
            margin-bottom: 5px;
            color: var(--mc-create-muted);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.07em;
          }

          .mc-route-preview strong {
            display: block;
            color: var(--mc-create-title);
            font-size: 15px;
            line-height: 1.25;
            word-break: break-word;
          }

          .mc-route-preview > svg {
            color: var(--mc-create-accent);
            flex: 0 0 auto;
          }

          .mc-form-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }

          .mc-field {
            display: grid;
            gap: 8px;
            min-width: 0;
          }

          .mc-field span {
            color: var(--mc-create-title);
            font-size: 13px;
            font-weight: 900;
          }

          .mc-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 54px;
            padding: 0 14px;
            border-radius: 17px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-input);
            color: var(--mc-create-muted);
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.25s ease;
          }

          .mc-input-wrapper:focus-within {
            border-color: var(--mc-create-accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.14);
          }

          .mc-input-wrapper svg {
            color: var(--mc-create-accent);
            flex: 0 0 auto;
          }

          .mc-input-wrapper input,
          .mc-input-wrapper select,
          .mc-field > select,
          .mc-field textarea {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--mc-create-text);
            font: inherit;
            font-size: 14px;
          }

          .mc-field > select,
          .mc-field textarea {
            min-height: 54px;
            padding: 0 14px;
            border-radius: 17px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-input);
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.25s ease;
          }

          .mc-field textarea {
            min-height: 120px;
            padding: 14px;
            resize: vertical;
            line-height: 1.5;
          }

          .mc-field > select:focus,
          .mc-field textarea:focus {
            border-color: var(--mc-create-accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.14);
          }

          .mc-input-wrapper input::placeholder,
          .mc-field textarea::placeholder {
            color: var(--mc-create-muted);
            opacity: 0.8;
          }

          .mc-form-section {
            display: grid;
            gap: 16px;
            padding: clamp(18px, 2.5vw, 24px);
            border: 1px solid var(--mc-create-border);
            border-radius: 26px;
            background: var(--mc-create-soft);
          }

          .mc-assignment-panel {
            display: grid;
            gap: 14px;
            padding: clamp(18px, 2.5vw, 24px);
            border: 1px solid var(--mc-create-border);
            border-radius: 26px;
            background: var(--mc-create-soft);
          }

          .mc-assignment-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
          }

          .mc-assignment-header h3 {
            margin: 0 0 5px;
            color: var(--mc-create-title);
            font-size: 20px;
            letter-spacing: -0.03em;
          }

          .mc-assignment-header p {
            margin: 0;
            color: var(--mc-create-muted);
            font-size: 14px;
            line-height: 1.55;
          }

          .mc-refresh-maqueiros {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 40px;
            padding: 0 13px;
            border-radius: 999px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-card);
            color: var(--mc-create-title);
            font-weight: 900;
            cursor: pointer;
          }

          .mc-refresh-maqueiros:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .mc-assignment-empty {
            padding: 13px 15px;
            border-radius: 17px;
            border: 1px dashed var(--mc-create-border);
            background: var(--mc-create-card);
            color: var(--mc-create-muted);
            font-size: 14px;
            font-weight: 700;
          }

          .mc-assignment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
            gap: 12px;
          }

          .mc-assignment-card {
            display: flex;
            gap: 11px;
            align-items: flex-start;
            padding: 14px;
            border-radius: 20px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-card);
            color: var(--mc-create-text);
            cursor: pointer;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
          }

          .mc-assignment-card:hover {
            border-color: var(--mc-create-accent);
            box-shadow: var(--mc-create-soft-shadow);
            transform: translateY(-1px);
          }

          .mc-assignment-card.selected {
            border-color: var(--mc-create-accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.12);
          }

          .mc-assignment-card input {
            margin-top: 4px;
          }

          .mc-assignment-card strong,
          .mc-assignment-card small {
            display: block;
          }

          .mc-assignment-card small {
            color: var(--mc-create-muted);
            margin-top: 3px;
            line-height: 1.35;
          }

          .mc-assignment-tag {
            display: inline-flex;
            width: fit-content;
            margin-top: 9px;
            padding: 5px 9px;
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.18);
            color: var(--mc-create-muted);
            font-size: 11px;
            font-weight: 900;
          }

          .mc-assignment-tag.origin {
            color: #047857;
            background: rgba(16, 185, 129, 0.14);
          }

          .mc-assignment-tag.destination {
            color: #1d4ed8;
            background: rgba(59, 130, 246, 0.14);
          }

          .mc-form-section-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .mc-form-section-header h3 {
            margin: 0 0 5px;
            color: var(--mc-create-title);
            font-size: 20px;
            letter-spacing: -0.03em;
          }

          .mc-form-section-header p {
            margin: 0;
            color: var(--mc-create-muted);
            font-size: 14px;
            line-height: 1.55;
          }

          .mc-section-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid var(--mc-create-accent-border);
            color: var(--mc-create-title);
            background: var(--mc-create-card);
            font-size: 12px;
            font-weight: 900;
            white-space: nowrap;
          }

          .mc-section-chip svg {
            color: var(--mc-create-accent);
          }

          .mc-check-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }

          .mc-check-card {
            position: relative;
            display: grid;
            gap: 8px;
            min-height: 142px;
            padding: 18px;
            border-radius: 22px;
            border: 1px solid var(--mc-create-border);
            background: var(--mc-create-card);
            color: var(--mc-create-muted);
            cursor: pointer;
            transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          }

          .mc-check-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--mc-create-soft-shadow);
          }

          .mc-check-card.checked {
            border-color: var(--mc-create-accent);
            box-shadow: 0 0 0 4px rgba(20, 201, 204, 0.12);
          }

          .mc-check-card input {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
          }

          .mc-check-card svg {
            color: var(--mc-create-accent);
          }

          .mc-check-card strong {
            color: var(--mc-create-title);
            font-size: 15px;
          }

          .mc-check-card small {
            color: var(--mc-create-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .mc-bottom-grid {
            grid-template-columns: minmax(220px, 0.7fr) minmax(280px, 1.3fr);
          }

          .mc-error-box {
            padding: 14px 16px;
            border-radius: 18px;
            border: 1px solid var(--mc-create-error-border);
            background: var(--mc-create-error-bg);
            color: var(--mc-create-error-text);
            font-size: 14px;
            font-weight: 800;
          }

          .mc-form-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding-top: 2px;
          }

          .mc-submit-button {
            min-width: 240px;
            min-height: 54px;
            border: 0;
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            background: var(--mc-create-button);
            color: #ffffff;
            font-size: 15px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 18px 36px rgba(0, 119, 217, 0.22);
            transition: 0.2s ease;
          }

          .mc-submit-button:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .mc-submit-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .mc-form-footer span {
            max-width: 520px;
            color: var(--mc-create-muted);
            font-size: 13px;
            line-height: 1.5;
          }

          .mc-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: grid;
            place-items: center;
            padding: 24px;
            background: rgba(15, 23, 42, 0.42);
            backdrop-filter: blur(10px);
            animation: mcModalBackdropIn 0.22s ease both;
          }

          .mc-modal {
            position: relative;
            width: min(640px, 100%);
            max-height: calc(100vh - 40px);
            overflow: auto;
            padding: 34px;
            border-radius: 28px;
            border: 1px solid rgba(20, 201, 204, 0.22);
            background: #ffffff;
            text-align: center;
            box-shadow: 0 30px 90px rgba(15, 23, 42, 0.28);
            animation: mcModalPopIn 0.35s cubic-bezier(0.2, 0.9, 0.2, 1.15) both;
          }

          .mc-modal::before {
            content: "";
            position: absolute;
            inset: 0 0 auto;
            height: 8px;
            background: linear-gradient(90deg, #062b58, #0077d9, #14c9cc);
          }

          .mc-confirm-modal::before {
            background: linear-gradient(90deg, #062b58, #14c9cc, #16a34a);
          }

          .mc-modal-close {
            position: absolute;
            right: 18px;
            top: 18px;
            width: 38px;
            height: 38px;
            padding: 0;
            border: 0;
            border-radius: 999px;
            background: #f5f8fa;
            color: #334155;
            display: grid;
            place-items: center;
            cursor: pointer;
          }

          .mc-modal-close:hover {
            background: #edf4f7;
          }

          .mc-modal-icon {
            display: grid;
            place-items: center;
            margin: 4px auto 18px;
            border-radius: 999px;
          }

          .mc-confirm-icon {
            width: 78px;
            height: 78px;
            color: #0077d9;
            background: #e8f6ff;
            border: 1px solid #cfeeff;
            box-shadow: 0 16px 36px rgba(0, 119, 217, 0.14);
          }

          .mc-success-animation {
            position: relative;
            width: 104px;
            height: 104px;
            margin: 4px auto 18px;
            display: grid;
            place-items: center;
          }

          .mc-success-pulse {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: rgba(20, 201, 204, 0.14);
            animation: mcSuccessPulse 1.5s ease-out infinite;
          }

          .mc-success-icon {
            position: relative;
            z-index: 1;
            width: 82px;
            height: 82px;
            background: linear-gradient(135deg, #0077d9, #14c9cc);
            color: white;
            box-shadow: 0 16px 36px rgba(0, 119, 217, 0.26);
            animation: mcCheckPop 0.42s cubic-bezier(0.2, 0.9, 0.2, 1.25) 0.12s both;
          }

          .mc-modal-kicker {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #0077d9;
            background: #e8f6ff;
            padding: 7px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .mc-modal h2 {
            margin: 16px 0 8px;
            color: #101828;
            font-size: clamp(28px, 3vw, 38px);
            letter-spacing: -1px;
          }

          .mc-modal p {
            margin: 0 auto 22px;
            color: #667085;
            max-width: 480px;
            line-height: 1.55;
          }

          .mc-modal-route {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 14px;
            padding: 16px;
            border: 1px solid #dcecef;
            border-radius: 18px;
            background: linear-gradient(135deg, #f7fcfc, #ffffff);
            margin: 0 0 16px;
            color: #0077d9;
          }

          .mc-modal-route div {
            display: grid;
            gap: 4px;
          }

          .mc-modal-route small,
          .mc-success-summary small,
          .mc-confirm-summary small,
          .mc-observation-card small {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .mc-modal-route strong,
          .mc-success-summary strong,
          .mc-confirm-summary strong {
            color: #101828;
            word-break: break-word;
          }

          .mc-success-summary,
          .mc-confirm-summary {
            display: grid;
            gap: 10px;
            margin-bottom: 18px;
          }

          .mc-success-summary {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .mc-confirm-summary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .mc-success-summary div,
          .mc-confirm-summary div,
          .mc-observation-card {
            display: grid;
            gap: 4px;
            padding: 12px;
            border-radius: 14px;
            background: #fbfcfd;
            border: 1px solid #edf2f5;
            text-align: left;
          }

          .mc-priority-urgente,
          .mc-risk-medio {
            color: #b45309 !important;
          }

          .mc-priority-critico,
          .mc-risk-alto {
            color: #b42318 !important;
          }

          .mc-priority-normal,
          .mc-risk-baixo {
            color: #08747c !important;
          }

          .mc-observation-card {
            margin-bottom: 18px;
          }

          .mc-observation-card p {
            margin: 0;
            max-width: none;
            color: #344054;
            text-align: left;
          }

          .mc-success-steps {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin: 0 0 22px;
            color: #667085;
            font-size: 13px;
            font-weight: 800;
          }

          .mc-success-steps div {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 10px;
            border-radius: 999px;
            background: #f5f8fa;
          }

          .mc-success-steps span {
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: #cbd5df;
          }

          .mc-success-steps .active {
            color: #047857;
            background: #e9f9ef;
          }

          .mc-success-steps .active span {
            background: #22c55e;
            box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
          }

          .mc-modal-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
          }

          .mc-primary-action,
          .mc-secondary-action {
            min-width: 180px;
            min-height: 48px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 16px;
            font-weight: 900;
            cursor: pointer;
            transition: 0.2s ease;
          }

          .mc-primary-action {
            border: 0;
            background: linear-gradient(135deg, #062b58, #0077d9, #14c9cc);
            color: white;
          }

          .mc-secondary-action {
            border: 1px solid #dcecef;
            background: #f8fbff;
            color: #062b58;
          }

          .mc-primary-action:hover:not(:disabled),
          .mc-secondary-action:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .mc-primary-action:disabled,
          .mc-secondary-action:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @keyframes mcModalBackdropIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes mcModalPopIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.96);
            }

            to {
              opacity: 1;
              transform: none;
            }
          }

          @keyframes mcCheckPop {
            from {
              opacity: 0;
              transform: scale(0.65) rotate(-8deg);
            }

            to {
              opacity: 1;
              transform: none;
            }
          }

          @keyframes mcSuccessPulse {
            0% {
              opacity: 0.9;
              transform: scale(0.78);
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

          @media (max-width: 1040px) {
            .mc-create-header,
            .mc-form-grid,
            .mc-bottom-grid {
              grid-template-columns: 1fr 1fr;
            }

            .mc-route-preview {
              grid-column: 1 / -1;
            }

            .mc-check-grid {
              grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
            }

            .mc-success-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .mc-create-screen {
              padding: 14px;
              border-radius: 24px;
            }

            .mc-create-card {
              padding: 22px;
              border-radius: 24px;
            }

            .mc-create-header,
            .mc-form-grid,
            .mc-bottom-grid,
            .mc-check-grid {
              grid-template-columns: 1fr;
            }

            .mc-route-preview,
            .mc-modal-route {
              grid-template-columns: 1fr;
            }

            .mc-route-preview > svg,
            .mc-modal-route > svg {
              transform: rotate(90deg);
              justify-self: center;
            }

            .mc-form-section-header,
            .mc-assignment-header,
            .mc-form-footer {
              flex-direction: column;
              align-items: flex-start;
            }

            .mc-submit-button,
            .mc-form-footer span {
              width: 100%;
              max-width: none;
            }

            .mc-modal {
              padding: 28px 18px;
              border-radius: 22px;
            }

            .mc-confirm-summary,
            .mc-success-summary,
            .mc-success-steps {
              grid-template-columns: 1fr;
            }

            .mc-modal-actions,
            .mc-primary-action,
            .mc-secondary-action {
              width: 100%;
            }
          }

          @media (max-width: 420px) {
            .mc-create-title-block h2 {
              font-size: 30px;
            }

            .mc-section-chip {
              width: 100%;
              justify-content: center;
            }
          }
        `}
      </style>

      <section className="mc-create-screen">
        <form className="mc-create-card" onSubmit={handleSubmit}>
          <div className="mc-create-header">
            <div className="mc-create-title-block">
              <span className="mc-create-kicker">
                <ClipboardPlus size={14} />
                Solicitação de transporte
              </span>

              <h2>Dados do chamado</h2>

              <p>
                Preencha as informações principais para acionar o maqueiro correto com mais
                segurança, rastreabilidade e agilidade.
              </p>
            </div>

            <div className="mc-route-preview">
              <div>
                <small>Origem</small>
                <strong>{originName}</strong>
              </div>

              <ArrowRight size={24} />

              <div>
                <small>Destino</small>
                <strong>{destinationName}</strong>
              </div>
            </div>
          </div>

          <div className="mc-form-grid">
            <label className="mc-field">
              <span>Nome ou código do paciente</span>

              <div className="mc-input-wrapper">
                <input
                  value={form.patientCode}
                  onChange={(event) => update('patientCode', event.target.value)}
                  placeholder="Ex.: Maria Silva, PAC-001 ou iniciais"
                  required
                />
              </div>
            </label>

            <label className="mc-field">
              <span>Número do leito</span>

              <div className="mc-input-wrapper">
                <input
                  value={form.bedNumber}
                  onChange={(event) => update('bedNumber', event.target.value)}
                  placeholder="Ex.: 204A, 12, UTI-03"
                  required
                />
              </div>
            </label>

            <label className="mc-field">
              <span>Meio de transporte</span>

              <select
                value={form.transportType}
                onChange={(event) => update('transportType', event.target.value as TransportType)}
                required
              >
                {transportTypes.map((item) => (
                  <option key={item} value={item}>
                    {labelTransportType(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mc-field">
              <span>Origem</span>

              <div className="mc-input-wrapper">
                <MapPin size={18} />

                <select
                  value={form.originSectorId}
                  onChange={(event) => update('originSectorId', event.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="mc-field">
              <span>Destino</span>

              <div className="mc-input-wrapper">
                <Route size={18} />

                <select
                  value={form.destinationSectorId}
                  onChange={(event) => update('destinationSectorId', event.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="mc-field">
              <span>Prioridade operacional</span>

              <div className="mc-input-wrapper">
                <AlertTriangle size={18} />

                <select
                  value={form.priority}
                  onChange={(event) => update('priority', event.target.value as CallPriority)}
                  required
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="mc-field">
              <span>Risco do transporte</span>

              <div className="mc-input-wrapper">
                <ShieldCheck size={18} />

                <select
                  value={form.risk}
                  onChange={(event) => update('risk', event.target.value as TransportRisk)}
                  required
                >
                  {risks.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="mc-form-section">
            <div className="mc-form-section-header">
              <div>
                <h3>Checklist operacional</h3>
                <p>Confirme as etapas antes de solicitar o transporte.</p>
              </div>

              <span className="mc-section-chip">
                <ShieldCheck size={15} />
                Segurança assistencial
              </span>
            </div>

            <div className="mc-check-grid">
              <label
                className={
                  form.destinationCommunicated ? 'mc-check-card checked' : 'mc-check-card'
                }
              >
                <input
                  type="checkbox"
                  checked={form.destinationCommunicated}
                  onChange={(event) => update('destinationCommunicated', event.target.checked)}
                  required
                />

                <CheckCircle2 size={22} />
                <strong>Destino comunicado</strong>
                <small>Equipe do destino está ciente.</small>
              </label>

              <label className={form.teamConfirmed ? 'mc-check-card checked' : 'mc-check-card'}>
                <input
                  type="checkbox"
                  checked={form.teamConfirmed}
                  onChange={(event) => update('teamConfirmed', event.target.checked)}
                  required
                />

                <CheckCircle2 size={22} />
                <strong>Equipe confirmada</strong>
                <small>Equipe mínima está preparada.</small>
              </label>

              <label
                className={form.equipmentConfirmed ? 'mc-check-card checked' : 'mc-check-card'}
              >
                <input
                  type="checkbox"
                  checked={form.equipmentConfirmed}
                  onChange={(event) => update('equipmentConfirmed', event.target.checked)}
                  required
                />

                <CheckCircle2 size={22} />
                <strong>Equipamentos confirmados</strong>
                <small>Maca/cadeira e acessórios disponíveis.</small>
              </label>
            </div>
          </div>

          <div className="mc-form-grid mc-bottom-grid">
            <label className="mc-field">
              <span>Precaução</span>

              <select
                value={form.infectionPrecaution}
                onChange={(event) => update('infectionPrecaution', event.target.value)}
                required
              >
                {infectionPrecautions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mc-field">
              <span>Observações</span>

              <textarea
                value={form.observation}
                onChange={(event) => update('observation', event.target.value)}
                placeholder="Cuidados operacionais do transporte"
                rows={4}
              />
            </label>
          </div>

          <div className="mc-form-section mc-maqueiro-select-section">
            <div className="mc-form-section-header">
              <div>
                <h3>Maqueiro disponível</h3>
                <p>Escolha quem receberá o chamado. A lista mostra somente maqueiros disponíveis e livres.</p>
              </div>

              <button
                type="button"
                className="mc-refresh-maqueiros"
                onClick={loadAvailableMaqueiros}
                disabled={loadingMaqueiros || !form.originSectorId}
              >
                <RefreshCw size={15} />
                {loadingMaqueiros ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            <label className="mc-field">
              <span>Selecionar maqueiro</span>

              <div className="mc-input-wrapper">
                <UsersRound size={18} />

                <select
                  value={form.assignedMaqueiroId ?? ''}
                  onChange={(event) => update('assignedMaqueiroId', event.target.value || null)}
                  disabled={!form.originSectorId || loadingMaqueiros}
                >
                  <option value="">Criar sem atribuir</option>
                  {availableMaqueiros.map((maqueiro) => {
                    const tag = maqueiroTag(maqueiro);
                    const label = `${maqueiroDisplayName(maqueiro)} — ${maqueiroSectorName(maqueiro)}${tag ? ` (${tag})` : ''}`;

                    return (
                      <option key={maqueiro.id} value={maqueiro.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </label>

            {!form.originSectorId && (
              <div className="mc-assignment-empty">Selecione a origem para carregar e priorizar os maqueiros do setor.</div>
            )}

            {form.originSectorId && maqueirosError && (
              <div className="mc-error-box">{maqueirosError}</div>
            )}

            {form.originSectorId && loadingMaqueiros && (
              <div className="mc-assignment-empty">Carregando maqueiros disponíveis...</div>
            )}

            {form.originSectorId && !loadingMaqueiros && availableMaqueiros.length === 0 && !maqueirosError && (
              <div className="mc-assignment-empty">Nenhum maqueiro disponível agora. O chamado pode ser criado sem atribuição.</div>
            )}

            {selectedMaqueiro && (
              <div className="mc-assignment-empty">
                Selecionado: {maqueiroDisplayName(selectedMaqueiro)} · {maqueiroSectorName(selectedMaqueiro)}
              </div>
            )}
          </div>

          {error && <div className="mc-error-box">{error}</div>}

          <div className="mc-form-footer">
            <button
              type="submit"
              disabled={loading}
              className={loading ? 'mc-submit-button button-loading' : 'mc-submit-button'}
            >
              {loading ? (
                'Criando...'
              ) : (
                <>
                  <ClipboardPlus size={18} />
                  Solicitar transporte
                </>
              )}
            </button>

            <span>
              Selecione um maqueiro disponível para envio imediato ou crie sem atribuir para a coordenação assumir depois.
            </span>
          </div>
        </form>
      </section>

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
