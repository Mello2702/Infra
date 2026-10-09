"""Sistema de Gestão do Núcleo de Infraestrutura — ponto de entrada (streamlit run app.py)."""

import streamlit as st

from core import auth, ui
from core.constantes import PAPEIS

st.set_page_config(page_title="Núcleo de Infraestrutura", page_icon="🏢", layout="wide")

usuario = auth.usuario_atual()
if usuario is None:
    auth.tela_login()
    st.stop()

paginas = {
    "Gestão": [
        st.Page("views/painel.py", title="Painel", icon=":material/dashboard:", default=True),
        st.Page("views/equipamentos.py", title="Equipamentos", icon=":material/devices:"),
        st.Page("views/visitas.py", title="Visitas", icon=":material/directions_car:"),
        st.Page("views/unidades.py", title="Unidades", icon=":material/apartment:"),
    ],
    "Conta": [st.Page("views/conta.py", title="Minha conta", icon=":material/person:")],
}
if auth.tem_papel("admin"):
    paginas["Conta"].append(
        st.Page("views/usuarios.py", title="Usuários", icon=":material/group:")
    )

navegacao = st.navigation(paginas)

with st.sidebar:
    st.caption(f"{usuario['nome']} · {PAPEIS[usuario['papel']]}")
    if st.button("Sair", width="stretch"):
        auth.sair()
        st.rerun()

ui.mostrar_aviso()
navegacao.run()
