"""Login com Supabase Auth e controle de acesso por papel."""

import streamlit as st
from supabase import AuthError

from core.supabase_client import ConfigAusente, cliente


def usuario_atual() -> dict | None:
    return st.session_state.get("usuario")


def tem_papel(*papeis: str) -> bool:
    usuario = usuario_atual()
    return usuario is not None and usuario["papel"] in papeis


def exigir_papel(*papeis: str) -> None:
    if not tem_papel(*papeis):
        st.error("Você não tem permissão para acessar esta página.")
        st.stop()


def entrar(email: str, senha: str) -> str | None:
    """Faz o login. Devolve a mensagem de erro, ou None se deu certo."""
    sb = cliente()
    try:
        resposta = sb.auth.sign_in_with_password({"email": email, "password": senha})
    except AuthError:
        return "E-mail ou senha inválidos."
    except Exception:
        return "Não foi possível conectar ao Supabase. Tente novamente."

    perfil = (
        sb.table("perfis")
        .select("id, nome, email, papel, ativo")
        .eq("id", resposta.user.id)
        .execute()
        .data
    )
    # Usuário inativo não enxerga nem o próprio perfil (RLS), então a lista vem vazia.
    if not perfil or not perfil[0]["ativo"]:
        sair()
        return "Seu usuário está inativo. Procure um administrador."
    st.session_state["usuario"] = perfil[0]
    return None


def sair() -> None:
    sb = st.session_state.pop("supabase", None)
    st.session_state.pop("usuario", None)
    if sb is not None:
        try:
            sb.auth.sign_out()
        except Exception:
            pass


def tela_login() -> None:
    _, centro, _ = st.columns([1, 1.2, 1])
    with centro:
        st.title("Núcleo de Infraestrutura")
        st.caption("Sistema de Gestão")
        try:
            cliente()
        except ConfigAusente:
            st.error(
                "Conexão com o Supabase não configurada. Defina `SUPABASE_URL` e "
                "`SUPABASE_ANON_KEY` em `.streamlit/secrets.toml` (veja o README)."
            )
            return
        with st.form("login"):
            email = st.text_input("E-mail")
            senha = st.text_input("Senha", type="password")
            enviar = st.form_submit_button("Entrar", type="primary", width="stretch")
        if enviar:
            if not email or not senha:
                st.error("Informe e-mail e senha.")
                return
            erro = entrar(email.strip(), senha)
            if erro:
                st.error(erro)
            else:
                st.rerun()
