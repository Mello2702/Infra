"""Testes das páginas com um cliente Supabase falso (sem acesso à rede)."""

from pathlib import Path
from types import SimpleNamespace

import pytest
from streamlit.testing.v1 import AppTest

RAIZ = Path(__file__).parent.parent

ADMIN = {"id": "u1", "nome": "Ana", "email": "ana@exemplo.com", "papel": "admin", "ativo": True}
TECNICO = {**ADMIN, "id": "u2", "nome": "Beto", "email": "beto@exemplo.com", "papel": "tecnico"}

DADOS = {
    "perfis": [ADMIN, TECNICO],
    "unidades": [
        {
            "id": 1,
            "nome": "Sede",
            "sigla": "SD",
            "endereco": None,
            "municipio": "São Paulo",
            "responsavel": None,
            "telefone": None,
            "ativo": True,
        }
    ],
    "equipamentos": [
        {
            "id": 1,
            "patrimonio": "000123",
            "tipo": "Switch",
            "marca": "Cisco",
            "modelo": "2960",
            "numero_serie": "ABC",
            "unidade_id": 1,
            "localizacao": "Rack 1",
            "status": "em_uso",
            "data_aquisicao": "2024-03-10",
            "observacoes": None,
            "unidades": {"nome": "Sede"},
        },
        {
            "id": 2,
            "patrimonio": None,
            "tipo": "Notebook",
            "marca": None,
            "modelo": None,
            "numero_serie": None,
            "unidade_id": None,
            "localizacao": None,
            "status": "estoque",
            "data_aquisicao": None,
            "observacoes": None,
            "unidades": None,
        },
    ],
    "visitas": [
        {
            "id": 1,
            "unidade_id": 1,
            "tecnico_id": "u2",
            "data_visita": "2020-01-15",
            "tipo": "Preventiva",
            "status": "agendada",
            "objetivo": "Revisão do rack",
            "relato": None,
            "pendencias": None,
            "unidades": {"nome": "Sede"},
            "perfis": {"nome": "Beto"},
        }
    ],
}


class ConsultaFalsa:
    def __init__(self, cliente, tabela):
        self.cliente, self.tabela = cliente, tabela
        self.operacao = None

    def __getattr__(self, nome):
        def metodo(*args, **kwargs):
            if nome in ("insert", "update", "delete"):
                self.operacao = (nome, self.tabela, args[0] if args else None)
            return self

        return metodo

    def execute(self):
        if self.operacao:
            self.cliente.gravacoes.append(self.operacao)
        # Cópias, porque a camada de dados altera as linhas ao achatar as relações.
        return SimpleNamespace(data=[dict(linha) for linha in DADOS[self.tabela]])


class ClienteFalso:
    def __init__(self):
        self.gravacoes = []

    def table(self, nome):
        return ConsultaFalsa(self, nome)


def abrir(arquivo: str, usuario: dict | None = ADMIN) -> AppTest:
    at = AppTest.from_file(str(RAIZ / arquivo), default_timeout=30)
    at.session_state["supabase"] = ClienteFalso()
    if usuario:
        at.session_state["usuario"] = dict(usuario)
    return at.run()


def test_sem_configuracao_mostra_orientacao(monkeypatch):
    # Ignora o secrets.toml local e as variáveis de ambiente.
    monkeypatch.setattr("core.supabase_client._ler", lambda nome: None)
    at =AppTest.from_file(str(RAIZ / "app.py"), default_timeout=30).run()
    assert not at.exception
    assert "não configurada" in at.error[0].value


def test_sem_login_mostra_formulario():
    at = abrir("app.py", usuario=None)
    assert not at.exception
    assert [campo.label for campo in at.text_input] == ["E-mail", "Senha"]


def test_app_logado_abre_painel():
    at = abrir("app.py")
    assert not at.exception
    assert at.title[0].value == "Painel"
    metricas = {m.label: m.value for m in at.metric}
    assert metricas["Equipamentos"] == "2"
    assert metricas["Visitas atrasadas"] == "1"


@pytest.mark.parametrize("pagina", ["equipamentos", "visitas", "unidades", "usuarios", "conta"])
@pytest.mark.parametrize("usuario", [ADMIN, TECNICO])
def test_paginas_abrem_sem_erro(pagina, usuario):
    at = abrir(f"views/{pagina}.py", usuario)
    assert not at.exception


def test_usuarios_bloqueada_para_tecnico():
    at = abrir("views/usuarios.py", TECNICO)
    assert "permissão" in at.error[0].value
    assert not at.title


def test_cadastro_de_equipamento_grava_campos_normalizados():
    at = abrir("views/equipamentos.py")
    at.text_input(key="equip_novo_0_patrimonio").set_value("  000999 ")
    at.selectbox(key="equip_novo_0_tipo").set_value("Servidor")
    at.button[-1].click()
    at.run()
    assert not at.exception
    operacao, tabela, valores = at.session_state["supabase"].gravacoes[-1]
    assert (operacao, tabela) == ("insert", "equipamentos")
    assert valores["patrimonio"] == "000999"
    assert valores["tipo"] == "Servidor"
    assert valores["marca"] is None
    assert valores["status"] == "em_uso"


def test_equipamento_sem_tipo_nao_grava():
    at = abrir("views/equipamentos.py")
    at.button[-1].click()
    at.run()
    assert at.session_state["supabase"].gravacoes == []
    assert "tipo" in at.error[0].value


def test_tecnico_registra_visita_em_seu_nome():
    at = abrir("views/visitas.py", TECNICO)
    at.selectbox(key="visita_novo_0_unidade").set_value(1)
    at.button[-1].click()
    at.run()
    assert not at.exception
    operacao, tabela, valores = at.session_state["supabase"].gravacoes[-1]
    assert (operacao, tabela) == ("insert", "visitas")
    assert valores["tecnico_id"] == "u2"
    assert valores["unidade_id"] == 1
    assert valores["status"] == "agendada"
