import { supabase } from '../lib/supabase';
import type { CreateCallForm, MaqueiroOption, Profile, Sector, TransportCall } from '../types/movercare';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getMyProfile(): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    ...(data as Profile),
    email: (data as any)?.email ?? userData.user?.email ?? null,
  } as Profile;
}

export async function getSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, order_position, active')
    .eq('active', true)
    .order('order_position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Sector[];
}


export async function getAvailableMaqueirosForCall(
  originSectorId?: string | null,
  destinationSectorId?: string | null
): Promise<MaqueiroOption[]> {
  const params = {
    p_origin_sector_id: originSectorId || null,
    p_destination_sector_id: destinationSectorId || null,
  };

  let result = await supabase.rpc('get_available_maqueiros_for_call', params);

  if (result.error) {
    result = await supabase.rpc('coordinator_get_available_maqueiros_for_call', params);
  }

  if (result.error) throw result.error;

  return ((result.data ?? []) as MaqueiroOption[]).map((maqueiro) => ({
    ...maqueiro,
    status: String(maqueiro.status || 'OFFLINE').trim().toUpperCase(),
    active: maqueiro.active !== false,
  }));
}

function resolveCreatedCallId(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    const first = data[0] as any;
    if (typeof first === 'string') return first;
    return first?.id ?? null;
  }

  return (data as any)?.id ?? null;
}

async function findCreatedCallId(
  patientIdentifier: string,
  originSectorId: string,
  destinationSectorId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('transport_calls')
    .select('id')
    .eq('patient_code', patientIdentifier)
    .eq('origin_sector_id', originSectorId)
    .eq('destination_sector_id', destinationSectorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function createTransportCall(form: CreateCallForm): Promise<TransportCall> {
  const patientNameOrCode = form.patientCode.trim();
  const bedNumber = form.bedNumber.trim();
  const patientIdentifier = `${patientNameOrCode} | Leito ${bedNumber}`;

  const observationWithBed = [
    `Leito: ${bedNumber}`,
    form.observation?.trim() ? form.observation.trim() : null,
  ].filter(Boolean).join('\n');

  const { data, error } = await supabase.rpc('create_transport_call', {
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
    p_observation: observationWithBed || null,
  });

  if (error) throw error;

  if (form.assignedMaqueiroId) {
    let createdCallId = resolveCreatedCallId(data);

    if (!createdCallId) {
      createdCallId = await findCreatedCallId(
        patientIdentifier,
        form.originSectorId,
        form.destinationSectorId
      );
    }

    if (!createdCallId) {
      throw new Error('Chamado criado, mas não foi possível localizar o ID para enviar ao maqueiro. Atribua pela coordenação.');
    }

    const { error: assignError } = await supabase.rpc('assign_call_to_selected_maqueiro', {
      p_call_id: createdCallId,
      p_maqueiro_id: form.assignedMaqueiroId,
    });

    if (assignError) throw assignError;
  }

  return data as TransportCall;
}

export async function cancelTransportCall(callId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_transport_call', {
    p_call_id: callId,
    p_reason: reason.trim(),
  });

  if (error) throw error;
}

export async function getMyCalls(): Promise<TransportCall[]> {
  const { data, error } = await supabase
    .from('transport_calls')
    .select(`
      *,
      cancellation_reason,
      cancelled_at,
      cancelled_by,
      origin_sector:sectors!transport_calls_origin_sector_id_fkey(id, name),
      destination_sector:sectors!transport_calls_destination_sector_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as TransportCall[];
}
