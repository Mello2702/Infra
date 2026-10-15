// Editor de lista dentro de um formulário: campo para digitar (com sugestões
// opcionais) + botão Adicionar, e tabela com editar/remover em cada linha.
// Usado nos tipos de estabelecimento da unidade e nas notas de empenho do processo.
import { esc } from "./ui.js";

const ICONE_EDITAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
const ICONE_REMOVER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICONE_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L19 8"/></svg>';
const ICONE_CANCELAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let contador = 0;

/**
 * HTML da seção; depois de inserido na página, chame `montarLista`.
 * `chave` vira o atributo data-<chave> da seção.
 */
export function secaoLista({ chave, titulo, descricao, rotulo, dica, sugestoes = [] }) {
  const lista = `sugestoes-${chave}-${++contador}`;
  return `
    <section class="secao-lista" data-${chave}>
      <h3 class="secao__titulo">${esc(titulo)}</h3>
      ${descricao ? `<p class="legenda">${esc(descricao)}</p>` : ""}
      <div class="secao-lista__entrada">
        <input type="text" aria-label="${esc(rotulo)}" placeholder="${esc(dica)}"
          ${sugestoes.length ? `list="${lista}"` : ""} data-novo>
        <button type="button" class="botao" data-adicionar disabled>+ Adicionar</button>
      </div>
      ${sugestoes.length ? `<datalist id="${lista}">${sugestoes.map((s) => `<option value="${esc(s)}">`).join("")}</datalist>` : ""}
      <p class="alerta alerta--erro" data-erro-lista hidden></p>
      <div data-linhas></div>
    </section>`;
}

/**
 * Liga os eventos da seção e devolve `{ valores(), emEdicao() }`.
 *
 * - `rotulo`: título da coluna (ex.: "Tipo de estabelecimento");
 * - `nome`: como o item é chamado nas mensagens (ex.: "tipo", "empenho");
 * - `normalizar`: ajusta o texto digitado antes de entrar na lista;
 * - `chaveComparacao`: forma usada para detectar itens repetidos.
 */
export function montarLista(
  secao,
  iniciais,
  { rotulo, nome, normalizar = (t) => t.trim(), chaveComparacao = (t) => t.toLowerCase() },
) {
  const itens = [...iniciais];
  let editando = null; // posição da linha em edição
  const entrada = secao.querySelector("[data-novo]");
  const botao = secao.querySelector("[data-adicionar]");
  const erro = secao.querySelector("[data-erro-lista]");
  const linhas = secao.querySelector("[data-linhas]");
  const listaSugestoes = entrada.getAttribute("list");

  const mostrarErro = (texto) => {
    erro.textContent = texto ?? "";
    erro.hidden = !texto;
  };
  const repetido = (valor, ignorar = -1) =>
    itens.some((item, i) => i !== ignorar && chaveComparacao(item) === chaveComparacao(valor));

  function desenhar() {
    if (!itens.length) {
      linhas.innerHTML = `<p class="vazio vazio--pequeno">Nenhum ${esc(nome)} adicionado.</p>`;
      return;
    }
    linhas.innerHTML = `
      <div class="tabela-rolagem">
        <table class="tabela tabela--compacta">
          <thead><tr><th scope="col">#</th><th scope="col">${esc(rotulo)}</th>
            <th scope="col" class="coluna-acoes">Ações</th></tr></thead>
          <tbody>${itens
            .map((item, i) =>
              i === editando
                ? `<tr><td>${i + 1}</td>
                    <td><input type="text" class="entrada-linha" value="${esc(item)}"
                      aria-label="Editar ${esc(nome)} ${i + 1}"${listaSugestoes ? ` list="${listaSugestoes}"` : ""} data-edicao></td>
                    <td class="coluna-acoes">
                      <button type="button" class="botao-icone" data-confirmar aria-label="Confirmar">${ICONE_OK}</button>
                      <button type="button" class="botao-icone" data-cancelar aria-label="Cancelar edição">${ICONE_CANCELAR}</button>
                    </td></tr>`
                : `<tr><td>${i + 1}</td><td>${esc(item)}</td>
                    <td class="coluna-acoes">
                      <button type="button" class="botao-icone" data-editar="${i}" aria-label="Editar ${esc(item)}">${ICONE_EDITAR}</button>
                      <button type="button" class="botao-icone botao-icone--perigo" data-remover="${i}"
                        aria-label="Remover ${esc(item)}">${ICONE_REMOVER}</button>
                    </td></tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`;
    linhas.querySelector("[data-edicao]")?.focus();
  }

  function adicionar() {
    const valor = normalizar(entrada.value);
    if (!valor) return;
    if (repetido(valor)) return mostrarErro(`Esse ${nome} já foi adicionado.`);
    itens.push(valor);
    entrada.value = "";
    botao.disabled = true;
    mostrarErro(null);
    desenhar();
    entrada.focus();
  }

  function confirmarEdicao() {
    const valor = normalizar(linhas.querySelector("[data-edicao]").value);
    if (!valor) return mostrarErro(`O ${nome} não pode ficar vazio. Use a lixeira para remover.`);
    if (repetido(valor, editando)) return mostrarErro(`Esse ${nome} já foi adicionado.`);
    itens[editando] = valor;
    editando = null;
    mostrarErro(null);
    desenhar();
  }

  function cancelarEdicao() {
    editando = null;
    mostrarErro(null);
    desenhar();
  }

  entrada.addEventListener("input", () => {
    botao.disabled = !entrada.value.trim();
    mostrarErro(null);
  });
  // Enter adiciona o item em vez de enviar o formulário inteiro.
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionar();
    }
  });
  botao.addEventListener("click", adicionar);

  linhas.addEventListener("click", (e) => {
    const alvo = e.target.closest("button");
    if (!alvo) return;
    if (alvo.dataset.editar !== undefined) {
      editando = Number(alvo.dataset.editar);
      desenhar();
    } else if (alvo.dataset.remover !== undefined) {
      itens.splice(Number(alvo.dataset.remover), 1);
      editando = null;
      desenhar();
    } else if (alvo.hasAttribute("data-confirmar")) {
      confirmarEdicao();
    } else if (alvo.hasAttribute("data-cancelar")) {
      cancelarEdicao();
    }
  });
  linhas.addEventListener("keydown", (e) => {
    if (!e.target.matches("[data-edicao]")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      confirmarEdicao();
    } else if (e.key === "Escape") {
      // Esc cancela só a edição da linha, sem fechar a janela.
      e.preventDefault();
      e.stopPropagation();
      cancelarEdicao();
    }
  });

  desenhar();
  return {
    /** Lista final; inclui o que ficou digitado sem clicar em Adicionar. */
    valores() {
      const pendente = normalizar(entrada.value);
      return pendente && !repetido(pendente) ? [...itens, pendente] : [...itens];
    },
    /** Há uma linha em edição ainda não confirmada? */
    emEdicao: () => editando !== null,
  };
}
