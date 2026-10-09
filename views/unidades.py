"""Cadastro de unidades atendidas pelo núcleo."""

import streamlit as st

from core import auth, dados, ui

COLUNAS = {
    "nome": "Nome",
    "sigla": "Sigla",
    "municipio": "Município",
    "endereco": "Endereço",
    "responsavel": "Responsável",
    "telefone": "Telefone",
    "ativo": "Ativa",
}


def formulario(registro: dict | None) -> None:
    novo = registro is None
    registro = registro or {}
    k = ui.chave(f"unidade_{registro.get('id', 'nova')}")

    with st.form(k):
        esquerda, direita = st.columns(2)
        with esquerda:
            nome = st.text_input("Nome *", registro.get("nome") or "", key=f"{k}_nome")
            sigla = st.text_input("Sigla", registro.get("sigla") or "", key=f"{k}_sigla")
            municipio = st.text_input(
                "Município", registro.get("municipio") or "", key=f"{k}_municipio"
            )
        with direita:
            endereco = st.text_input(
                "Endereço", registro.get("endereco") or "", key=f"{k}_endereco"
            )
            responsavel = st.text_input(
                "Responsável local", registro.get("responsavel") or "", key=f"{k}_responsavel"
            )
            telefone = st.text_input(
                "Telefone", registro.get("telefone") or "", key=f"{k}_telefone"
            )
        ativo = st.checkbox("Unidade ativa", registro.get("ativo", True), key=f"{k}_ativo")
        enviar = st.form_submit_button("Cadastrar" if novo else "Salvar", type="primary")

    if not enviar:
        return
    if not ui.texto(nome):
        st.error("Informe o nome da unidade.")
        return
    valores = {
        "nome": ui.texto(nome),
        "sigla": ui.texto(sigla),
        "municipio": ui.texto(municipio),
        "endereco": ui.texto(endereco),
        "responsavel": ui.texto(responsavel),
        "telefone": ui.texto(telefone),
        "ativo": ativo,
    }
    if novo:
        ui.gravar("Unidade cadastrada.", dados.inserir, "unidades", valores)
    else:
        ui.gravar("Unidade atualizada.", dados.atualizar, "unidades", registro["id"], valores)


st.title("Unidades")

unidades = ui.carregar(dados.listar_unidades)
gerencia = auth.tem_papel("admin", "gestor")

if not gerencia:
    if unidades:
        ui.tabela(unidades, COLUNAS, "unidades")
    else:
        st.info("Nenhuma unidade cadastrada ainda.")
    st.stop()

aba_lista, aba_nova = st.tabs(["Unidades", "Nova unidade"])

with aba_lista:
    if not unidades:
        st.info("Nenhuma unidade cadastrada ainda.")
    else:
        posicao = ui.tabela(unidades, COLUNAS, "unidades")
        if posicao is None:
            st.caption("Selecione uma linha da tabela para editar.")
        else:
            selecionada = unidades[posicao]
            st.subheader(f"Editar: {selecionada['nome']}")
            formulario(selecionada)
            if auth.tem_papel("admin") and ui.confirmar_exclusao("unidade"):
                ui.gravar("Unidade excluída.", dados.excluir, "unidades", selecionada["id"])

with aba_nova:
    formulario(None)
