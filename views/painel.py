"""Painel com o resumo do inventário e das visitas."""

from datetime import date

import pandas as pd
import streamlit as st

from core import dados, ui
from core.constantes import STATUS_EQUIPAMENTO

st.title("Painel")

equipamentos = ui.carregar(dados.listar_equipamentos)
visitas = ui.carregar(dados.listar_visitas)

hoje = date.today().isoformat()
mes = hoje[:7]
agendadas = [v for v in visitas if v["status"] == "agendada"]
atrasadas = [v for v in agendadas if v["data_visita"] < hoje]
realizadas_mes = [
    v for v in visitas if v["status"] == "realizada" and v["data_visita"].startswith(mes)
]

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Equipamentos", len(equipamentos))
c2.metric("Em manutenção", sum(e["status"] == "manutencao" for e in equipamentos))
c3.metric("Visitas agendadas", len(agendadas))
c4.metric("Visitas atrasadas", len(atrasadas))
c5.metric("Realizadas no mês", len(realizadas_mes))

esquerda, direita = st.columns(2)

with esquerda:
    st.subheader("Equipamentos por unidade")
    if equipamentos:
        por_unidade = (
            pd.Series([e["unidade"] or "Sem unidade" for e in equipamentos], name="Equipamentos")
            .value_counts()
            .rename_axis("Unidade")
        )
        st.bar_chart(por_unidade, horizontal=True)
        por_status = pd.Series([e["status"] for e in equipamentos]).value_counts()
        st.caption(
            " · ".join(
                f"{STATUS_EQUIPAMENTO[status]}: {total}" for status, total in por_status.items()
            )
        )
    else:
        st.info("Nenhum equipamento cadastrado ainda.")

with direita:
    st.subheader("Próximas visitas")
    proximas = sorted(agendadas, key=lambda v: v["data_visita"])[:10]
    if proximas:
        st.dataframe(
            pd.DataFrame(
                {
                    "Data": [ui.data_br(v["data_visita"]) for v in proximas],
                    "Unidade": [v["unidade"] for v in proximas],
                    "Tipo": [v["tipo"] for v in proximas],
                    "Técnico": [v["tecnico"] for v in proximas],
                    "Situação": [
                        "Atrasada" if v["data_visita"] < hoje else "No prazo" for v in proximas
                    ],
                }
            ),
            hide_index=True,
            width="stretch",
        )
    else:
        st.info("Nenhuma visita agendada.")

    pendentes = [v for v in visitas if v["status"] == "realizada" and v["pendencias"]]
    if pendentes:
        st.subheader("Pendências de visitas realizadas")
        for v in pendentes[:5]:
            st.markdown(f"**{v['unidade']}** ({ui.data_br(v['data_visita'])}): {v['pendencias']}")
