"""Pequenos utilitários de interface compartilhados pelas páginas."""

from datetime import date

import pandas as pd
import streamlit as st

from core.dados import ErroDados


def texto(valor: str | None) -> str | None:
    """Normaliza campo de texto: sem espaços nas pontas e None quando vazio."""
    return (valor or "").strip() or None


def data(valor: str | None) -> date | None:
    return date.fromisoformat(valor) if valor else None


def data_br(valor: str | None) -> str:
    return date.fromisoformat(valor).strftime("%d/%m/%Y") if valor else ""


def chave(base: str) -> str:
    """Chave de widget que muda a cada gravação, para formulários e seleções
    voltarem ao estado inicial com os dados recém-gravados."""
    return f"{base}_{st.session_state.get('_versao', 0)}"


def concluir(mensagem: str) -> None:
    """Guarda o aviso de sucesso e recarrega a página com os dados atualizados."""
    st.session_state["_aviso"] = mensagem
    st.session_state["_versao"] = st.session_state.get("_versao", 0) + 1
    st.rerun()


def mostrar_aviso() -> None:
    mensagem = st.session_state.pop("_aviso", None)
    if mensagem:
        st.toast(mensagem, icon="✅")


def carregar(funcao, *args, **kwargs):
    """Executa uma leitura; em caso de falha mostra o erro e interrompe a página."""
    try:
        return funcao(*args, **kwargs)
    except ErroDados as erro:
        st.error(str(erro))
        st.stop()


def gravar(mensagem: str, funcao, *args) -> None:
    """Executa uma gravação; mostra o erro ou conclui com a mensagem de sucesso."""
    try:
        funcao(*args)
    except ErroDados as erro:
        st.error(str(erro))
        return
    concluir(mensagem)


def tabela(linhas: list[dict], colunas: dict[str, str], nome: str) -> int | None:
    """Mostra a tabela (colunas: campo -> título) com exportação em CSV e
    devolve a posição da linha selecionada."""
    df = pd.DataFrame(linhas)[list(colunas)].rename(columns=colunas)
    evento = st.dataframe(
        df,
        hide_index=True,
        width="stretch",
        on_select="rerun",
        selection_mode="single-row",
        key=chave(f"tabela_{nome}"),
    )
    st.download_button(
        "Exportar CSV",
        df.to_csv(index=False, sep=";").encode("utf-8-sig"),
        file_name=f"{nome}.csv",
        mime="text/csv",
        key=f"csv_{nome}",
    )
    selecionadas = evento.selection.rows
    return selecionadas[0] if selecionadas else None


def confirmar_exclusao(nome: str) -> bool:
    """Botão de excluir protegido por uma caixa de confirmação."""
    confirmado = st.checkbox("Confirmo a exclusão deste registro", key=chave(f"{nome}_confirma"))
    return st.button("Excluir", key=chave(f"{nome}_excluir"), disabled=not confirmado)
