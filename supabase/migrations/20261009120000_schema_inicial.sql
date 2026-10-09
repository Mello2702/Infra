-- Schema inicial do Sistema de Gestão do Núcleo de Infraestrutura:
-- perfis de usuário, unidades, inventário de equipamentos e visitas,
-- com segurança por linha (RLS) baseada no papel do usuário.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null default '',
  papel text not null default 'tecnico' check (papel in ('admin', 'gestor', 'tecnico')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.unidades (
  id bigint generated always as identity primary key,
  nome text not null unique,
  sigla text,
  endereco text,
  municipio text,
  responsavel text,
  telefone text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.equipamentos (
  id bigint generated always as identity primary key,
  patrimonio text unique,
  tipo text not null,
  marca text,
  modelo text,
  numero_serie text,
  unidade_id bigint references public.unidades (id) on delete restrict,
  localizacao text,
  status text not null default 'em_uso'
    check (status in ('em_uso', 'estoque', 'manutencao', 'baixado')),
  data_aquisicao date,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.visitas (
  id bigint generated always as identity primary key,
  unidade_id bigint not null references public.unidades (id) on delete restrict,
  tecnico_id uuid not null references public.perfis (id) on delete restrict,
  data_visita date not null,
  tipo text not null,
  status text not null default 'agendada'
    check (status in ('agendada', 'realizada', 'cancelada')),
  objetivo text,
  relato text,
  pendencias text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index equipamentos_unidade_id_idx on public.equipamentos (unidade_id);
create index visitas_unidade_id_idx on public.visitas (unidade_id);
create index visitas_tecnico_id_idx on public.visitas (tecnico_id);
create index visitas_data_visita_idx on public.visitas (data_visita);

-- ---------------------------------------------------------------------------
-- Funções e gatilhos
-- ---------------------------------------------------------------------------

-- Papel do usuário logado; nulo se não houver perfil ou se estiver inativo.
-- SECURITY DEFINER para poder ser usada nas políticas da própria tabela perfis.
create function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = (select auth.uid()) and ativo;
$$;

revoke execute on function public.papel_atual() from public, anon;
grant execute on function public.papel_atual() to authenticated;

-- Cria o perfil quando um usuário é criado no Supabase Auth.
-- O primeiro usuário do sistema vira administrador; os demais, técnicos.
create function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nome', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    ),
    coalesce(new.email, ''),
    case when exists (select 1 from public.perfis) then 'tecnico' else 'admin' end
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_novo_usuario();

create function public.marcar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger unidades_atualizacao
before update on public.unidades
for each row execute function public.marcar_atualizacao();

create trigger equipamentos_atualizacao
before update on public.equipamentos
for each row execute function public.marcar_atualizacao();

create trigger visitas_atualizacao
before update on public.visitas
for each row execute function public.marcar_atualizacao();

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

revoke all on public.perfis, public.unidades, public.equipamentos, public.visitas from anon;

grant select, update on public.perfis to authenticated;
grant select, insert, update, delete on public.unidades, public.equipamentos, public.visitas
  to authenticated;

alter table public.perfis enable row level security;
alter table public.unidades enable row level security;
alter table public.equipamentos enable row level security;
alter table public.visitas enable row level security;

-- perfis: usuários ativos enxergam todos; só administradores alteram.
create policy perfis_leitura on public.perfis
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy perfis_alteracao on public.perfis
  for update to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

-- unidades: todos leem; gestores e administradores cadastram; administradores excluem.
create policy unidades_leitura on public.unidades
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy unidades_inclusao on public.unidades
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy unidades_alteracao on public.unidades
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy unidades_exclusao on public.unidades
  for delete to authenticated
  using ((select public.papel_atual()) = 'admin');

-- equipamentos: todos leem e cadastram; gestores e administradores excluem.
create policy equipamentos_leitura on public.equipamentos
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy equipamentos_inclusao on public.equipamentos
  for insert to authenticated
  with check ((select public.papel_atual()) is not null);

create policy equipamentos_alteracao on public.equipamentos
  for update to authenticated
  using ((select public.papel_atual()) is not null)
  with check ((select public.papel_atual()) is not null);

create policy equipamentos_exclusao on public.equipamentos
  for delete to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'));

-- visitas: todos leem; técnicos registram e alteram as próprias;
-- gestores e administradores gerenciam todas.
create policy visitas_leitura on public.visitas
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy visitas_inclusao on public.visitas
  for insert to authenticated
  with check (
    (select public.papel_atual()) in ('admin', 'gestor')
    or ((select public.papel_atual()) = 'tecnico' and tecnico_id = (select auth.uid()))
  );

create policy visitas_alteracao on public.visitas
  for update to authenticated
  using (
    (select public.papel_atual()) in ('admin', 'gestor')
    or ((select public.papel_atual()) = 'tecnico' and tecnico_id = (select auth.uid()))
  )
  with check (
    (select public.papel_atual()) in ('admin', 'gestor')
    or ((select public.papel_atual()) = 'tecnico' and tecnico_id = (select auth.uid()))
  );

create policy visitas_exclusao on public.visitas
  for delete to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'));
