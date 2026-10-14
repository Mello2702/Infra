-- Cada unidade pode ter vários tipos de estabelecimento: a ligação direta
-- unidades.tipo_id dá lugar à tabela de relacionamento unidade_tipos.
-- O catálogo tipos_estabelecimento continua sendo a lista de tipos válidos.

create table public.unidade_tipos (
  unidade_id bigint not null references public.unidades (id) on delete cascade,
  tipo_id bigint not null references public.tipos_estabelecimento (id) on delete restrict,
  -- Ordem em que os tipos aparecem na unidade (coluna "#" do formulário).
  posicao integer not null default 1,
  primary key (unidade_id, tipo_id)
);

create index unidade_tipos_tipo_id_idx on public.unidade_tipos (tipo_id);

-- Leva o tipo que cada unidade já tinha para a tabela nova.
insert into public.unidade_tipos (unidade_id, tipo_id, posicao)
select id, tipo_id, 1 from public.unidades where tipo_id is not null;

alter table public.unidades drop column tipo_id;

-- Evita "Psiquiátrico" e "psiquiátrico" como tipos diferentes.
create unique index tipos_estabelecimento_nome_minusculo_idx
  on public.tipos_estabelecimento (lower(nome));

-- Acesso: todos consultam; quem edita a unidade (gestor e administrador) edita seus tipos.
revoke all on public.unidade_tipos from anon;
grant select, insert, update, delete on public.unidade_tipos to authenticated;

alter table public.unidade_tipos enable row level security;

create policy unidade_tipos_leitura on public.unidade_tipos
  for select to authenticated
  using ((select public.papel_atual()) is not null);

create policy unidade_tipos_inclusao on public.unidade_tipos
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy unidade_tipos_alteracao on public.unidade_tipos
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor'));

create policy unidade_tipos_exclusao on public.unidade_tipos
  for delete to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'));

-- Grava a unidade e a sua lista de tipos numa única transação: ou tudo é
-- salvo, ou nada. Tipos digitados que ainda não existem no catálogo são
-- criados. Roda com as permissões de quem chama (security invoker), então
-- as regras de RLS acima continuam valendo.
create function public.salvar_unidade(p_id bigint, p_dados jsonb, p_tipos text[])
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_nome text;
  v_tipo_id bigint;
  v_tipos bigint[] := '{}';
begin
  if p_id is null then
    insert into public.unidades (nome, razao_social, endereco, cidade, uf, uge, ativo)
    values (
      p_dados ->> 'nome', p_dados ->> 'razao_social', p_dados ->> 'endereco',
      p_dados ->> 'cidade', p_dados ->> 'uf', p_dados ->> 'uge',
      coalesce((p_dados ->> 'ativo')::boolean, true)
    )
    returning id into v_id;
  else
    update public.unidades set
      nome = p_dados ->> 'nome',
      razao_social = p_dados ->> 'razao_social',
      endereco = p_dados ->> 'endereco',
      cidade = p_dados ->> 'cidade',
      uf = p_dados ->> 'uf',
      uge = p_dados ->> 'uge',
      ativo = coalesce((p_dados ->> 'ativo')::boolean, true)
    where id = p_id
    returning id into v_id;
    -- Sem linha devolvida: a unidade não existe ou a RLS barrou a alteração.
    if v_id is null then
      raise exception 'sem permissão para alterar esta unidade' using errcode = '42501';
    end if;
  end if;

  foreach v_nome in array coalesce(p_tipos, '{}') loop
    v_nome := btrim(v_nome);
    continue when v_nome = '';
    select id into v_tipo_id from public.tipos_estabelecimento where lower(nome) = lower(v_nome);
    if v_tipo_id is null then
      insert into public.tipos_estabelecimento (nome) values (v_nome) returning id into v_tipo_id;
    end if;
    if not v_tipo_id = any (v_tipos) then
      v_tipos := v_tipos || v_tipo_id;
    end if;
  end loop;

  delete from public.unidade_tipos
  where unidade_id = v_id and not tipo_id = any (v_tipos);

  insert into public.unidade_tipos (unidade_id, tipo_id, posicao)
  select v_id, t.tipo_id, t.posicao::integer
  from unnest(v_tipos) with ordinality as t (tipo_id, posicao)
  on conflict (unidade_id, tipo_id) do update set posicao = excluded.posicao;

  return v_id;
end;
$$;

revoke execute on function public.salvar_unidade(bigint, jsonb, text[]) from public, anon;
grant execute on function public.salvar_unidade(bigint, jsonb, text[]) to authenticated;
