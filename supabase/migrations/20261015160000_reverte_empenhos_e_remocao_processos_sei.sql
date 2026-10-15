-- Desfaz no banco, a pedido do usuário, os efeitos das migrations:
--   20261015150000_processos_empenhos   → remove processos, empenhos e suas funções
--                                         (tabelas vazias neste momento);
--   20261015140000_remove_processos_sei → recria processos_sei, vazia, como
--                                         definida em 20261015130000_processos_sei.
-- Os arquivos daquelas migrations ficam no repositório porque já foram aplicadas.

drop function if exists public.importar_empenhos(text, text[]);
drop function if exists public.salvar_processo(bigint, jsonb, text[]);
drop function if exists public.normalizar_empenho(text);
drop table if exists public.empenhos;
drop table if exists public.processos;

create table public.processos_sei (
  id bigint generated always as identity primary key,
  numero text not null unique check (btrim(numero) <> ''),
  unidade_id bigint references public.unidades (id) on delete set null,
  descricao text,
  -- Dados copiados do SEI na última consulta importada.
  tipo_processo text,
  url text,
  cabecalho jsonb not null default '{}'::jsonb,
  documentos jsonb not null default '[]'::jsonb,
  andamentos jsonb not null default '[]'::jsonb,
  consultado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index processos_sei_unidade_id_idx on public.processos_sei (unidade_id);

create trigger processos_sei_atualizacao
before update on public.processos_sei
for each row execute function public.marcar_atualizacao();

revoke all on public.processos_sei from anon;
grant select, insert, update, delete on public.processos_sei to authenticated;

alter table public.processos_sei enable row level security;

create policy processos_sei_leitura on public.processos_sei
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy processos_sei_inclusao on public.processos_sei
  for insert to authenticated
  with check ((select public.papel_atual()) is not null);

create policy processos_sei_alteracao on public.processos_sei
  for update to authenticated
  using ((select public.papel_atual()) is not null)
  with check ((select public.papel_atual()) is not null);

create policy processos_sei_exclusao on public.processos_sei
  for delete to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'));
