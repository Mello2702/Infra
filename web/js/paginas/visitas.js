// Controle de visitas às unidades.
import { STATUS_VISITA, TIPOS_VISITA } from "../constantes.js";
import { atualizar, excluir, inserir, listarPerfis, listarUnidades, listarVisitas } from "../dados.js";
import { sessao, temPapel } from "../estado.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "data_visita", titulo: "Data", formato: ui.dataBR },
  { campo: "unidade", titulo: "Unidade" },
  { campo: "tipo", titulo: "Tipo" },
  { campo: "status", titulo: "Status", formato: (s) => STATUS_VISITA[s] },
  { campo: "tecnico", titulo: "Técnico" },
  { campo: "objetivo", titulo: "Objetivo" },
  { campo: "pendencias", titulo: "Pendências" },
];

const filtros = { unidade: "", tecnico: "", status: "" };

function filtrar(visitas) {
  return visitas.filter(
    (v) =>
      (!filtros.unidade || v.unidade === filtros.unidade) &&
      (!filtros.tecnico || v.tecnico === filtros.tecnico) &&
      (!filtros.status || v.status === filtros.status),
  );
}

const opcoesDe = (valores) => [...new Set(valores.filter(Boolean))].sort().map((v) => [v, v]);

function formulario(registro, unidades, perfis, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  const gerencia = temPapel("admin", "gestor");
  // Técnico só registra e altera visitas em seu próprio nome (mesma regra da RLS).
  const podeEditar = novo || gerencia || r.tecnico_id === sessao.usuario.id;
  const tecnicoAtual = r.tecnico_id ?? sessao.usuario.id;

  const opcoesUnidade = unidades.filter((u) => u.ativo || u.id === r.unidade_id).map((u) => [u.id, u.nome]);
  const opcoesTecnico = perfis.filter((p) => p.ativo || p.id === tecnicoAtual).map((p) => [p.id, p.nome]);
  const tipos = [...new Set([...TIPOS_VISITA, ...(r.tipo ? [r.tipo] : [])])].map((t) => [t, t]);

  ui.dialogo({
    titulo: novo ? "Nova visita" : `${r.unidade} — ${ui.dataBR(r.data_visita)}`,
    textoSalvar: novo ? "Registrar" : "Salvar",
    somenteLeitura: !podeEditar,
    campos: `
      ${podeEditar ? "" : '<p class="legenda">Somente o técnico responsável ou um gestor pode editar esta visita.</p>'}
      <div class="grade">
        ${ui.campoSelect("unidade_id", "Unidade", opcoesUnidade, r.unidade_id, { obrigatorio: true, vazio: "Escolha a unidade" })}
        ${ui.campoTexto("data_visita", "Data da visita", r.data_visita ?? ui.hojeISO(), { obrigatorio: true, tipo: "date" })}
        ${ui.campoSelect("tipo", "Tipo", tipos, r.tipo ?? TIPOS_VISITA[0])}
        ${ui.campoSelect("tecnico_id", "Técnico responsável", opcoesTecnico, tecnicoAtual, { desabilitado: !gerencia })}
        ${ui.campoSelect("status", "Status", Object.entries(STATUS_VISITA), r.status ?? "agendada")}
      </div>
      ${ui.campoArea("objetivo", "Objetivo da visita", r.objetivo)}
      ${ui.campoArea("relato", "Relato (o que foi feito)", r.relato)}
      ${ui.campoArea("pendencias", "Pendências", r.pendencias)}`,
    aoSalvar: async (f) => {
      if (!f.get("unidade_id")) return "Escolha a unidade.";
      if (!f.get("data_visita")) return "Informe a data da visita.";
      const valores = {
        unidade_id: Number(f.get("unidade_id")),
        // Campo desabilitado não entra no formulário: aí vale o técnico atual.
        tecnico_id: f.get("tecnico_id") || tecnicoAtual,
        data_visita: f.get("data_visita"),
        tipo: f.get("tipo"),
        status: f.get("status"),
        objetivo: ui.texto(f.get("objetivo")),
        relato: ui.texto(f.get("relato")),
        pendencias: ui.texto(f.get("pendencias")),
      };
      return novo
        ? ui.gravar(() => inserir("visitas", valores), "Visita registrada.", recarregar)
        : ui.gravar(() => atualizar("visitas", r.id, valores), "Visita atualizada.", recarregar);
    },
    aoExcluir: !novo && gerencia ? () => ui.gravar(() => excluir("visitas", r.id), "Visita excluída.", recarregar) : null,
  });
}

export async function render(el) {
  el.innerHTML =
    ui.cabecalho(
      "Visitas às unidades",
      '<button class="botao" data-acao="csv" hidden>Exportar CSV</button>' +
        '<button class="botao botao--primario" data-acao="nova" disabled>Nova visita</button>',
    ) + ui.CARREGANDO;
  let unidades, perfis, visitas;
  try {
    [unidades, perfis, visitas] = await Promise.all([listarUnidades(), listarPerfis(), listarVisitas()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  const botaoNova = el.querySelector('[data-acao="nova"]');
  if (unidades.some((u) => u.ativo)) {
    botaoNova.disabled = false;
    botaoNova.addEventListener("click", () => formulario(null, unidades, perfis, recarregar));
  } else {
    botaoNova.title = "Cadastre uma unidade antes de registrar visitas.";
  }

  if (!visitas.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio(
      unidades.length ? "Nenhuma visita registrada ainda." : "Cadastre uma unidade antes de registrar visitas.",
    );
    return;
  }

  el.querySelector(".carregando").outerHTML = `
    <form class="filtros">
      ${ui.campoSelect("unidade", "Unidade", opcoesDe(visitas.map((v) => v.unidade)), filtros.unidade, { vazio: "Todas" })}
      ${ui.campoSelect("tecnico", "Técnico", opcoesDe(visitas.map((v) => v.tecnico)), filtros.tecnico, { vazio: "Todos" })}
      ${ui.campoSelect("status", "Status", Object.entries(STATUS_VISITA), filtros.status, { vazio: "Todos" })}
    </form>
    <p class="legenda" data-resumo></p>
    <div data-lista></div>`;

  const resumo = el.querySelector("[data-resumo]");
  const lista = el.querySelector("[data-lista]");
  const desenhar = () => {
    const filtradas = filtrar(visitas);
    resumo.textContent = `${filtradas.length} de ${visitas.length} visitas · clique numa linha para ver ou editar`;
    lista.replaceChildren(
      filtradas.length
        ? ui.tabela(COLUNAS, filtradas, (linha) => formulario(linha, unidades, perfis, recarregar))
        : Object.assign(document.createElement("p"), {
            className: "vazio",
            textContent: "Nenhuma visita com esses filtros.",
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
  botaoCSV.addEventListener("click", () => ui.baixarCSV("visitas", COLUNAS, filtrar(visitas)));
  desenhar();
}
