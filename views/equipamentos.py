"""Inventário de equipamentos."""

import streamlit as st

from core import auth, dados, ui
from core.constantes import STATUS_EQUIPAMENTO, TIPOS_EQUIPAMENTO

COLUNAS = {
    "patrimonio": "Patrimônio",
    "tipo": "Tipo",
    "marca": "Marca",
    "modelo": "Modelo",
    "numero_serie": "Nº de série",
    "unidade": "Unidade",
    "localizacao": "Localização",
    "status": "Status",
    "data_aquisicao": "Aquisição",
}


def formulario(registro: dict | None, unidades: list[dict]) -> None:
    novo = registro is None
    registro = registro or {}
    k = ui.chave(f"equip_{registro.get('id', 'novo')}")

    nomes = {u["id"]: u["nome"] for u in unidades}
    opcoes_unidade = [None] + [
        u["id"] for u in unidades if u["ativo"] or u["id"] == registro.get("unidade_id")
    ]
    tipos = list(TIPOS_EQUIPAMENTO)
    if registro.get("tipo") and registro["tipo"] not in tipos:
        tipos.append(registro["tipo"])
    status = list(STATUS_EQUIPAMENTO)

    with st.form(k):
        esquerda, direita = st.columns(2)
        with esquerda:
            patrimonio = st.text_input(
                "Patrimônio", registro.get("patrimonio") or "", key=f"{k}_patrimonio"
            )
            tipo = st.selectbox(
                "Tipo *",
                tipos,
                index=tipos.index(registro["tipo"]) if registro.get("tipo") else None,
                placeholder="Escolha ou digite um tipo",
                accept_new_options=True,
                key=f"{k}_tipo",
            )
            marca = st.text_input("Marca", registro.get("marca") or "", key=f"{k}_marca")
            modelo = st.text_input("Modelo", registro.get("modelo") or "", key=f"{k}_modelo")
            numero_serie = st.text_input(
                "Nº de série", registro.get("numero_serie") or "", key=f"{k}_serie"
            )
        with direita:
            unidade_id = st.selectbox(
                "Unidade",
                opcoes_unidade,
                index=opcoes_unidade.index(registro.get("unidade_id")),
                format_func=lambda i: nomes[i] if i else "— Sem unidade —",
                key=f"{k}_unidade",
            )
            localizacao = st.text_input(
                "Localização (sala, andar, rack)",
                registro.get("localizacao") or "",
                key=f"{k}_local",
            )
            status_escolhido = st.selectbox(
                "Status",
                status,
                index=status.index(registro.get("status", "em_uso")),
                format_func=STATUS_EQUIPAMENTO.get,
                key=f"{k}_status",
            )
            data_aquisicao = st.date_input(
                "Data de aquisição",
                ui.data(registro.get("data_aquisicao")),
                format="DD/MM/YYYY",
                key=f"{k}_aquisicao",
            )
        observacoes = st.text_area(
            "Observações", registro.get("observacoes") or "", key=f"{k}_obs"
        )
        enviar = st.form_submit_button("Cadastrar" if novo else "Salvar", type="primary")

    if not enviar:
        return
    if not ui.texto(tipo):
        st.error("Informe o tipo do equipamento.")
        return
    valores = {
        "patrimonio": ui.texto(patrimonio),
        "tipo": ui.texto(tipo),
        "marca": ui.texto(marca),
        "modelo": ui.texto(modelo),
        "numero_serie": ui.texto(numero_serie),
        "unidade_id": unidade_id,
        "localizacao": ui.texto(localizacao),
        "status": status_escolhido,
        "data_aquisicao": data_aquisicao.isoformat() if data_aquisicao else None,
        "observacoes": ui.texto(observacoes),
    }
    if novo:
        ui.gravar("Equipamento cadastrado.", dados.inserir, "equipamentos", valores)
    else:
        ui.gravar(
            "Equipamento atualizado.", dados.atualizar, "equipamentos", registro["id"], valores
        )


def filtrar(equipamentos: list[dict]) -> list[dict]:
    c1, c2, c3, c4 = st.columns([2, 1, 1, 1])
    busca = c1.text_input("Buscar", placeholder="Patrimônio, marca, modelo ou nº de série")
    unidades = c2.multiselect(
        "Unidade", sorted({e["unidade"] for e in equipamentos if e["unidade"]})
    )
    tipos = c3.multiselect("Tipo", sorted({e["tipo"] for e in equipamentos}))
    status = c4.multiselect(
        "Status", list(STATUS_EQUIPAMENTO), format_func=STATUS_EQUIPAMENTO.get
    )
    termo = busca.strip().lower()

    def passa(e: dict) -> bool:
        campos = (e["patrimonio"], e["marca"], e["modelo"], e["numero_serie"])
        return (
            (not termo or any(termo in (c or "").lower() for c in campos))
            and (not unidades or e["unidade"] in unidades)
            and (not tipos or e["tipo"] in tipos)
            and (not status or e["status"] in status)
        )

    return [e for e in equipamentos if passa(e)]


st.title("Inventário de equipamentos")

unidades = ui.carregar(dados.listar_unidades)
equipamentos = ui.carregar(dados.listar_equipamentos)

aba_lista, aba_novo = st.tabs(["Equipamentos", "Novo equipamento"])

with aba_lista:
    if not equipamentos:
        st.info("Nenhum equipamento cadastrado ainda.")
    else:
        filtrados = filtrar(equipamentos)
        st.caption(f"{len(filtrados)} de {len(equipamentos)} equipamentos")
        if filtrados:
            exibicao = [
                {
                    **e,
                    "status": STATUS_EQUIPAMENTO[e["status"]],
                    "data_aquisicao": ui.data_br(e["data_aquisicao"]),
                }
                for e in filtrados
            ]
            posicao = ui.tabela(exibicao, COLUNAS, "equipamentos")
            if posicao is None or posicao >= len(filtrados):
                st.caption("Selecione uma linha da tabela para editar.")
            else:
                selecionado = filtrados[posicao]
                st.subheader(
                    f"Editar: {selecionado['tipo']} {selecionado['patrimonio'] or ''}".strip()
                )
                formulario(selecionado, unidades)
                if auth.tem_papel("admin", "gestor") and ui.confirmar_exclusao("equip"):
                    ui.gravar(
                        "Equipamento excluído.", dados.excluir, "equipamentos", selecionado["id"]
                    )

with aba_novo:
    formulario(None, unidades)
