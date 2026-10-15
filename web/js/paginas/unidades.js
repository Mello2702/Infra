// Cadastro de unidades atendidas pelo núcleo, com seus tipos de estabelecimento.
import { UFS } from "../constantes.js";
import { excluir, listarTiposEstabelecimento, listarUnidades, salvarUnidade } from "../dados.js";
import { temPapel } from "../estado.js";
import { montarLista, secaoLista } from "../lista-editavel.js";
import * as ui from "../ui.js";

const ICONE_UNIDADE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4"/></svg>';
const ICONE_LOCAL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const ICONE_DETALHES =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>';

// Mantida entre recarregamentos da página (ex.: depois de salvar).
let busca = "";

function filtrar(unidades) {
  const termo = busca.trim().toLowerCase();
  if (!termo) return unidades;
  return unidades.filter((u) =>
    [u.nome, u.razao_social, u.cidade, u.uge, u.endereco, ...u.tipos].some((c) => (c ?? "").toLowerCase().includes(termo)),
  );
}

function cartao(u) {
  const local = [u.cidade, u.uf].filter(Boolean).join(" - ");
  return `
    <article class="cartao-unidade${u.ativo ? "" : " cartao-unidade--inativa"}">
      <header class="cartao-unidade__topo">
        <span class="cartao-unidade__icone">${ICONE_UNIDADE}</span>
        <div>
          <h2 class="cartao-unidade__nome">${ui.esc(u.nome)}</h2>
          ${u.razao_social ? `<p class="cartao-unidade__razao">${ui.esc(u.razao_social)}</p>` : ""}
        </div>
      </header>
      ${u.endereco ? `<p class="cartao-unidade__endereco">${ICONE_LOCAL}<span>${ui.esc(u.endereco)}</span></p>` : ""}
      <div class="selos">
        ${local ? `<span class="selo">${ui.esc(local)}</span>` : ""}
        ${u.uge ? `<span class="selo">UGE ${ui.esc(u.uge)}</span>` : ""}
        ${u.tipos.map((t) => `<span class="selo selo--tipo">${ui.esc(t)}</span>`).join("")}
        ${u.ativo ? "" : '<span class="selo selo--alerta">Inativa</span>'}
      </div>
      <footer class="cartao-unidade__rodape">
        <button type="button" class="botao" data-detalhes="${u.id}">${ICONE_DETALHES} Ver detalhes</button>
      </footer>
    </article>`;
}

function formulario(registro, catalogo, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  // Técnicos veem os detalhes, mas só gestores e administradores editam (mesma regra da RLS).
  const podeEditar = temPapel("admin", "gestor");
  let editorTipos;

  const janela = ui.dialogo({
    titulo: novo ? "Nova unidade" : podeEditar ? `Editar: ${r.nome}` : r.nome,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    somenteLeitura: !podeEditar,
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
      ${secaoLista({
        chave: "tipos",
        titulo: "Tipos de estabelecimento",
        descricao: "Adicione os tipos de estabelecimento da unidade. Um tipo novo entra também no catálogo.",
        rotulo: "Tipo de estabelecimento",
        dica: "Digite o tipo de estabelecimento…",
        sugestoes: catalogo.filter((t) => t.ativo).map((t) => t.nome),
      })}`,
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
  editorTipos = montarLista(janela.querySelector("[data-tipos]"), r.tipos ?? [], {
    rotulo: "Tipo de estabelecimento",
    nome: "tipo",
  });
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

  el.querySelector(".carregando").outerHTML = `
    <form class="filtros filtros--unico" role="search">
      <label class="campo"><span>Buscar</span>
        <input name="busca" type="search" value="${ui.esc(busca)}"
          placeholder="Nome, razão social, cidade, UGE ou tipo de estabelecimento"></label>
    </form>
    <p class="legenda" data-resumo></p>
    <div class="cartoes" data-cartoes></div>`;

  const resumo = el.querySelector("[data-resumo]");
  const area = el.querySelector("[data-cartoes]");
  const desenhar = () => {
    const filtradas = filtrar(unidades);
    resumo.textContent = `${filtradas.length} de ${unidades.length} unidades`;
    area.innerHTML = filtradas.length
      ? filtradas.map(cartao).join("")
      : ui.vazio("Nenhuma unidade encontrada para essa busca.");
  };
  area.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-detalhes]");
    if (botao) formulario(unidades.find((u) => u.id === Number(botao.dataset.detalhes)), catalogo, recarregar);
  });
  const formBusca = el.querySelector(".filtros");
  formBusca.addEventListener("submit", (e) => e.preventDefault());
  formBusca.addEventListener("input", (e) => {
    busca = e.target.value;
    desenhar();
  });
  desenhar();
}
