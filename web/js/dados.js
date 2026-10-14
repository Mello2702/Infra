// Acesso às tabelas do Supabase.
import { sb } from "./supabase.js";

// Limite padrão de linhas por requisição da API do Supabase.
const PAGINA = 1000;

const MENSAGENS = {
  23505: "Já existe um registro com esse valor (nome ou patrimônio duplicado).",
  23503: "Este registro está vinculado a outros cadastros e não pode ser excluído.",
  23514: "Valor inválido para um dos campos.",
  42501: "Você não tem permissão para essa operação.",
};

/** Falha ao ler ou gravar, com mensagem pronta para mostrar ao usuário. */
export class ErroDados extends Error {}

async function executar(consulta) {
  const { data, error } = await consulta;
  if (error) {
    console.error(error);
    if (MENSAGENS[error.code]) throw new ErroDados(MENSAGENS[error.code]);
    // Sem código do Postgres, a falha foi de rede (a requisição nem chegou ao banco).
    throw new ErroDados(
      error.code
        ? `Erro no banco de dados: ${error.message}`
        : "Não foi possível conectar ao Supabase. Tente novamente.",
    );
  }
  return data;
}

async function listar(tabela, colunas, ordem, desc = false) {
  const linhas = [];
  for (;;) {
    const lote = await executar(
      sb
        .from(tabela)
        .select(colunas)
        .order(ordem, { ascending: !desc })
        .order("id")
        .range(linhas.length, linhas.length + PAGINA - 1),
    );
    linhas.push(...lote);
    if (lote.length < PAGINA) return linhas;
  }
}

/** Troca o objeto aninhado da relação (ex.: unidades) pela coluna com o nome. */
function achatar(linhas, relacao, destino) {
  for (const linha of linhas) {
    linha[destino] = linha[relacao]?.nome ?? null;
    delete linha[relacao];
  }
  return linhas;
}

export async function listarUnidades() {
  return achatar(await listar("unidades", "*, tipos_estabelecimento(nome)", "nome"), "tipos_estabelecimento", "tipo");
}

export const listarTiposEstabelecimento = () => listar("tipos_estabelecimento", "*", "nome");

export const listarPerfis = () => listar("perfis", "id, nome, email, papel, ativo", "nome");

export async function listarEquipamentos() {
  return achatar(await listar("equipamentos", "*, unidades(nome)", "tipo"), "unidades", "unidade");
}

export async function listarVisitas() {
  const linhas = await listar("visitas", "*, unidades(nome), perfis(nome)", "data_visita", true);
  return achatar(achatar(linhas, "unidades", "unidade"), "perfis", "tecnico");
}

export async function inserir(tabela, valores) {
  await executar(sb.from(tabela).insert(valores));
}

// Quando a RLS barra uma alteração, a API não dá erro: só não devolve linha nenhuma.
export async function atualizar(tabela, id, valores) {
  const linhas = await executar(sb.from(tabela).update(valores).eq("id", id).select("id"));
  if (!linhas.length) throw new ErroDados(MENSAGENS[42501]);
}

export async function excluir(tabela, id) {
  const linhas = await executar(sb.from(tabela).delete().eq("id", id).select("id"));
  if (!linhas.length) throw new ErroDados(MENSAGENS[42501]);
}
