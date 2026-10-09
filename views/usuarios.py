"""Gestão de usuários: papel e situação de cada perfil (somente administradores)."""

import streamlit as st

from core import auth, dados, ui
from core.constantes import PAPEIS

COLUNAS = {"nome": "Nome", "email": "E-mail", "papel": "Papel", "ativo": "Ativo"}

auth.exigir_papel("admin")

st.title("Usuários")
st.info(
    "Novos usuários são criados no painel do Supabase, em **Authentication → Users → "
    "Add user**. Eles aparecem aqui como Técnico e você ajusta o papel abaixo."
)

perfis = ui.carregar(dados.listar_perfis)
exibicao = [{**p, "papel": PAPEIS[p["papel"]]} for p in perfis]
posicao = ui.tabela(exibicao, COLUNAS, "usuarios")

if posicao is None:
    st.caption("Selecione uma linha da tabela para editar.")
    st.stop()

perfil = perfis[posicao]
proprio = perfil["id"] == auth.usuario_atual()["id"]
k = ui.chave(f"perfil_{perfil['id']}")
papeis = list(PAPEIS)

st.subheader(f"Editar: {perfil['nome']}")
with st.form(k):
    nome = st.text_input("Nome *", perfil["nome"], key=f"{k}_nome")
    # O administrador não rebaixa nem desativa a si mesmo, para não ficar sem acesso.
    papel = st.selectbox(
        "Papel",
        papeis,
        index=papeis.index(perfil["papel"]),
        format_func=PAPEIS.get,
        disabled=proprio,
        key=f"{k}_papel",
    )
    ativo = st.checkbox("Usuário ativo", perfil["ativo"], disabled=proprio, key=f"{k}_ativo")
    enviar = st.form_submit_button("Salvar", type="primary")

if enviar:
    if not ui.texto(nome):
        st.error("Informe o nome.")
    else:
        valores = {"nome": ui.texto(nome), "papel": papel, "ativo": ativo}
        try:
            dados.atualizar("perfis", perfil["id"], valores)
        except dados.ErroDados as erro:
            st.error(str(erro))
        else:
            if proprio:
                st.session_state["usuario"]["nome"] = valores["nome"]
            ui.concluir("Usuário atualizado.")
