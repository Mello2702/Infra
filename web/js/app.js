// Ponto de entrada: login, menu e navegação entre as páginas (rotas com #).
import { ACESSOS_EXTERNOS, PAPEIS } from "./constantes.js";
import { sessao, temPapel } from "./estado.js";
import * as conta from "./paginas/conta.js";
import * as equipamentos from "./paginas/equipamentos.js";
import * as painel from "./paginas/painel.js";
import * as processos from "./paginas/processos.js";
import * as unidades from "./paginas/unidades.js";
import * as usuarios from "./paginas/usuarios.js";
import * as visitas from "./paginas/visitas.js";
import { sb } from "./supabase.js";
import { esc } from "./ui.js";

const PAGINAS = [
  { rota: "painel", titulo: "Painel", modulo: painel },
  { rota: "equipamentos", titulo: "Equipamentos", modulo: equipamentos },
  { rota: "visitas", titulo: "Visitas", modulo: visitas },
  { rota: "processos", titulo: "Processos", modulo: processos },
  { rota: "unidades", titulo: "Unidades", modulo: unidades },
  { rota: "conta", titulo: "Minha conta", modulo: conta },
  { rota: "usuarios", titulo: "Usuários", modulo: usuarios, papeis: ["admin"] },
];

const app = document.getElementById("app");

const marca = (pequena = false) => `
  <div class="nie-marca${pequena ? " nie-marca--pequena" : ""}">
    <div class="nie-logo"><span class="nie-logo__texto">nie</span><span class="nie-logo__ponto" aria-hidden="true"></span></div>
    <p class="nie-subtitulo">Sistema de Gestão</p>
  </div>`;

function telaLogin(mensagem = "") {
  sessao.usuario = null;
  document.title = "nie · Sistema de Gestão";
  app.innerHTML = `
    <main class="login">
      <div class="login__conteudo">
        ${marca()}
        <form class="cartao login__form" novalidate>
          <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="username"></label>
          <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="current-password"></label>
          <p class="alerta alerta--erro"${mensagem ? "" : " hidden"}>${esc(mensagem)}</p>
          <button class="botao botao--primario botao--largo" type="submit">Entrar</button>
        </form>
      </div>
    </main>`;

  const form = app.querySelector("form");
  const alerta = form.querySelector(".alerta");
  const botao = form.querySelector("button");
  const mostrar = (texto) => {
    alerta.textContent = texto;
    alerta.hidden = false;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const senha = form.senha.value;
    if (!email || !senha) return mostrar("Informe e-mail e senha.");
    botao.disabled = true;
    botao.textContent = "Entrando…";
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) {
      console.error(error);
      mostrar(
        error.status === 400
          ? "E-mail ou senha inválidos."
          : "Não foi possível conectar ao Supabase. Tente novamente.",
      );
      botao.disabled = false;
      botao.textContent = "Entrar";
      return;
    }
    await abrirSistema(data.user.id);
  });
  form.email.focus();
}

async function abrirSistema(idUsuario) {
  // Usuário inativo não enxerga nem o próprio perfil (RLS), então a consulta vem vazia.
  const { data: perfil, error } = await sb
    .from("perfis")
    .select("id, nome, email, papel, ativo")
    .eq("id", idUsuario)
    .maybeSingle();
  if (error || !perfil?.ativo) {
    if (error) console.error(error);
    await sb.auth.signOut();
    return telaLogin(
      error
        ? "Não foi possível conectar ao Supabase. Tente novamente."
        : "Seu usuário está inativo. Procure um administrador.",
    );
  }
  sessao.usuario = perfil;
  montarLayout();
  await mostrarPagina();
}

function montarLayout() {
  const links = PAGINAS.filter((p) => !p.papeis || temPapel(...p.papeis))
    .map((p) => `<a href="#/${p.rota}" data-rota="${p.rota}">${esc(p.titulo)}</a>`)
    .join("");
  app.innerHTML = `
    <div class="sistema">
      <aside class="lateral">
        ${marca(true)}
        <nav class="menu" aria-label="Menu principal">${links}</nav>
        <nav class="acessos" aria-label="Acessos externos">
          <p class="acessos__titulo">Acessos</p>
          ${ACESSOS_EXTERNOS.map(
            (a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.titulo)}
              <span class="acessos__seta" aria-hidden="true">↗</span><span class="visualmente-oculto"> (abre em nova aba)</span></a>`,
          ).join("")}
        </nav>
        <div class="lateral__rodape">
          <p class="lateral__usuario"><span data-usuario-nome>${esc(sessao.usuario.nome)}</span>
            · ${esc(PAPEIS[sessao.usuario.papel])}</p>
          <button type="button" class="botao botao--largo" data-acao="sair">Sair</button>
        </div>
      </aside>
      <main class="conteudo" id="conteudo"></main>
    </div>`;
  app.querySelector('[data-acao="sair"]').addEventListener("click", async () => {
    sessao.usuario = null; // evita o aviso de "sessão expirou" ao sair de propósito
    await sb.auth.signOut();
    history.replaceState(null, "", location.pathname);
    telaLogin();
  });
}

async function mostrarPagina() {
  const rota = location.hash.replace(/^#\/?/, "") || "painel";
  const pagina = PAGINAS.find((p) => p.rota === rota && (!p.papeis || temPapel(...p.papeis))) ?? PAGINAS[0];
  document.title = `${pagina.titulo} · nie`;
  app.querySelectorAll(".menu a").forEach((a) => {
    if (a.dataset.rota === pagina.rota) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // Um contêiner novo a cada navegação: se uma página antiga terminar de carregar
  // depois, ela escreve num elemento que já saiu da tela.
  const area = document.createElement("div");
  area.className = "pagina";
  document.getElementById("conteudo").replaceChildren(area);
  await pagina.modulo.render(area);
}

window.addEventListener("hashchange", () => {
  if (sessao.usuario) mostrarPagina();
});

sb.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT" && sessao.usuario) telaLogin("Sua sessão expirou. Entre novamente.");
});

const {
  data: { session },
} = await sb.auth.getSession();
if (session) await abrirSistema(session.user.id);
else telaLogin();
