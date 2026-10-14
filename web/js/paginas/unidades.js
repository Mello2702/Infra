// Cadastro de unidades atendidas pelo núcleo, com seus tipos de estabelecimento.
import { UFS } from "../constantes.js";
import { excluir, listarTiposEstabelecimento, listarUnidades, salvarUnidade } from "../dados.js";
import { temPapel } from "../estado.js";
import { montarListaTipos, secaoTipos } from "../lista-tipos.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "nome", titulo: "Nome fantasia" },
  { campo: "tipos", titulo: "Tipos de estabelecimento", formato: (tipos) => tipos.join(", ") },
  { campo: "razao_social", titulo: "Razão social" },
  { campo: "uge", titulo: "UGE" },
  { campo: "endereco", titulo: "Endereço" },
  { campo: "cidade", titulo: "Cidade" },
  { campo: "uf", titulo: "UF" },
  { campo: "ativo", titulo: "Ativa", formato: (a) => (a ? "Sim" : "Não") },
];

const ICONE_UNIDADE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4"/></svg>';

function formulario(registro, catalogo, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  let editorTipos;

  const janela = ui.dialogo({
    titulo: novo ? "Nova unidade" : `Editar: ${r.nome}`,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      <h3 class="secao__titulo">${ICONE_UNIDADE} Informações da unidade</h3>
      <div class="grade grade--2">
        ${ui.campoTexto("nome", "Nome fantasia", r.nome, { obrigatorio: true })}
        ${ui.campoTexto("razao_social", "Razão social", r.razao_social)}
        ${ui.campoTexto("uge", "UGE", r.uge, { dica: "Código" })}
      </div>
      ${ui.campoTexto("endereco", "Endereço", r.endereco)}
      <div class="grade grade--2">
        ${ui.campoTexto("cidade", "Cidade", r.cidade)}
        ${ui.campoSelect("uf", "Estado (UF)", UFS.map((uf) => [uf, uf]), novo ? "SP" : r.uf, { vazio: "—" })}
      </div>
      ${ui.campoCheck("ativo", "Unidade ativa", r.ativo ?? true)}
      <hr class="divisor">
      ${secaoTipos(catalogo.filter((t) => t.ativo).map((t) => t.nome))}`,
    aoSalvar: async (f) => {
      if (editorTipos.emEdicao()) return "Confirme ou cancele a edição do tipo antes de salvar.";
      const valores = {
        nome: ui.texto(f.get("nome")),
        razao_social: ui.texto(f.get("razao_social")),
        endereco: ui.texto(f.get("endereco")),
        cidade: ui.texto(f.get("cidade")),
        uf: f.get("uf") || null,
        uge: ui.texto(f.get("uge")),
        ativo: f.get("ativo") === "on",
      };
      if (!valores.nome) return "Informe o nome fantasia da unidade.";
      return ui.gravar(
        () => salvarUnidade(r.id, valores, editorTipos.valores()),
        novo ? "Unidade cadastrada." : "Unidade atualizada.",
        recarregar,
      );
    },
    aoExcluir:
      !novo && temPapel("admin")
        ? () => ui.gravar(() => excluir("unidades", r.id), "Unidade excluída.", recarregar)
        : null,
  });
  editorTipos = montarListaTipos(janela.querySelector("[data-tipos]"), r.tipos ?? []);
}

export async function render(el) {
  const gerencia = temPapel("admin", "gestor");
  el.innerHTML =
    ui.cabecalho(
      "Unidades",
      gerencia ? '<button class="botao botao--primario" data-acao="nova" disabled>Nova unidade</button>' : "",
    ) + ui.CARREGANDO;
  let unidades, catalogo;
  try {
    [unidades, catalogo] = await Promise.all([listarUnidades(), listarTiposEstabelecimento()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  const botaoNova = el.querySelector('[data-acao="nova"]');
  if (botaoNova) {
    botaoNova.disabled = false;
    botaoNova.addEventListener("click", () => formulario(null, catalogo, recarregar));
  }

  if (!unidades.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhuma unidade cadastrada ainda.");
    return;
  }
  el.querySelector(".carregando").replaceWith(
    ui.tabela(COLUNAS, unidades, gerencia ? (linha) => formulario(linha, catalogo, recarregar) : null),
  );
}
