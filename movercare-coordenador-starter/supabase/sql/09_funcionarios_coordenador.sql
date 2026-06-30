-- ============================================================
-- MoverCare - Funcionários no Portal Coordenador
-- Rode este arquivo no SQL Editor do Supabase antes de publicar
-- a Edge Function coordinator-admin-users.
-- ============================================================

alter table public.profiles
add column if not exists full_name text;

alter table public.profiles
add column if not exists name text;

alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists phone text;

alter table public.profiles
add column if not exists active boolean not null default true;

alter table public.profiles
add column if not exists created_at timestamptz not null default now();

alter table public.profiles
add column if not exists updated_at timestamptz not null default now();

update public.profiles
set
  name = coalesce(name, full_name),
  full_name = coalesce(full_name, name),
  active = coalesce(active, true),
  updated_at = coalesce(updated_at, now())
where true;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

notify pgrst, 'reload schema';
