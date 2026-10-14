// Utilitários de interface compartilhados pelas páginas.
import { ErroDados } from "./dados.js";

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa texto para inserir em HTML. Todo dado vindo do banco passa por aqui. */
export const esc = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** Normaliza campo de texto: sem espaços nas pontas e null quando vazio. */
export const texto = (valor) => (valor ?? "").toString().trim() || null;

export const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

export function hojeISO() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const CARREGANDO = '<p class="carregando">Carregando…</p>';
export const erroHTML = (mensagem) => `<div class="alerta alerta--erro">${esc(mensagem)}</div>`;
export const vazio = (mensagem) => `<p class="vazio">${esc(mensagem)}</p>`;

export function cabecalho(titulo, acoes = "") {
  return `<header class="pagina__cabecalho"><h1>${esc(titulo)}</h1><div class="acoes">${acoes}</div></header>`;
}

export function aviso(mensagem, tipo = "ok") {
  const item = document.createElement("div");
  item.className = `aviso aviso--${tipo}`;
  item.textContent = mensagem;
  document.getElementById("avisos").append(item);
  setTimeout(() => item.remove(), 4000);
}

/** Executa uma gravação; devolve a mensagem de erro, ou null se deu certo. */
export async function tentar(acao) {
  try {
    await acao();
    return null;
  } catch (erro) {
    if (erro instanceof ErroDados) return erro.message;
    console.error(erro);
    return "Erro inesperado. Tente novamente.";
  }
}

/** Grava, avisa o sucesso e chama `depois` (normalmente recarregar a página). */
export async function gravar(acao, mensagem, depois) {
  const erro = await tentar(acao);
  if (!erro) {
    aviso(mensagem);
    depois?.();
  }
  return erro;
}

const valorCelula = (coluna, linha) =>
  coluna.formato ? coluna.formato(linha[coluna.campo], linha) : linha[coluna.campo];

/** Tabela com linhas clicáveis (quando `aoClicar` é informado). */
export function tabela(colunas, linhas, aoClicar) {
  const rolagem = document.createElement("div");
  rolagem.className = "tabela-rolagem";
  const t = document.createElement("table");
  t.className = "tabela";
  t.innerHTML = `<thead><tr>${colunas.map((c) => `<th scope="col">${esc(c.titulo)}</th>`).join("")}</tr></thead>`;
  const corpo = document.createElement("tbody");
  for (const linha of linhas) {
    const tr = document.createElement("tr");
    tr.innerHTML = colunas.map((c) => `<td>${esc(valorCelula(c, linha))}</td>`).join("");
    if (aoClicar) {
      tr.className = "clicavel";
      tr.tabIndex = 0;
      tr.addEventListener("click", () => aoClicar(linha));
      tr.addEventListener("keydown", (e) => e.key === "Enter" && aoClicar(linha));
    }
    corpo.append(tr);
  }
  t.append(corpo);
  rolagem.append(t);
  return rolagem;
}

export function baixarCSV(nome, colunas, linhas) {
  const celula = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const conteudo = [
    colunas.map((c) => celula(c.titulo)).join(";"),
    ...linhas.map((l) => colunas.map((c) => celula(valorCelula(c, l))).join(";")),
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" }));
  link.download = `${nome}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---------------------------------------------------------------------------
// Campos de formulário
// ---------------------------------------------------------------------------

const rotuloHTML = (rotulo, obrigatorio) => `<span>${esc(rotulo)}${obrigatorio ? " *" : ""}</span>`;

export function campoTexto(nome, rotulo, valor, { obrigatorio = false, tipo = "text", lista, dica } = {}) {
  return `<label class="campo">${rotuloHTML(rotulo, obrigatorio)}
    <input name="${nome}" type="${tipo}" value="${esc(valor)}"${obrigatorio ? " required" : ""}${
      lista ? ` list="${lista}"` : ""
    }${dica ? ` placeholder="${esc(dica)}"` : ""}></label>`;
}

/** `opcoes`: lista de [valor, rótulo]. `vazio`: rótulo da opção sem valor, se houver. */
export function campoSelect(nome, rotulo, opcoes, valor, { obrigatorio = false, vazio, desabilitado = false } = {}) {
  const atual = String(valor ?? "");
  const itens = [
    vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : "",
    ...opcoes.map(
      ([v, r]) => `<option value="${esc(v)}"${String(v) === atual ? " selected" : ""}>${esc(r)}</option>`,
    ),
  ].join("");
  return `<label class="campo">${rotuloHTML(rotulo, obrigatorio)}
    <select name="${nome}"${obrigatorio ? " required" : ""}${desabilitado ? " disabled" : ""}>${itens}</select></label>`;
}

export function campoArea(nome, rotulo, valor) {
  return `<label class="campo campo--largo">${rotuloHTML(rotulo)}
    <textarea name="${nome}" rows="3">${esc(valor)}</textarea></label>`;
}

export function campoCheck(nome, rotulo, marcado, { desabilitado = false } = {}) {
  return `<label class="campo-check"><input type="checkbox" name="${nome}"${marcado ? " checked" : ""}${
    desabilitado ? " disabled" : ""
  }> ${esc(rotulo)}</label>`;
}

/**
 * Janela com formulário. `aoSalvar(dados: FormData)` e `aoExcluir()` devolvem a
 * mensagem de erro (que fica na janela) ou null (a janela fecha).
 */
export function dialogo({ titulo, campos, aoSalvar, aoExcluir, somenteLeitura = false, textoSalvar = "Salvar" }) {
  const janela = document.createElement("dialog");
  janela.className = "dialogo";
  janela.innerHTML = `
    <form class="dialogo__form">
      <header class="dialogo__topo">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="botao-icone" data-acao="fechar" aria-label="Fechar">×</button>
      </header>
      <fieldset class="dialogo__campos"${somenteLeitura ? " disabled" : ""}>${campos}</fieldset>
      <p class="alerta alerta--erro" hidden></p>
      <footer class="dialogo__rodape">
        ${aoExcluir ? '<button type="button" class="botao botao--perigo" data-acao="excluir">Excluir</button>' : ""}
        <span class="espaco"></span>
        <button type="button" class="botao" data-acao="fechar">${somenteLeitura ? "Fechar" : "Cancelar"}</button>
        ${somenteLeitura ? "" : `<button type="submit" class="botao botao--primario">${esc(textoSalvar)}</button>`}
      </footer>
    </form>`;
  document.body.append(janela);

  const form = janela.querySelector("form");
  const alerta = janela.querySelector(".alerta");
  const botoes = janela.querySelectorAll("footer button");
  janela.addEventListener("close", () => janela.remove());
  // Link para outra página do sistema dentro da janela: fecha a janela ao navegar.
  janela.addEventListener("click", (e) => e.target.closest('a[href^="#"]') && janela.close());

  async function executar(acao) {
    botoes.forEach((b) => (b.disabled = true));
    alerta.hidden = true;
    const erro = await acao();
    if (!erro) return janela.close();
    alerta.textContent = erro;
    alerta.hidden = false;
    botoes.forEach((b) => (b.disabled = false));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    executar(() => aoSalvar(new FormData(form)));
  });
  janela.querySelectorAll('[data-acao="fechar"]').forEach((b) => b.addEventListener("click", () => janela.close()));
  janela.querySelector('[data-acao="excluir"]')?.addEventListener("click", () => {
    if (confirm("Confirma a exclusão deste registro?")) executar(aoExcluir);
  });

  janela.showModal();
  return janela;
}
