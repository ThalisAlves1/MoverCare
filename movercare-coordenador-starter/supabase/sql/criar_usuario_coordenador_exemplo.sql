-- ============================================================
-- Exemplo para vincular usuário Auth existente como COORDENADOR
-- Troque o UUID e o nome.
-- ============================================================

insert into public.profiles (
  id,
  full_name,
  role,
  active
)
values (
  'COLE_AQUI_O_UUID_DO_USUARIO_AUTH',
  'Coordenador MoverCare',
  'COORDENADOR',
  true
)
on conflict (id)
do update set
  full_name = excluded.full_name,
  role = 'COORDENADOR',
  active = true;
