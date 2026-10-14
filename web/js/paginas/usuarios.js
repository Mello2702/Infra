// Gestão de usuários: papel e situação de cada perfil (somente administradores).
import { PAPEIS } from "../constantes.js";
import { atualizar, listarPerfis } from "../dados.js";
import { sessao, temPapel } from "../estado.js";
import * as ui from "../ui.js";

const COLUNAS = [
  { campo: "nome", titulo: "Nome" },
  { campo: "email", titulo: "E-mail" },
  { campo: "papel", titulo: "Papel", formato: (p) => PAPEIS[p] },
  { campo: "ativo", titulo: "Ativo", formato: (a) => (a ? "Sim" : "Não") },
];

function formulario(perfil, recarregar) {
  // O administrador não rebaixa nem desativa a si mesmo, para não ficar sem acesso.
  const proprio = perfil.id === sessao.usuario.id;
  ui.dialogo({
    titulo: `Editar: ${perfil.nome}`,
    campos: `
      ${ui.campoTexto("nome", "Nome", perfil.nome, { obrigatorio: true })}
      ${ui.campoSelect("papel", "Papel", Object.entries(PAPEIS), perfil.papel, { desabilitado: proprio })}
      ${ui.campoCheck("ativo", "Usuário ativo", perfil.ativo, { desabilitado: proprio })}
      ${proprio ? '<p class="legenda">Você não pode alterar o próprio papel nem se desativar.</p>' : ""}`,
    aoSalvar: async (f) => {
      const nome = ui.texto(f.get("nome"));
      if (!nome) return "Informe o nome.";
      const valores = proprio ? { nome } : { nome, papel: f.get("papel"), ativo: f.get("ativo") === "on" };
      return ui.gravar(
        () => atualizar("perfis", perfil.id, valores),
        "Usuário atualizado.",
        () => {
          if (proprio) {
            sessao.usuario.nome = nome;
            document.querySelector("[data-usuario-nome]").textContent = nome;
          }
          recarregar();
        },
      );
    },
  });
}

export async function render(el) {
  if (!temPapel("admin")) {
    el.innerHTML = ui.erroHTML("Você não tem permissão para acessar esta página.");
    return;
  }
  el.innerHTML =
    ui.cabecalho("Usuários") +
    `<div class="alerta alerta--info">Novos usuários são criados no painel do Supabase, em
      <strong>Authentication → Users → Add user</strong>. Eles aparecem aqui como Técnico e você
      ajusta o papel clicando na linha.</div>` +
    ui.CARREGANDO;
  let perfis;
  try {
    perfis = await listarPerfis();
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }
  el.querySelector(".carregando").replaceWith(
    ui.tabela(COLUNAS, perfis, (linha) => formulario(linha, () => render(el))),
  );
}
