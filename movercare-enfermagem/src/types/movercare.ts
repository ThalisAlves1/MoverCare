export type UserRole = 'ENFERMEIRA' | 'MAQUEIRO' | 'COORDENADOR' | 'ADMIN';
export type CallPriority = 'NORMAL' | 'URGENTE' | 'CRITICO';
export type TransportRisk = 'BAIXO' | 'MEDIO' | 'ALTO';
export type TransportType = 'MACA' | 'CADEIRA_RODAS' | 'ACOMPANHAMENTO' | 'OUTRO';
export type CallStatus =
  | 'ABERTO'
  | 'AGUARDANDO_MAQUEIRO'
  | 'ENVIADO'
  | 'ACEITO'
  | 'A_CAMINHO_ORIGEM'
  | 'EM_TRANSITO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'ATRASADO';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  sector_id?: string | null;
  email?: string | null;
  phone?: string | null;
  telefone?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
  sector?: Pick<Sector, 'id' | 'name'> | null;
  sector_name?: string | null;
}

export interface Sector {
  id: string;
  name: string;
  order_position: number;
  active: boolean;
  qr_token?: string;
}

export interface TransportCall {
  id: string;
  number: number;
  patient_code?: string | null;
  origin_sector_id: string;
  destination_sector_id: string;
  transport_type: TransportType;
  priority: CallPriority;
  risk: TransportRisk;
  status: CallStatus;
  requester_id: string;
  assigned_maqueiro_id?: string | null;
  destination_communicated: boolean;
  team_confirmed: boolean;
  equipment_confirmed: boolean;
  infection_precaution?: string | null;
  observation?: string | null;
  accepted_at?: string | null;
  qr_origin_read_at?: string | null;
  qr_destination_read_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  origin_sector?: Pick<Sector, 'id' | 'name'>;
  destination_sector?: Pick<Sector, 'id' | 'name'>;
}

export interface CreateCallForm {
  patientCode: string;
  bedNumber: string;
  originSectorId: string;
  destinationSectorId: string;
  transportType: TransportType;
  priority: CallPriority;
  risk: TransportRisk;
  destinationCommunicated: boolean;
  teamConfirmed: boolean;
  equipmentConfirmed: boolean;
  infectionPrecaution: string;
  observation: string;
}
