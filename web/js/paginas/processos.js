// Processos do SEI e suas notas de empenho.
//
// Os números das notas podem ser digitados aqui ou trazidos do SEI pelo script
// do Tampermonkey (ferramentas/sei-nota-empenho.user.js): lá, o botão
// "Copiar para o nie" copia o resultado, e aqui "Colar do SEI" o cadastra.
import {
  excluir,
  importarEmpenhos,
  listarProcessos,
  listarUnidades,
  normalizarEmpenho,
  salvarProcesso,
} from "../dados.js";
import { temPapel } from "../estado.js";
import { montarLista, secaoLista } from "../lista-editavel.js";
import * as ui from "../ui.js";

// Identificação do conteúdo copiado pelo script do SEI (mesmos valores lá).
const FORMATO_SEI = "nie-empenhos";
const VERSAO_SEI = 1;
const URL_SCRIPT = "ferramentas/sei-nota-empenho.user.js";

const COLUNAS = [
  { campo: "numero", titulo: "Processo" },
  { campo: "unidade", titulo: "Unidade" },
  { campo: "descricao", titulo: "Descrição" },
  { campo: "empenhos", titulo: "Notas de empenho", formato: (e) => e.join(", ") },
];

let busca = "";

function filtrar(processos) {
  const termo = busca.trim().toLowerCase();
  if (!termo) return processos;
  return processos.filter((p) =>
    [p.numero, p.unidade, p.descricao, ...p.empenhos].some((c) => (c ?? "").toLowerCase().includes(termo)),
  );
}

function formulario(registro, unidades, recarregar) {
  const novo = !registro;
  const p = registro ?? {};
  const opcoesUnidade = unidades.filter((u) => u.ativo || u.id === p.unidade_id).map((u) => [u.id, u.nome]);
  let editorEmpenhos;

  const janela = ui.dialogo({
    titulo: novo ? "Novo processo" : `Processo ${p.numero}`,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      <div class="grade grade--2">
        ${ui.campoTexto("numero", "Número do processo (SEI)", p.numero, { obrigatorio: true, dica: "Ex.: 024.00120830/2026-12" })}
        ${ui.campoSelect("unidade_id", "Unidade", opcoesUnidade, p.unidade_id, { vazio: "— Nenhuma —" })}
      </div>
      ${ui.campoArea("descricao", "Descrição (para que serve o processo)", p.descricao)}
      <hr class="divisor">
      ${secaoLista({
        chave: "empenhos",
        titulo: "Notas de empenho",
        descricao: "Adicione os números das notas de empenho do processo.",
        rotulo: "Nota de empenho",
        dica: "Ex.: 2026NE000123",
      })}`,
    aoSalvar: async (f) => {
      if (editorEmpenhos.emEdicao()) return "Confirme ou cancele a edição da nota de empenho antes de salvar.";
      const valores = {
        numero: ui.texto(f.get("numero")),
        unidade_id: f.get("unidade_id") ? Number(f.get("unidade_id")) : null,
        descricao: ui.texto(f.get("descricao")),
      };
      if (!valores.numero) return "Informe o número do processo.";
      return ui.gravar(
        () => salvarProcesso(p.id, valores, editorEmpenhos.valores()),
        novo ? "Processo cadastrado." : "Processo atualizado.",
        recarregar,
      );
    },
    aoExcluir:
      !novo && temPapel("admin", "gestor")
        ? () => ui.gravar(() => excluir("processos", p.id), "Processo excluído.", recarregar)
        : null,
  });
  editorEmpenhos = montarLista(janela.querySelector("[data-empenhos]"), p.empenhos ?? [], {
    rotulo: "Nota de empenho",
    nome: "empenho",
    normalizar: normalizarEmpenho,
    chaveComparacao: (t) => t,
  });
}

/** Lê o texto copiado pelo script do SEI. Devolve { processo, empenhos } ou a mensagem de erro. */
export function lerConteudoSei(texto) {
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    return { erro: 'Cole o conteúdo copiado pelo botão "Copiar para o nie" do script no SEI.' };
  }
  if (dados?.formato !== FORMATO_SEI || dados.versao !== VERSAO_SEI) {
    return { erro: 'Conteúdo não reconhecido. Use o botão "Copiar para o nie" do script no SEI.' };
  }
  const processo = ui.texto(dados.processo);
  const empenhos = (Array.isArray(dados.empenhos) ? dados.empenhos : [])
    .map((e) => normalizarEmpenho(String(e)))
    .filter(Boolean);
  if (!processo) return { erro: "O conteúdo não traz o número do processo." };
  if (!empenhos.length) return { erro: "O conteúdo não traz nenhum número de nota de empenho." };
  return { processo, empenhos };
}

function colarDoSei(recarregar) {
  ui.dialogo({
    titulo: "Colar do SEI",
    textoSalvar: "Cadastrar",
    campos: `
      <p class="legenda">No SEI, use o botão <strong>Consultar Empenho</strong> do script e, no
        resultado, <strong>Copiar para o nie</strong>. Depois cole aqui (Ctrl+V).</p>
      <label class="campo campo--largo"><span>Conteúdo copiado do SEI</span>
        <textarea name="conteudo" rows="6"></textarea></label>`,
    aoSalvar: async (f) => {
      const lido = lerConteudoSei(f.get("conteudo"));
      if (lido.erro) return lido.erro;
      let resultado;
      const erro = await ui.tentar(async () => {
        resultado = await importarEmpenhos(lido.processo, lido.empenhos);
      });
      if (erro) return erro;
      const jaExistiam = lido.empenhos.length - resultado.adicionados;
      ui.aviso(
        `Processo ${lido.processo}${resultado.novo_processo ? " cadastrado" : ""}: ` +
          `${resultado.adicionados} nota(s) de empenho adicionada(s)` +
          (jaExistiam ? `, ${jaExistiam} já estava(m) cadastrada(s).` : "."),
      );
      recarregar();
      return null;
    },
  });
}

export async function render(el) {
  el.innerHTML =
    ui.cabecalho(
      "Processos",
      `<button class="botao" data-acao="colar">Colar do SEI</button>
       <button class="botao botao--primario" data-acao="novo" disabled>Novo processo</button>`,
    ) +
    `<details class="ajuda">
       <summary>Como trazer as notas de empenho do SEI</summary>
       <ol>
         <li>Instale a extensão <strong>Tampermonkey</strong> no Edge ou Chrome e depois
           <a href="${URL_SCRIPT}" target="_blank" rel="noopener">instale o script "SEI - Localizar Nota de Empenho"</a>.</li>
         <li>Entre no SEI-SP, clique em <strong>Consultar Empenho</strong> (canto inferior esquerdo) e informe o processo.</li>
         <li>No resultado, clique em <strong>Copiar para o nie</strong>; aqui, clique em <strong>Colar do SEI</strong>.</li>
       </ol>
     </details>` +
    ui.CARREGANDO;

  let processos, unidades;
  try {
    [processos, unidades] = await Promise.all([listarProcessos(), listarUnidades()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  const botaoNovo = el.querySelector('[data-acao="novo"]');
  botaoNovo.disabled = false;
  botaoNovo.addEventListener("click", () => formulario(null, unidades, recarregar));
  el.querySelector('[data-acao="colar"]').addEventListener("click", () => colarDoSei(recarregar));

  if (!processos.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhum processo cadastrado ainda.");
    return;
  }
  el.querySelector(".carregando").outerHTML = `
    <form class="filtros filtros--unico" role="search">
      <label class="campo"><span>Buscar</span>
        <input name="busca" type="search" value="${ui.esc(busca)}"
          placeholder="Número do processo, unidade, descrição ou nota de empenho"></label>
    </form>
    <p class="legenda" data-resumo></p>
    <div data-lista></div>`;

  const resumo = el.querySelector("[data-resumo]");
  const lista = el.querySelector("[data-lista]");
  const desenhar = () => {
    const filtrados = filtrar(processos);
    resumo.textContent = `${filtrados.length} de ${processos.length} processos · clique numa linha para ver ou editar`;
    lista.replaceChildren(
      filtrados.length
        ? ui.tabela(COLUNAS, filtrados, (linha) => formulario(linha, unidades, recarregar))
        : Object.assign(document.createElement("p"), { className: "vazio", textContent: "Nenhum processo encontrado." }),
    );
  };
  const formBusca = el.querySelector(".filtros");
  formBusca.addEventListener("submit", (e) => e.preventDefault());
  formBusca.addEventListener("input", (e) => {
    busca = e.target.value;
    desenhar();
  });
  desenhar();
}
