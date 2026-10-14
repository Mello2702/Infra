-- Tipos de estabelecimento das unidades (cadastro auxiliar), com o mesmo
-- controle de acesso das unidades: todos consultam, gestores e
-- administradores cadastram e editam, administradores excluem.

create table public.tipos_estabelecimento (
  id bigint generated always as identity primary key,
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger tipos_estabelecimento_atualizacao
before update on public.tipos_estabelecimento
for each row execute function public.marcar_atualizacao();

-- Um tipo em uso por alguma unidade não pode ser excluído (só desativado).
alter table public.unidades
  add column tipo_id bigint references public.tipos_estabelecimento (id) on delete restrict;

create index unidades_tipo_id_idx on public.unidades (tipo_id);

revoke all on public.tipos_estabelecimento from anon;
grant select, insert, update, delete on public.tipos_estabelecimento to authenticated;

alter table public.tipos_estabelecimento enable row level security;

create policy tipos_estabelecimento_leitura on public.tipos_estabelecimento
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy tipos_estabelecimento_inclusao on public.tipos_estabelecimento
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy tipos_estabelecimento_alteracao on public.tipos_estabelecimento
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy tipos_estabelecimento_exclusao on public.tipos_estabelecimento
  for delete to authenticated
  using ((select public.papel_atual()) = 'admin');
