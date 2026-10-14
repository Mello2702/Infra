// Tipos de estabelecimento das unidades (cadastro auxiliar).
import { atualizar, excluir, inserir, listarTiposEstabelecimento, listarUnidades } from "../dados.js";
import { temPapel } from "../estado.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "nome", titulo: "Tipo de estabelecimento" },
  { campo: "descricao", titulo: "Descrição" },
  { campo: "unidades", titulo: "Unidades" },
  { campo: "ativo", titulo: "Ativo", formato: (a) => (a ? "Sim" : "Não") },
];

function formulario(registro, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  ui.dialogo({
    titulo: novo ? "Novo tipo de estabelecimento" : `Editar: ${r.nome}`,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      ${ui.campoTexto("nome", "Nome", r.nome, { obrigatorio: true })}
      ${ui.campoArea("descricao", "Descrição", r.descricao)}
      ${ui.campoCheck("ativo", "Tipo ativo (aparece no cadastro de unidades)", r.ativo ?? true)}
      ${r.unidades ? `<p class="legenda">Em uso por ${r.unidades} unidade(s): pode ser desativado, mas não excluído.</p>` : ""}`,
    aoSalvar: async (f) => {
      const valores = {
        nome: ui.texto(f.get("nome")),
        descricao: ui.texto(f.get("descricao")),
        ativo: f.get("ativo") === "on",
      };
      if (!valores.nome) return "Informe o nome do tipo.";
      return novo
        ? ui.gravar(() => inserir("tipos_estabelecimento", valores), "Tipo cadastrado.", recarregar)
        : ui.gravar(() => atualizar("tipos_estabelecimento", r.id, valores), "Tipo atualizado.", recarregar);
    },
    aoExcluir:
      !novo && temPapel("admin")
        ? () => ui.gravar(() => excluir("tipos_estabelecimento", r.id), "Tipo excluído.", recarregar)
        : null,
  });
}

export async function render(el) {
  const gerencia = temPapel("admin", "gestor");
  el.innerHTML =
    ui.cabecalho(
      "Tipos de estabelecimento",
      gerencia ? '<button class="botao botao--primario" data-acao="novo">Novo tipo</button>' : "",
    ) + ui.CARREGANDO;
  let tipos, unidades;
  try {
    [tipos, unidades] = await Promise.all([listarTiposEstabelecimento(), listarUnidades()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  el.querySelector('[data-acao="novo"]')?.addEventListener("click", () => formulario(null, recarregar));

  if (!tipos.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhum tipo de estabelecimento cadastrado ainda.");
    return;
  }
  const linhas = tipos.map((t) => ({ ...t, unidades: unidades.filter((u) => u.tipo_ids.includes(t.id)).length }));
  el.querySelector(".carregando").replaceWith(
    ui.tabela(COLUNAS, linhas, gerencia ? (linha) => formulario(linha, recarregar) : null),
  );
}
