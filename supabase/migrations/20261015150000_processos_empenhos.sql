-- Processos (número do SEI) e suas notas de empenho: um processo tem várias
-- notas de empenho, cada uma numa linha de empenhos.

create table public.processos (
  id bigint generated always as identity primary key,
  numero text not null unique check (btrim(numero) <> ''),
  unidade_id bigint references public.unidades (id) on delete set null,
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index processos_unidade_id_idx on public.processos (unidade_id);

create trigger processos_atualizacao
before update on public.processos
for each row execute function public.marcar_atualizacao();

create table public.empenhos (
  id bigint generated always as identity primary key,
  processo_id bigint not null references public.processos (id) on delete cascade,
  -- Número da nota de empenho, sem espaços e em maiúsculas (ex.: 2026NE000123).
  numero text not null check (numero <> '' and numero !~ '\s'),
  -- Ordem em que as notas aparecem no processo (coluna "#" do formulário).
  posicao integer not null default 1,
  criado_em timestamptz not null default now(),
  unique (processo_id, numero)
);

-- Acesso: todos consultam, cadastram e editam processos e suas notas de
-- empenho; só gestores e administradores excluem um processo inteiro.
revoke all on public.processos, public.empenhos from anon;
grant select, insert, update, delete on public.processos, public.empenhos to authenticated;

alter table public.processos enable row level security;
alter table public.empenhos enable row level security;

create policy processos_leitura on public.processos
  for select to authenticated using ((select public.papel_atual()) is not null);
create policy processos_inclusao on public.processos
  for insert to authenticated with check ((select public.papel_atual()) is not null);
create policy processos_alteracao on public.processos
  for update to authenticated
  using ((select public.papel_atual()) is not null)
  with check ((select public.papel_atual()) is not null);
create policy processos_exclusao on public.processos
  for delete to authenticated using ((select public.papel_atual()) in ('admin', 'gestor'));

create policy empenhos_leitura on public.empenhos
  for select to authenticated using ((select public.papel_atual()) is not null);
create policy empenhos_inclusao on public.empenhos
  for insert to authenticated with check ((select public.papel_atual()) is not null);
create policy empenhos_alteracao on public.empenhos
  for update to authenticated
  using ((select public.papel_atual()) is not null)
  with check ((select public.papel_atual()) is not null);
create policy empenhos_exclusao on public.empenhos
  for delete to authenticated using ((select public.papel_atual()) is not null);

-- Normaliza o número de uma nota de empenho: sem espaços e em maiúsculas.
create function public.normalizar_empenho(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p, ''), '\s+', '', 'g'));
$$;

-- Grava o processo e a lista completa de notas de empenho numa única
-- transação: notas fora da lista são removidas. Roda com as permissões de
-- quem chama (security invoker), então a RLS continua valendo.
create function public.salvar_processo(p_id bigint, p_dados jsonb, p_empenhos text[])
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_numero text;
  v_lista text[] := '{}';
begin
  if p_id is null then
    insert into public.processos (numero, unidade_id, descricao)
    values (btrim(p_dados ->> 'numero'), (p_dados ->> 'unidade_id')::bigint, p_dados ->> 'descricao')
    returning id into v_id;
  else
    update public.processos set
      numero = btrim(p_dados ->> 'numero'),
      unidade_id = (p_dados ->> 'unidade_id')::bigint,
      descricao = p_dados ->> 'descricao'
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'sem permissão para alterar este processo' using errcode = '42501';
    end if;
  end if;

  foreach v_numero in array coalesce(p_empenhos, '{}') loop
    v_numero := public.normalizar_empenho(v_numero);
    continue when v_numero = '';
    if not v_numero = any (v_lista) then
      v_lista := v_lista || v_numero;
    end if;
  end loop;

  delete from public.empenhos where processo_id = v_id and not numero = any (v_lista);

  insert into public.empenhos (processo_id, numero, posicao)
  select v_id, t.numero, t.posicao::integer
  from unnest(v_lista) with ordinality as t (numero, posicao)
  on conflict (processo_id, numero) do update set posicao = excluded.posicao;

  return v_id;
end;
$$;

-- Acrescenta notas de empenho vindas do script do SEI ("Colar do SEI"): cria o
-- processo se ainda não existir e só adiciona as notas que faltam, sem
-- remover as já cadastradas.
create function public.importar_empenhos(p_numero text, p_empenhos text[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_novo boolean := false;
  v_numero text;
  v_posicao integer;
  v_adicionados integer := 0;
begin
  p_numero := btrim(coalesce(p_numero, ''));
  if p_numero = '' then
    raise exception 'número do processo vazio' using errcode = '22023';
  end if;

  select id into v_id from public.processos where numero = p_numero;
  if v_id is null then
    insert into public.processos (numero) values (p_numero) returning id into v_id;
    v_novo := true;
  end if;

  select coalesce(max(posicao), 0) into v_posicao from public.empenhos where processo_id = v_id;
  foreach v_numero in array coalesce(p_empenhos, '{}') loop
    v_numero := public.normalizar_empenho(v_numero);
    continue when v_numero = '';
    insert into public.empenhos (processo_id, numero, posicao)
    values (v_id, v_numero, v_posicao + 1)
    on conflict (processo_id, numero) do nothing;
    if found then
      v_posicao := v_posicao + 1;
      v_adicionados := v_adicionados + 1;
    end if;
  end loop;

  return jsonb_build_object('processo_id', v_id, 'novo_processo', v_novo, 'adicionados', v_adicionados);
end;
$$;

revoke execute on function public.salvar_processo(bigint, jsonb, text[]) from public, anon;
revoke execute on function public.importar_empenhos(text, text[]) from public, anon;
grant execute on function public.salvar_processo(bigint, jsonb, text[]) to authenticated;
grant execute on function public.importar_empenhos(text, text[]) to authenticated;
