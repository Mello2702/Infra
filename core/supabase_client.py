"""Cliente Supabase da sessão do usuário."""

import os

import streamlit as st
import truststore
from supabase import Client, create_client

# Usa os certificados do sistema operacional. Em redes corporativas que inspecionam
# HTTPS (como a da PRODESP) o certificado da rede só é confiável por essa via.
truststore.inject_into_ssl()


class ConfigAusente(Exception):
    """SUPABASE_URL ou SUPABASE_ANON_KEY não foram configurados."""


def _ler(nome: str) -> str | None:
    try:
        if nome in st.secrets:
            return st.secrets[nome]
    except Exception:  # sem arquivo secrets.toml
        pass
    return os.environ.get(nome)


def cliente() -> Client:
    # Um cliente por sessão (e não em cache global): ele carrega o token do
    # usuário logado, que é o que faz as regras de RLS valerem para cada pessoa.
    if "supabase" not in st.session_state:
        url, chave = _ler("SUPABASE_URL"), _ler("SUPABASE_ANON_KEY")
        if not url or not chave:
            raise ConfigAusente
        st.session_state["supabase"] = create_client(url, chave)
    return st.session_state["supabase"]
