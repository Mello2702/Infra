-- Unidades passam a ter: nome, razão social, endereço, cidade, UF e UGE
-- (Unidade Gestora Executora). A coluna "ativo" continua: unidades inativas
-- deixam de aparecer nos formulários de equipamentos e visitas.
-- A tabela estava vazia quando esta migration foi criada; sigla, responsável
-- e telefone saem sem perda de dados.

alter table public.unidades rename column municipio to cidade;

alter table public.unidades
  drop column sigla,
  drop column responsavel,
  drop column telefone;

alter table public.unidades
  add column razao_social text,
  add column uf text check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  )),
  add column uge text;
