// Processos do SEI-SP acompanhados pelo núcleo.
//
// O SEI exige CAPTCHA e não aceita consultas vindas de outro site, então o
// navegador não consegue buscar os dados sozinho. A ferramenta
// ferramentas/sei/sei_busca_processo.py faz a consulta (a pessoa digita o
// CAPTCHA) e gera processos.json, que é importado aqui.
import {
  atualizar,
  excluir,
  importarProcessos,
  inserir,
  listarProcessos,
  listarUnidades,
  urlSei,
} from "../dados.js";
import { temPapel } from "../estado.js";
import * as ui from "../ui.js";

export const URL_PESQUISA_SEI =
  "https://sei.sp.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php" +
  "?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0";

// Versão do formato gerado pela ferramenta (FORMATO em sei_busca_processo.py).
const FORMATO = 1;

const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

/** Resumo do andamento mais recente (o SEI lista do mais novo para o mais antigo). */
function ultimoAndamento(processo) {
  const a = processo.andamentos?.[0];
  if (!a) return "";
  const chaves = Object.keys(a);
  const data = chaves.find((k) => /data/i.test(k));
  const descricao = chaves.find((k) => /descri/i.test(k));
  return data && descricao ? `${a[data]} — ${a[descricao]}` : Object.values(a).join(" · ");
}

const COLUNAS = [
  { campo: "numero", titulo: "Processo" },
  { campo: "unidade", titulo: "Unidade" },
  { campo: "descricao", titulo: "Descrição" },
  { campo: "tipo_processo", titulo: "Tipo no SEI" },
  { campo: "andamentos", titulo: "Último andamento", formato: (_, p) => ultimoAndamento(p) },
  { campo: "consultado_em", titulo: "Consultado em", formato: (d) => (d ? dataHora(d) : "Ainda não consultado") },
];

let busca = "";

function filtrar(processos) {
  const termo = busca.trim().toLowerCase();
  if (!termo) return processos;
  return processos.filter((p) =>
    [p.numero, p.unidade, p.descricao, p.tipo_processo].some((c) => (c ?? "").toLowerCase().includes(termo)),
  );
}

/** Colunas montadas a partir das chaves das linhas (tabelas copiadas do SEI). */
function colunasDe(linhas) {
  const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  return chaves.map((c) => ({ campo: c, titulo: c }));
}

async function consultarNoSei(numero) {
  try {
    await navigator.clipboard.writeText(numero);
    ui.aviso(`Número ${numero} copiado. Cole no campo "Nº do Processo" do SEI.`);
  } catch {
    ui.aviso(`Copie o número ${numero} e cole no campo "Nº do Processo" do SEI.`);
  }
  window.open(URL_PESQUISA_SEI, "_blank", "noopener");
}

function secaoSei(p) {
  if (!p.consultado_em) {
    return `<p class="legenda">Este processo ainda não teve dados importados do SEI.
      Use a ferramenta de consulta e o botão <strong>Importar resultado</strong> da página.</p>`;
  }
  const cabecalho = Object.entries(p.cabecalho ?? {});
  const url = urlSei(p.url);
  return `
    <p class="legenda">Dados do SEI consultados em ${ui.esc(dataHora(p.consultado_em))}${
      url ? ` · <a href="${ui.esc(url)}" target="_blank" rel="noopener">abrir no SEI</a>` : ""
    }</p>
    ${
      cabecalho.length
        ? `<dl class="dados">${cabecalho.map(([k, v]) => `<dt>${ui.esc(k)}</dt><dd>${ui.esc(v)}</dd>`).join("")}</dl>`
        : ""
    }
    <h3 class="secao__titulo">Andamentos (${p.andamentos.length})</h3>
    <div data-andamentos></div>
    <h3 class="secao__titulo">Documentos (${p.documentos.length})</h3>
    <div data-documentos></div>`;
}

function formulario(registro, unidades, recarregar) {
  const novo = !registro;
  const p = registro ?? {};
  const opcoesUnidade = unidades.filter((u) => u.ativo || u.id === p.unidade_id).map((u) => [u.id, u.nome]);

  const janela = ui.dialogo({
    titulo: novo ? "Novo processo SEI" : `Processo ${p.numero}`,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      <div class="grade grade--2">
        ${ui.campoTexto("numero", "Número do processo", p.numero, { obrigatorio: true, dica: "Ex.: 024.00120830/2026-12" })}
        ${ui.campoSelect("unidade_id", "Unidade", opcoesUnidade, p.unidade_id, { vazio: "— Nenhuma —" })}
      </div>
      ${ui.campoArea("descricao", "Descrição (para que serve o processo)", p.descricao)}
      ${
        novo
          ? ""
          : `<hr class="divisor">
             <div class="secao-sei">
               <div class="secao-sei__topo">
                 <h3 class="secao__titulo">Dados do SEI</h3>
                 <button type="button" class="botao" data-consultar>Consultar no SEI</button>
               </div>
               ${secaoSei(p)}
             </div>`
      }`,
    aoSalvar: async (f) => {
      const valores = {
        numero: ui.texto(f.get("numero")),
        unidade_id: f.get("unidade_id") ? Number(f.get("unidade_id")) : null,
        descricao: ui.texto(f.get("descricao")),
      };
      if (!valores.numero) return "Informe o número do processo.";
      return novo
        ? ui.gravar(() => inserir("processos_sei", valores), "Processo cadastrado.", recarregar)
        : ui.gravar(() => atualizar("processos_sei", p.id, valores), "Processo atualizado.", recarregar);
    },
    aoExcluir:
      !novo && temPapel("admin", "gestor")
        ? () => ui.gravar(() => excluir("processos_sei", p.id), "Processo excluído.", recarregar)
        : null,
  });

  janela.querySelector("[data-consultar]")?.addEventListener("click", () => consultarNoSei(p.numero));
  for (const [seletor, linhas, vazio] of [
    ["[data-andamentos]", p.andamentos ?? [], "Nenhum andamento."],
    ["[data-documentos]", p.documentos ?? [], "Nenhum documento público."],
  ]) {
    janela.querySelector(seletor)?.replaceWith(
      linhas.length
        ? ui.tabela(colunasDe(linhas), linhas)
        : Object.assign(document.createElement("p"), { className: "legenda", textContent: vazio }),
    );
  }
}

/** Lê o processos.json escolhido e grava no banco. Devolve a mensagem de erro, ou null. */
async function importarArquivo(arquivo, existentes) {
  let conteudo;
  try {
    conteudo = JSON.parse(await arquivo.text());
  } catch {
    return "O arquivo não é um JSON válido. Escolha o processos.json gerado pela ferramenta.";
  }
  if (conteudo?.formato !== FORMATO || !Array.isArray(conteudo.processos)) {
    return "Arquivo em formato desconhecido. Escolha o processos.json gerado pela ferramenta de consulta ao SEI.";
  }
  const encontrados = conteudo.processos.filter((p) => p.situacao === "ok" && ui.texto(p.numero));
  const ignorados = conteudo.processos.length - encontrados.length;
  if (!encontrados.length) return "O arquivo não traz nenhum processo encontrado no SEI.";

  const numeros = new Set(existentes.map((p) => p.numero));
  const novos = encontrados.filter((p) => !numeros.has(p.numero)).length;
  const erro = await ui.tentar(() => importarProcessos(encontrados));
  if (erro) return erro;
  ui.aviso(
    `${encontrados.length} processo(s) importado(s): ${novos} novo(s), ${encontrados.length - novos} atualizado(s)` +
      (ignorados ? `; ${ignorados} não encontrado(s) no SEI ficaram de fora.` : "."),
  );
  return null;
}

export async function render(el) {
  el.innerHTML =
    ui.cabecalho(
      "Processos SEI",
      `<label class="botao" title="Arquivo processos.json gerado pela ferramenta de consulta">
         Importar resultado<input type="file" accept=".json,application/json" data-importar hidden></label>
       <button class="botao botao--primario" data-acao="novo" disabled>Novo processo</button>`,
    ) +
    `<details class="ajuda">
       <summary>Como trazer andamentos e documentos do SEI</summary>
       <ol>
         <li>Cadastre o processo aqui (ou deixe que a importação cadastre).</li>
         <li>No computador, rode <code>python ferramentas/sei/sei_busca_processo.py NÚMERO</code>;
           o navegador abre, você digita o CAPTCHA e clica em Pesquisar.</li>
         <li>Clique em <strong>Importar resultado</strong> e escolha o arquivo
           <code>resultado_sei/processos.json</code> gerado.</li>
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

  const entradaArquivo = el.querySelector("[data-importar]");
  entradaArquivo.addEventListener("change", async () => {
    const arquivo = entradaArquivo.files[0];
    entradaArquivo.value = "";
    if (!arquivo) return;
    const erro = await importarArquivo(arquivo, processos);
    if (erro) ui.aviso(erro, "erro");
    else recarregar();
  });

  if (!processos.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhum processo cadastrado ainda.");
    return;
  }
  el.querySelector(".carregando").outerHTML = `
    <form class="filtros filtros--unico" role="search">
      <label class="campo"><span>Buscar</span>
        <input name="busca" type="search" value="${ui.esc(busca)}"
          placeholder="Número, unidade, descrição ou tipo do processo"></label>
    </form>
    <p class="legenda" data-resumo></p>
    <div data-lista></div>`;

  const resumo = el.querySelector("[data-resumo]");
  const lista = el.querySelector("[data-lista]");
  const desenhar = () => {
    const filtrados = filtrar(processos);
    resumo.textContent = `${filtrados.length} de ${processos.length} processos · clique numa linha para ver os detalhes`;
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
