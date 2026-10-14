"""Testes do site com navegador real e Supabase simulado (ver conftest.py)."""

import pytest
from conftest import ADMIN, INATIVO, TECNICO, entrar
from playwright.sync_api import expect


def test_senha_errada_mostra_mensagem(pagina):
    entrar(pagina, ADMIN, senha="errada")
    expect(pagina.locator(".login .alerta")).to_have_text("E-mail ou senha inválidos.")


def test_usuario_inativo_nao_entra(pagina):
    entrar(pagina, INATIVO)
    expect(pagina.locator(".login .alerta")).to_contain_text("inativo")


def test_admin_entra_e_ve_painel(pagina):
    entrar(pagina, ADMIN)
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
    metricas = pagina.locator(".metrica")
    expect(metricas.filter(has_text="Equipamentos")).to_contain_text("2")
    expect(metricas.filter(has_text="Visitas atrasadas")).to_contain_text("1")
    expect(pagina.get_by_role("link", name="Usuários")).to_be_visible()


def test_login_sobrevive_a_recarregar(pagina):
    entrar(pagina, ADMIN)
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
    pagina.reload()
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()


def test_tecnico_nao_acessa_usuarios(pagina):
    entrar(pagina, TECNICO)
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
    expect(pagina.get_by_role("link", name="Usuários")).to_have_count(0)
    pagina.goto(pagina.url.split("#")[0] + "#/usuarios")
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()


@pytest.mark.parametrize("usuario", [ADMIN, TECNICO], ids=["admin", "tecnico"])
@pytest.mark.parametrize(
    ("link", "titulo"),
    [
        ("Equipamentos", "Inventário de equipamentos"),
        ("Visitas", "Visitas às unidades"),
        ("Unidades", "Unidades"),
        ("Minha conta", "Minha conta"),
    ],
)
def test_paginas_abrem(pagina, usuario, link, titulo):
    entrar(pagina, usuario)
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
    pagina.get_by_role("link", name=link).click()
    expect(pagina.get_by_role("heading", name=titulo)).to_be_visible()
    expect(pagina.locator(".alerta--erro:visible")).to_have_count(0)


def test_cadastro_de_equipamento_grava_campos_normalizados(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Equipamentos").click()
    pagina.get_by_role("button", name="Novo equipamento").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Patrimônio").fill("  000999 ")
    janela.get_by_label("Tipo").fill("Servidor")
    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    metodo, tabela, valores = supabase.gravacoes[-1]
    assert (metodo, tabela) == ("POST", "equipamentos")
    assert valores["patrimonio"] == "000999"
    assert valores["tipo"] == "Servidor"
    assert valores["marca"] is None
    assert valores["unidade_id"] is None
    assert valores["status"] == "em_uso"


def test_equipamento_sem_tipo_nao_grava(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Equipamentos").click()
    pagina.get_by_role("button", name="Novo equipamento").click()
    pagina.get_by_role("dialog").get_by_role("button", name="Cadastrar").click()
    expect(pagina.get_by_role("dialog")).to_be_visible()
    assert supabase.gravacoes == []


def test_editar_equipamento_pela_tabela(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Equipamentos").click()
    pagina.get_by_role("row", name="000123").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Marca").fill("HP")
    janela.get_by_role("button", name="Salvar").click()
    expect(janela).to_have_count(0)
    metodo, tabela, valores = supabase.gravacoes[-1]
    assert (metodo, tabela) == ("PATCH", "equipamentos")
    assert valores["marca"] == "HP"
    assert valores["unidade_id"] == 1


def test_filtro_de_equipamentos(pagina):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Equipamentos").click()
    expect(pagina.locator("tbody tr")).to_have_count(2)
    pagina.get_by_label("Buscar").fill("cisco")
    expect(pagina.locator("tbody tr")).to_have_count(1)


def test_tecnico_registra_visita_em_seu_nome(pagina, supabase):
    entrar(pagina, TECNICO)
    pagina.get_by_role("link", name="Visitas").click()
    pagina.get_by_role("button", name="Nova visita").click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_label("Técnico responsável")).to_be_disabled()
    janela.get_by_label("Unidade").select_option(label="Sede")
    janela.get_by_role("button", name="Registrar").click()
    expect(janela).to_have_count(0)
    metodo, tabela, valores = supabase.gravacoes[-1]
    assert (metodo, tabela) == ("POST", "visitas")
    assert valores["tecnico_id"] == "u2"
    assert valores["unidade_id"] == 1
    assert valores["status"] == "agendada"


@pytest.mark.parametrize(("dono", "pode_editar"), [("u2", True), ("u1", False)], ids=["propria", "de-outro"])
def test_tecnico_so_edita_as_proprias_visitas(pagina, dono, pode_editar):
    from conftest import DADOS

    DADOS["visitas"][0]["tecnico_id"] = dono
    try:
        entrar(pagina, TECNICO)
        pagina.get_by_role("link", name="Visitas").click()
        pagina.get_by_role("row", name="Revisão do rack").click()
        janela = pagina.get_by_role("dialog")
        expect(janela.get_by_role("button", name="Salvar")).to_have_count(1 if pode_editar else 0)
        expect(janela.get_by_label("Relato (o que foi feito)")).to_be_editable(editable=pode_editar)
    finally:
        DADOS["visitas"][0]["tecnico_id"] = "u2"


def test_admin_nao_altera_proprio_papel(pagina):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Usuários").click()
    pagina.get_by_role("row", name="ana@exemplo.com").click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_label("Papel")).to_be_disabled()
    expect(janela.get_by_label("Usuário ativo")).to_be_disabled()


def test_texto_do_banco_e_escapado(pagina):
    from conftest import DADOS

    DADOS["unidades"][0]["razao_social"] = "<img src=x onerror=alert(1)>"
    try:
        entrar(pagina, ADMIN)
        pagina.get_by_role("link", name="Unidades").click()
        expect(pagina.get_by_role("cell", name="<img src=x onerror=alert(1)>")).to_be_visible()
        expect(pagina.locator("td img")).to_have_count(0)
    finally:
        DADOS["unidades"][0]["razao_social"] = None


def test_cadastro_de_unidade_grava_todos_os_campos(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Unidades").click()
    pagina.get_by_role("button", name="Nova unidade").click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_label("UF")).to_have_value("SP")
    janela.get_by_label("Nome").fill("Poupatempo Sé")
    janela.get_by_label("Razão social").fill("  Companhia de Processamento de Dados ")
    janela.get_by_label("Endereço").fill("Praça do Carmo, s/n")
    janela.get_by_label("Cidade").fill("São Paulo")
    janela.get_by_label("UF").select_option("SP")
    janela.get_by_label("UGE").fill("380101")
    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    metodo, tabela, valores = supabase.gravacoes[-1]
    assert (metodo, tabela) == ("POST", "unidades")
    assert valores == {
        "nome": "Poupatempo Sé",
        "razao_social": "Companhia de Processamento de Dados",
        "endereco": "Praça do Carmo, s/n",
        "cidade": "São Paulo",
        "uf": "SP",
        "uge": "380101",
        "ativo": True,
    }


def test_unidade_sem_nome_nao_grava(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Unidades").click()
    pagina.get_by_role("button", name="Nova unidade").click()
    pagina.get_by_role("dialog").get_by_role("button", name="Cadastrar").click()
    expect(pagina.get_by_role("dialog")).to_be_visible()
    assert supabase.gravacoes == []


def test_tecnico_so_consulta_unidades(pagina):
    entrar(pagina, TECNICO)
    pagina.get_by_role("link", name="Unidades").click()
    expect(pagina.get_by_role("cell", name="São Paulo")).to_be_visible()
    expect(pagina.get_by_role("button", name="Nova unidade")).to_have_count(0)
    pagina.get_by_role("row", name="Sede").click()
    expect(pagina.get_by_role("dialog")).to_have_count(0)
