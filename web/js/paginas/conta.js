// Dados do usuário logado e troca de senha.
import { PAPEIS } from "../constantes.js";
import { sessao } from "../estado.js";
import { sb } from "../supabase.js";
import * as ui from "../ui.js";

export async function render(el) {
  const u = sessao.usuario;
  el.innerHTML = `
    ${ui.cabecalho("Minha conta")}
    <section class="cartao cartao--estreito">
      <dl class="dados">
        <dt>Nome</dt><dd>${ui.esc(u.nome)}</dd>
        <dt>E-mail</dt><dd>${ui.esc(u.email)}</dd>
        <dt>Papel</dt><dd>${ui.esc(PAPEIS[u.papel])}</dd>
      </dl>
    </section>
    <section class="cartao cartao--estreito">
      <h2>Trocar senha</h2>
      <form data-senha novalidate>
        <label class="campo"><span>Nova senha</span><input name="nova" type="password" autocomplete="new-password"></label>
        <label class="campo"><span>Repita a nova senha</span><input name="repetida" type="password" autocomplete="new-password"></label>
        <p class="alerta alerta--erro" hidden></p>
        <button type="submit" class="botao botao--primario">Alterar senha</button>
      </form>
    </section>`;

  const form = el.querySelector("[data-senha]");
  const alerta = form.querySelector(".alerta");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nova = form.nova.value;
    const erro =
      nova.length < 8
        ? "A senha deve ter pelo menos 8 caracteres."
        : nova !== form.repetida.value
          ? "As senhas não conferem."
          : null;
    alerta.hidden = !erro;
    if (erro) return (alerta.textContent = erro);

    const botao = form.querySelector("button");
    botao.disabled = true;
    const { error } = await sb.auth.updateUser({ password: nova });
    botao.disabled = false;
    if (error) {
      alerta.textContent = `Não foi possível alterar a senha: ${error.message}`;
      alerta.hidden = false;
      return;
    }
    form.reset();
    ui.aviso("Senha alterada.");
  });
}
