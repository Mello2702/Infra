"""Controle de visitas às unidades."""

from datetime import date

import streamlit as st

from core import auth, dados, ui
from core.constantes import STATUS_VISITA, TIPOS_VISITA

COLUNAS = {
    "data_visita": "Data",
    "unidade": "Unidade",
    "tipo": "Tipo",
    "status": "Status",
    "tecnico": "Técnico",
    "objetivo": "Objetivo",
    "pendencias": "Pendências",
}


def formulario(registro: dict | None, unidades: list[dict], perfis: list[dict]) -> None:
    novo = registro is None
    registro = registro or {}
    usuario = auth.usuario_atual()
    k = ui.chave(f"visita_{registro.get('id', 'novo')}")

    nomes_unidade = {u["id"]: u["nome"] for u in unidades}
    opcoes_unidade = [
        u["id"] for u in unidades if u["ativo"] or u["id"] == registro.get("unidade_id")
    ]
    if not opcoes_unidade:
        st.info("Cadastre uma unidade antes de registrar visitas.")
        return

    tecnico_atual = registro.get("tecnico_id", usuario["id"])
    nomes_tecnico = {p["id"]: p["nome"] for p in perfis}
    opcoes_tecnico = [p["id"] for p in perfis if p["ativo"] or p["id"] == tecnico_atual]
    tipos = list(TIPOS_VISITA)
    if registro.get("tipo") and registro["tipo"] not in tipos:
        tipos.append(registro["tipo"])
    status = list(STATUS_VISITA)

    with st.form(k):
        esquerda, direita = st.columns(2)
        with esquerda:
            unidade_id = st.selectbox(
                "Unidade *",
                opcoes_unidade,
                index=opcoes_unidade.index(registro["unidade_id"]) if not novo else None,
                format_func=nomes_unidade.get,
                placeholder="Escolha a unidade",
                key=f"{k}_unidade",
            )
            data_visita = st.date_input(
                "Data da visita *",
                ui.data(registro.get("data_visita")) or date.today(),
                format="DD/MM/YYYY",
                key=f"{k}_data",
            )
            tipo = st.selectbox(
                "Tipo",
                tipos,
                index=tipos.index(registro.get("tipo", tipos[0])),
                key=f"{k}_tipo",
            )
        with direita:
            # Técnico só registra visita em seu próprio nome (mesma regra da RLS).
            tecnico_id = st.selectbox(
                "Técnico responsável",
                opcoes_tecnico,
                index=opcoes_tecnico.index(tecnico_atual),
                format_func=nomes_tecnico.get,
                disabled=not auth.tem_papel("admin", "gestor"),
                key=f"{k}_tecnico",
            )
            status_escolhido = st.selectbox(
                "Status",
                status,
                index=status.index(registro.get("status", "agendada")),
                format_func=STATUS_VISITA.get,
                key=f"{k}_status",
            )
        objetivo = st.text_area(
            "Objetivo da visita", registro.get("objetivo") or "", key=f"{k}_objetivo"
        )
        relato = st.text_area(
            "Relato (o que foi feito)", registro.get("relato") or "", key=f"{k}_relato"
        )
        pendencias = st.text_area(
            "Pendências", registro.get("pendencias") or "", key=f"{k}_pendencias"
        )
        enviar = st.form_submit_button("Registrar" if novo else "Salvar", type="primary")

    if not enviar:
        return
    if unidade_id is None:
        st.error("Escolha a unidade.")
        return
    valores = {
        "unidade_id": unidade_id,
        "tecnico_id": tecnico_id,
        "data_visita": data_visita.isoformat(),
        "tipo": tipo,
        "status": status_escolhido,
        "objetivo": ui.texto(objetivo),
        "relato": ui.texto(relato),
        "pendencias": ui.texto(pendencias),
    }
    if novo:
        ui.gravar("Visita registrada.", dados.inserir, "visitas", valores)
    else:
        ui.gravar("Visita atualizada.", dados.atualizar, "visitas", registro["id"], valores)


def filtrar(visitas: list[dict]) -> list[dict]:
    c1, c2, c3 = st.columns(3)
    unidades = c1.multiselect("Unidade", sorted({v["unidade"] for v in visitas if v["unidade"]}))
    tecnicos = c2.multiselect("Técnico", sorted({v["tecnico"] for v in visitas if v["tecnico"]}))
    status = c3.multiselect("Status", list(STATUS_VISITA), format_func=STATUS_VISITA.get)
    return [
        v
        for v in visitas
        if (not unidades or v["unidade"] in unidades)
        and (not tecnicos or v["tecnico"] in tecnicos)
        and (not status or v["status"] in status)
    ]


st.title("Visitas às unidades")

unidades = ui.carregar(dados.listar_unidades)
perfis = ui.carregar(dados.listar_perfis)
visitas = ui.carregar(dados.listar_visitas)

aba_lista, aba_nova = st.tabs(["Visitas", "Nova visita"])

with aba_lista:
    if not visitas:
        st.info("Nenhuma visita registrada ainda.")
    else:
        filtradas = filtrar(visitas)
        st.caption(f"{len(filtradas)} de {len(visitas)} visitas")
        if filtradas:
            exibicao = [
                {
                    **v,
                    "status": STATUS_VISITA[v["status"]],
                    "data_visita": ui.data_br(v["data_visita"]),
                }
                for v in filtradas
            ]
            posicao = ui.tabela(exibicao, COLUNAS, "visitas")
            if posicao is None or posicao >= len(filtradas):
                st.caption("Selecione uma linha da tabela para ver os detalhes ou editar.")
            else:
                selecionada = filtradas[posicao]
                st.subheader(
                    f"{selecionada['unidade']} — {ui.data_br(selecionada['data_visita'])}"
                )
                gerencia = auth.tem_papel("admin", "gestor")
                if gerencia or selecionada["tecnico_id"] == auth.usuario_atual()["id"]:
                    formulario(selecionada, unidades, perfis)
                else:
                    st.write(f"**Objetivo:** {selecionada['objetivo'] or '—'}")
                    st.write(f"**Relato:** {selecionada['relato'] or '—'}")
                    st.write(f"**Pendências:** {selecionada['pendencias'] or '—'}")
                    st.caption("Somente o técnico responsável ou um gestor pode editar.")
                if gerencia and ui.confirmar_exclusao("visita"):
                    ui.gravar("Visita excluída.", dados.excluir, "visitas", selecionada["id"])

with aba_nova:
    formulario(None, unidades, perfis)
