// Cadastro de unidades atendidas pelo núcleo.
import { UFS } from "../constantes.js";
import { atualizar, excluir, inserir, listarTiposEstabelecimento, listarUnidades } from "../dados.js";
import { temPapel } from "../estado.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "nome", titulo: "Nome" },
  { campo: "tipo", titulo: "Tipo de estabelecimento" },
  { campo: "razao_social", titulo: "Razão social" },
  { campo: "endereco", titulo: "Endereço" },
  { campo: "cidade", titulo: "Cidade" },
  { campo: "uf", titulo: "UF" },
  { campo: "uge", titulo: "UGE" },
  { campo: "ativo", titulo: "Ativa", formato: (a) => (a ? "Sim" : "Não") },
];

function formulario(registro, tipos, recarregar) {
  const novo = !registro;
  const r = registro ?? {};
  // Tipos desativados só aparecem na unidade que já os usa.
  const opcoesTipo = tipos.filter((t) => t.ativo || t.id === r.tipo_id).map((t) => [t.id, t.nome]);
  ui.dialogo({
    titulo: novo ? "Nova unidade" : `Editar: ${r.nome}`,
    textoSalvar: novo ? "Cadastrar" : "Salvar",
    campos: `
      <div class="grade">
        ${ui.campoTexto("nome", "Nome", r.nome, { obrigatorio: true })}
        ${ui.campoSelect("tipo_id", "Tipo de estabelecimento", opcoesTipo, r.tipo_id, { vazio: "— Não definido —" })}
      </div>
      ${tipos.length ? "" : '<p class="legenda">Nenhum tipo de estabelecimento cadastrado. Cadastre em <a href="#/tipos">Tipos de estabelecimento</a>.</p>'}
      ${ui.campoTexto("razao_social", "Razão social", r.razao_social)}
      ${ui.campoTexto("endereco", "Endereço", r.endereco)}
      <div class="grade grade--cidade">
        ${ui.campoTexto("cidade", "Cidade", r.cidade)}
        ${ui.campoSelect("uf", "UF", UFS.map((uf) => [uf, uf]), novo ? "SP" : r.uf, { vazio: "—" })}
        ${ui.campoTexto("uge", "UGE", r.uge, { dica: "Código" })}
      </div>
      ${ui.campoCheck("ativo", "Unidade ativa", r.ativo ?? true)}`,
    aoSalvar: async (f) => {
      const valores = {
        nome: ui.texto(f.get("nome")),
        tipo_id: f.get("tipo_id") ? Number(f.get("tipo_id")) : null,
        razao_social: ui.texto(f.get("razao_social")),
        endereco: ui.texto(f.get("endereco")),
        cidade: ui.texto(f.get("cidade")),
        uf: f.get("uf") || null,
        uge: ui.texto(f.get("uge")),
        ativo: f.get("ativo") === "on",
      };
      if (!valores.nome) return "Informe o nome da unidade.";
      return novo
        ? ui.gravar(() => inserir("unidades", valores), "Unidade cadastrada.", recarregar)
        : ui.gravar(() => atualizar("unidades", r.id, valores), "Unidade atualizada.", recarregar);
    },
    aoExcluir:
      !novo && temPapel("admin")
        ? () => ui.gravar(() => excluir("unidades", r.id), "Unidade excluída.", recarregar)
        : null,
  });
}

export async function render(el) {
  const gerencia = temPapel("admin", "gestor");
  el.innerHTML =
    ui.cabecalho(
      "Unidades",
      gerencia ? '<button class="botao botao--primario" data-acao="nova" disabled>Nova unidade</button>' : "",
    ) + ui.CARREGANDO;
  let unidades, tipos;
  try {
    [unidades, tipos] = await Promise.all([listarUnidades(), listarTiposEstabelecimento()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  const recarregar = () => render(el);
  const botaoNova = el.querySelector('[data-acao="nova"]');
  if (botaoNova) {
    botaoNova.disabled = false;
    botaoNova.addEventListener("click", () => formulario(null, tipos, recarregar));
  }

  if (!unidades.length) {
    el.querySelector(".carregando").outerHTML = ui.vazio("Nenhuma unidade cadastrada ainda.");
    return;
  }
  el.querySelector(".carregando").replaceWith(
    ui.tabela(COLUNAS, unidades, gerencia ? (linha) => formulario(linha, tipos, recarregar) : null),
  );
}
