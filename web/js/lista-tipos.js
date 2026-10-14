// Editor da lista de tipos de estabelecimento de uma unidade, dentro do
// formulário: campo para digitar (com sugestões do catálogo) + botão
// Adicionar, e tabela com editar/remover em cada linha.
import { esc } from "./ui.js";

const ICONE_EDITAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
const ICONE_REMOVER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICONE_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L19 8"/></svg>';
const ICONE_CANCELAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let contador = 0;

/** HTML da seção; depois de inserido na página, chame `montarListaTipos`. */
export function secaoTipos(sugestoes) {
  const lista = `sugestoes-tipos-${++contador}`;
  return `
    <section class="secao-tipos" data-tipos>
      <h3 class="secao__titulo">Tipos de estabelecimento</h3>
      <p class="legenda">Adicione os tipos de estabelecimento da unidade. Um tipo novo entra também no catálogo.</p>
      <div class="secao-tipos__entrada">
        <input type="text" aria-label="Tipo de estabelecimento" placeholder="Digite o tipo de estabelecimento…"
          list="${lista}" data-novo>
        <button type="button" class="botao" data-adicionar disabled>+ Adicionar</button>
      </div>
      <datalist id="${lista}">${sugestoes.map((s) => `<option value="${esc(s)}">`).join("")}</datalist>
      <p class="alerta alerta--erro" data-erro-tipo hidden></p>
      <div data-linhas></div>
    </section>`;
}

/** Liga os eventos da seção e devolve `{ valores() }` com a lista atual de nomes. */
export function montarListaTipos(secao, iniciais) {
  const itens = [...iniciais];
  let editando = null; // posição da linha em edição
  const entrada = secao.querySelector("[data-novo]");
  const botao = secao.querySelector("[data-adicionar]");
  const erro = secao.querySelector("[data-erro-tipo]");
  const linhas = secao.querySelector("[data-linhas]");

  const mostrarErro = (texto) => {
    erro.textContent = texto ?? "";
    erro.hidden = !texto;
  };
  const repetido = (nome, ignorar = -1) =>
    itens.some((item, i) => i !== ignorar && item.toLowerCase() === nome.toLowerCase());

  function desenhar() {
    if (!itens.length) {
      linhas.innerHTML = '<p class="vazio vazio--pequeno">Nenhum tipo adicionado.</p>';
      return;
    }
    linhas.innerHTML = `
      <div class="tabela-rolagem">
        <table class="tabela tabela--compacta">
          <thead><tr><th scope="col">#</th><th scope="col">Tipo de estabelecimento</th>
            <th scope="col" class="coluna-acoes">Ações</th></tr></thead>
          <tbody>${itens
            .map((item, i) =>
              i === editando
                ? `<tr><td>${i + 1}</td>
                    <td><input type="text" class="entrada-linha" value="${esc(item)}"
                      aria-label="Editar tipo ${i + 1}" list="${entrada.getAttribute("list")}" data-edicao></td>
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
    const nome = entrada.value.trim();
    if (!nome) return;
    if (repetido(nome)) return mostrarErro("Esse tipo já foi adicionado.");
    itens.push(nome);
    entrada.value = "";
    botao.disabled = true;
    mostrarErro(null);
    desenhar();
    entrada.focus();
  }

  function confirmarEdicao() {
    const campo = linhas.querySelector("[data-edicao]");
    const nome = campo.value.trim();
    if (!nome) return mostrarErro("O tipo não pode ficar vazio. Use a lixeira para remover.");
    if (repetido(nome, editando)) return mostrarErro("Esse tipo já foi adicionado.");
    itens[editando] = nome;
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
  // Enter adiciona o tipo em vez de enviar o formulário inteiro.
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
      const pendente = entrada.value.trim();
      return pendente && !repetido(pendente) ? [...itens, pendente] : [...itens];
    },
    /** Há uma linha em edição ainda não confirmada? */
    emEdicao: () => editando !== null,
  };
}
