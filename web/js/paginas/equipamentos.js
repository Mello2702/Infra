// Inventário de equipamentos.
import { STATUS_EQUIPAMENTO, TIPOS_EQUIPAMENTO } from "../constantes.js";
import { atualizar, excluir, inserir, listarEquipamentos, listarUnidades } from "../dados.js";
import { temPapel } from "../estado.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "patrimonio", titulo: "Patrimônio" },
  { campo: "tipo", titulo: "Tipo" },
  { campo: "marca", titulo: "Marca" },
  { campo: "modelo", titulo: "Modelo" },
  { campo: "numero_serie", titulo: "Nº de série" },
  { campo: "unidade", titulo: "Unidade" },
  { campo: "localizacao", titulo: "Localização" },
  { campo: "status", titulo: "Status", formato: (s) => STATUS_EQUIPAMENTO[s] },
  { campo: "data_aquisicao", titulo: "Aquisição", formato: ui.dataBR },
];

// Mantidos entre recarregamentos da página (ex.: depois de salvar).
const filtros = { busca: "", unidade: "", tipo: "", status: "" };

function filtrar(equipamentos) {
  const termo = filtros.busca.trim().toLowerCase();
  return equipamentos.filter(
    (e) =>
      (!termo ||
        [e.patrimonio, e.marca, e.modelo, e.numero_serie].some((c) => (c ?? "").toLowerCase().includes(termo))) &&
      (!filtros.unidade || e.unidade === filtros.unidade) &&
      (!filtros.tipo || e.tipo === filtros.tipo) &&
      (!filtros.status || e.status === filtros.status),
  );
}

const opcoesDe = (valores) => [...new Set(valores.filter(Boolean))].sort().map((v) => [v, v]);

function formulario(registro, unidades, equipamentos, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  const opcoesUnidade = unidades.filter((u) => u.ativo || u.id === r.unidade_id).map((u) => [u.id, u.nome]);
  const tipos = [...new Set([...TIPOS_EQUIPAMENTO, ...equipamentos.map((e) => e.tipo)])];

  ui.dialogo({
    titulo: novo ? "Novo equipamento" : `Editar: ${r.tipo} ${r.patrimonio ?? ""}`.trim(),
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      <div class="grade">
        ${ui.campoTexto("patrimonio", "Patrimônio", r.patrimonio)}
        ${ui.campoTexto("tipo", "Tipo", r.tipo, { obrigatorio: true, lista: "tipos-equipamento", dica: "Escolha ou digite" })}
        <datalist id="tipos-equipamento">${tipos.map((t) => `<option value="${ui.esc(t)}">`).join("")}</datalist>
        ${ui.campoTexto("marca", "Marca", r.marca)}
        ${ui.campoTexto("modelo", "Modelo", r.modelo)}
        ${ui.campoTexto("numero_serie", "Nº de série", r.numero_serie)}
        ${ui.campoSelect("unidade_id", "Unidade", opcoesUnidade, r.unidade_id, { vazio: "— Sem unidade —" })}
        ${ui.campoTexto("localizacao", "Localização (sala, andar, rack)", r.localizacao)}
        ${ui.campoSelect("status", "Status", Object.entries(STATUS_EQUIPAMENTO), r.status ?? "em_uso")}
        ${ui.campoTexto("data_aquisicao", "Data de aquisição", r.data_aquisicao, { tipo: "date" })}
      </div>
      ${ui.campoArea("observacoes", "Observações", r.observacoes)}`,
    aoSalvar: async (f) => {
      const valores = {
        patrimonio: ui.texto(f.get("patrimonio")),
        tipo: ui.texto(f.get("tipo")),
        marca: ui.texto(f.get("marca")),
        modelo: ui.texto(f.get("modelo")),
        numero_serie: ui.texto(f.get("numero_serie")),
        unidade_id: f.get("unidade_id") ? Number(f.get("unidade_id")) : null,
        localizacao: ui.texto(f.get("localizacao")),
        status: f.get("status"),
        data_aquisicao: f.get("data_aquisicao") || null,
        observacoes: ui.texto(f.get("observacoes")),
      };
      if (!valores.tipo) return "Informe o tipo do equipamento.";
      return novo
        ? ui.gravar(() => inserir("equipamentos", valores), "Equipamento cadastrado.", recarregar)
        : ui.gravar(() => atualizar("equipamentos", r.id, valores), "Equipamento atualizado.", recarregar);
    },
    aoExcluir:
      !novo && temPapel("admin", "gestor")
        ? () => ui.gravar(() => excluir("equipamentos", r.id), "Equipamento excluído.", recarregar)
        : null,
  });
}

export async function render(el) {
  el.innerHTML =
    ui.cabecalho(
      "Inventário de equipamentos",
      '<button class="botao" data-acao="csv" hidden>Exportar CSV</button>' +
        '<button class="botao botao--primario" data-acao="novo" disabled>Novo equipamento</button>',
    ) + ui.CARREGANDO;
  let unidades, equipamentos;
  try {
    [unidades, equipamentos] = await Promise.all([listarUnidades(), listarEquipamentos()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  const botaoNovo = el.querySelector('[data-acao="novo"]');
  botaoNovo.disabled = false;
  botaoNovo.addEventListener("click", () => formulario(null, unidades, equipamentos, recarregar));

  if (!equipamentos.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhum equipamento cadastrado ainda.");
    return;
  }

  el.querySelector(".carregando").outerHTML = `
    <form class="filtros" role="search">
      <label class="campo campo--busca"><span>Buscar</span>
        <input name="busca" type="search" placeholder="Patrimônio, marca, modelo ou nº de série" value="${ui.esc(filtros.busca)}"></label>
      ${ui.campoSelect("unidade", "Unidade", opcoesDe(equipamentos.map((e) => e.unidade)), filtros.unidade, { vazio: "Todas" })}
      ${ui.campoSelect("tipo", "Tipo", opcoesDe(equipamentos.map((e) => e.tipo)), filtros.tipo, { vazio: "Todos" })}
      ${ui.campoSelect("status", "Status", Object.entries(STATUS_EQUIPAMENTO), filtros.status, { vazio: "Todos" })}
    </form>
    <p class="legenda" data-resumo></p>
    <div data-lista></div>`;

  const resumo = el.querySelector("[data-resumo]");
  const lista = el.querySelector("[data-lista]");
  const desenhar = () => {
    const filtrados = filtrar(equipamentos);
    resumo.textContent = `${filtrados.length} de ${equipamentos.length} equipamentos · clique numa linha para editar`;
    lista.replaceChildren(
      filtrados.length
        ? ui.tabela(COLUNAS, filtrados, (linha) => formulario(linha, unidades, equipamentos, recarregar))
        : Object.assign(document.createElement("p"), {
            className: "vazio",
            textContent: "Nenhum equipamento com esses filtros.",
          }),
    );
  };

  const formFiltros = el.querySelector(".filtros");
  formFiltros.addEventListener("submit", (e) => e.preventDefault());
  formFiltros.addEventListener("input", (e) => {
    filtros[e.target.name] = e.target.value;
    desenhar();
  });
  const botaoCSV = el.querySelector('[data-acao="csv"]');
  botaoCSV.hidden = false;
  botaoCSV.addEventListener("click", () => ui.baixarCSV("equipamentos", COLUNAS, filtrar(equipamentos)));
  desenhar();
}
