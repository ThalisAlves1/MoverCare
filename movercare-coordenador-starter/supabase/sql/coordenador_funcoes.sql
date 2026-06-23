-- ============================================================
-- MoverCare - Funções do Painel do Coordenador
-- Rode este arquivo no SQL Editor do Supabase.
-- ============================================================

create or replace function public.coordinator_reassign_call(
  p_call_id uuid,
  p_maqueiro_id uuid
)
returns public.transport_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_call public.transport_calls;
  v_maqueiro_status public.maqueiro_status;
  v_result public.transport_calls;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select prof.role
  into v_role
  from public.profiles prof
  where prof.id = v_user_id
    and prof.active = true;

  if v_role not in ('COORDENADOR', 'ADMIN') then
    raise exception 'Apenas coordenador ou administrador podem reatribuir chamados.';
  end if;

  select *
  into v_call
  from public.transport_calls tc
  where tc.id = p_call_id
  for update;

  if v_call.id is null then
    raise exception 'Chamado não encontrado.';
  end if;

  if v_call.status in ('CONCLUIDO', 'CANCELADO') then
    raise exception 'Chamado % não pode ser reatribuído porque está %.', v_call.number, v_call.status;
  end if;

  select ms.status
  into v_maqueiro_status
  from public.maqueiro_statuses ms
  join public.profiles prof on prof.id = ms.maqueiro_id
  where ms.maqueiro_id = p_maqueiro_id
    and prof.role = 'MAQUEIRO'
    and prof.active = true;

  if v_maqueiro_status is null then
    raise exception 'Maqueiro não encontrado ou sem status operacional.';
  end if;

  if v_maqueiro_status <> 'DISPONIVEL' then
    raise exception 'Maqueiro selecionado não está disponível. Status atual: %.', v_maqueiro_status;
  end if;

  if exists (
    select 1
    from public.transport_calls active_call
    where active_call.assigned_maqueiro_id = p_maqueiro_id
      and active_call.status in ('ENVIADO', 'A_CAMINHO_ORIGEM', 'EM_TRANSITO')
      and active_call.id <> p_call_id
  ) then
    raise exception 'Maqueiro selecionado já possui chamado ativo.';
  end if;

  update public.transport_calls tc
  set
    assigned_maqueiro_id = p_maqueiro_id,
    status = 'ENVIADO',
    accepted_at = null,
    qr_origin_read_at = null,
    qr_destination_read_at = null,
    completed_at = null,
    updated_at = now()
  where tc.id = p_call_id
  returning * into v_result;

  update public.maqueiro_statuses ms
  set
    status = 'EM_DESLOCAMENTO',
    updated_at = now()
  where ms.maqueiro_id = p_maqueiro_id;

  insert into public.call_history (
    call_id,
    actor_id,
    from_status,
    to_status,
    description
  )
  values (
    p_call_id,
    v_user_id,
    v_call.status,
    'ENVIADO',
    'Chamado reatribuído manualmente pelo coordenador.'
  );

  return v_result;
end;
$$;

grant execute on function public.coordinator_reassign_call(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
