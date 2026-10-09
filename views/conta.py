"""Dados do usuário logado e troca de senha."""

import streamlit as st
from supabase import AuthError

from core import auth
from core.constantes import PAPEIS
from core.supabase_client import cliente

usuario = auth.usuario_atual()

st.title("Minha conta")
st.write(f"**Nome:** {usuario['nome']}")
st.write(f"**E-mail:** {usuario['email']}")
st.write(f"**Papel:** {PAPEIS[usuario['papel']]}")

st.subheader("Trocar senha")
with st.form("trocar_senha", clear_on_submit=True):
    nova = st.text_input("Nova senha", type="password")
    repetida = st.text_input("Repita a nova senha", type="password")
    enviar = st.form_submit_button("Alterar senha", type="primary")

if enviar:
    if len(nova) < 8:
        st.error("A senha deve ter pelo menos 8 caracteres.")
    elif nova != repetida:
        st.error("As senhas não conferem.")
    else:
        try:
            cliente().auth.update_user({"password": nova})
        except AuthError as erro:
            st.error(f"Não foi possível alterar a senha: {erro.message}")
        else:
            st.success("Senha alterada.")
