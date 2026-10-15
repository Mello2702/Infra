-- Recria o catálogo tipos_estabelecimento, apagado em 15/10/2026 fora das
-- migrations (DROP ... CASCADE pelo painel), o que também removeu a chave
-- estrangeira de unidade_tipos.tipo_id. A página de Unidades depende dele.
-- Escrita para rodar mesmo que parte desses objetos já exista.

create table if not exists public.tipos_estabelecimento (
  id bigint generated always as identity primary key,
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists tipos_estabelecimento_nome_minusculo_idx
  on public.tipos_estabelecimento (lower(nome));

drop trigger if exists tipos_estabelecimento_atualizacao on public.tipos_estabelecimento;
create trigger tipos_estabelecimento_atualizacao
before update on public.tipos_estabelecimento
for each row execute function public.marcar_atualizacao();

-- unidade_tipos estava vazia; tipos sem correspondência (se houver) saem antes
-- de recriar a chave estrangeira.
delete from public.unidade_tipos ut
where not exists (select 1 from public.tipos_estabelecimento t where t.id = ut.tipo_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.unidade_tipos'::regclass and conname = 'unidade_tipos_tipo_id_fkey'
  ) then
    alter table public.unidade_tipos
      add constraint unidade_tipos_tipo_id_fkey
      foreign key (tipo_id) references public.tipos_estabelecimento (id) on delete restrict;
  end if;
end $$;

revoke all on public.tipos_estabelecimento from anon;
grant select, insert, update, delete on public.tipos_estabelecimento to authenticated;

alter table public.tipos_estabelecimento enable row level security;

drop policy if exists tipos_estabelecimento_leitura on public.tipos_estabelecimento;
create policy tipos_estabelecimento_leitura on public.tipos_estabelecimento
  for select to authenticated
  using ((select public.papel_atual()) is not null);

drop policy if exists tipos_estabelecimento_inclusao on public.tipos_estabelecimento;
create policy tipos_estabelecimento_inclusao on public.tipos_estabelecimento
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

drop policy if exists tipos_estabelecimento_alteracao on public.tipos_estabelecimento;
create policy tipos_estabelecimento_alteracao on public.tipos_estabelecimento
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

drop policy if exists tipos_estabelecimento_exclusao on public.tipos_estabelecimento;
create policy tipos_estabelecimento_exclusao on public.tipos_estabelecimento
  for delete to authenticated
  using ((select public.papel_atual()) = 'admin');

-- Faz a API do Supabase enxergar a tabela e a relação na hora.
notify pgrst, 'reload schema';
