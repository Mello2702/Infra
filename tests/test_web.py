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


def test_atalhos_para_minha_area_e_sei(pagina):
    entrar(pagina, TECNICO)
    acessos = pagina.get_by_role("navigation", name="Acessos externos")
    for nome, url in [("Minha Área SP", "https://minhaarea.sp.gov.br/"), ("SEI-SP", "https://sei.sp.gov.br/sei/")]:
        link = acessos.get_by_role("link", name=nome)
        expect(link).to_have_attribute("href", url)
        # Abre em aba nova sem dar à página externa acesso a esta (window.opener).
        expect(link).to_have_attribute("target", "_blank")
        expect(link).to_have_attribute("rel", "noopener noreferrer")


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
        ("Processos", "Processos"),
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
        expect(pagina.get_by_text("<img src=x onerror=alert(1)>")).to_be_visible()
        expect(pagina.locator(".cartao-unidade img")).to_have_count(0)
    finally:
        DADOS["unidades"][0]["razao_social"] = None


def cartao_unidade(pagina, texto):
    return pagina.locator(".cartao-unidade", has_text=texto)


def abrir_unidade(pagina, nome_linha=None):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Unidades", exact=True).click()
    if nome_linha:
        cartao_unidade(pagina, nome_linha).get_by_role("button", name="Ver detalhes").click()
    else:
        pagina.get_by_role("button", name="Nova unidade").click()
    return pagina.get_by_role("dialog")


def tipos_na_lista(janela):
    return janela.locator("[data-tipos] tbody tr td:nth-child(2)")


def test_cadastro_de_unidade_com_varios_tipos(pagina, supabase):
    janela = abrir_unidade(pagina)
    expect(janela.get_by_label("Estado (UF)")).to_have_value("SP")
    janela.get_by_label("Nome fantasia").fill("Água Funda")
    janela.get_by_label("Razão social").fill("  Centro de Atenção Integrada a Saúde Mental ")
    janela.get_by_label("UGE").fill("090170")
    janela.get_by_label("Endereço").fill("Avenida Miguel Stéfano, 3030")
    janela.get_by_label("Cidade").fill("São Paulo")

    novo_tipo = janela.get_by_label("Tipo de estabelecimento", exact=True)
    adicionar = janela.get_by_role("button", name="Adicionar")
    expect(adicionar).to_be_disabled()
    novo_tipo.fill("Psiquiátrico")
    adicionar.click()
    novo_tipo.fill("Posto de atendimento")
    novo_tipo.press("Enter")  # Enter adiciona, não envia o formulário
    expect(janela).to_be_visible()
    expect(tipos_na_lista(janela)).to_have_text(["Psiquiátrico", "Posto de atendimento"])

    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    metodo, rota, corpo = supabase.gravacoes[-1]
    assert (metodo, rota) == ("POST", "rpc/salvar_unidade")
    assert corpo == {
        "p_id": None,
        "p_dados": {
            "nome": "Água Funda",
            "razao_social": "Centro de Atenção Integrada a Saúde Mental",
            "endereco": "Avenida Miguel Stéfano, 3030",
            "cidade": "São Paulo",
            "uf": "SP",
            "uge": "090170",
            "ativo": True,
        },
        "p_tipos": ["Psiquiátrico", "Posto de atendimento"],
    }


def test_tipo_repetido_nao_entra_na_lista(pagina):
    janela = abrir_unidade(pagina, "Sede administrativa")
    expect(tipos_na_lista(janela)).to_have_text(["Sede administrativa"])
    janela.get_by_label("Tipo de estabelecimento", exact=True).fill("SEDE administrativa")
    janela.get_by_role("button", name="Adicionar").click()
    expect(janela.get_by_text("Esse tipo já foi adicionado.")).to_be_visible()
    expect(tipos_na_lista(janela)).to_have_count(1)


def test_editar_e_remover_tipos_da_unidade(pagina, supabase):
    janela = abrir_unidade(pagina, "Sede administrativa")
    janela.get_by_role("button", name="Editar Sede administrativa").click()
    edicao = janela.get_by_label("Editar tipo 1")
    edicao.fill("Sede regional")
    edicao.press("Enter")
    novo_tipo = janela.get_by_label("Tipo de estabelecimento", exact=True)
    for nome in ("Almoxarifado", "Data center"):
        novo_tipo.fill(nome)
        novo_tipo.press("Enter")
    janela.get_by_role("button", name="Remover Almoxarifado").click()
    expect(tipos_na_lista(janela)).to_have_text(["Sede regional", "Data center"])
    expect(janela.locator("[data-tipos] tbody tr td:first-child")).to_have_text(["1", "2"])

    janela.get_by_role("button", name="Salvar").click()
    expect(janela).to_have_count(0)
    _, rota, corpo = supabase.gravacoes[-1]
    assert rota == "rpc/salvar_unidade"
    assert corpo["p_id"] == 1
    assert corpo["p_tipos"] == ["Sede regional", "Data center"]


def test_esc_cancela_so_a_edicao_do_tipo(pagina):
    janela = abrir_unidade(pagina, "Sede administrativa")
    janela.get_by_role("button", name="Editar Sede administrativa").click()
    edicao = janela.get_by_label("Editar tipo 1")
    edicao.fill("Outro nome")
    edicao.press("Escape")
    expect(janela).to_be_visible()
    expect(tipos_na_lista(janela)).to_have_text(["Sede administrativa"])


def test_tipo_digitado_sem_adicionar_tambem_e_salvo(pagina, supabase):
    janela = abrir_unidade(pagina, "Sede administrativa")
    janela.get_by_label("Tipo de estabelecimento", exact=True).fill("Psiquiátrico")
    janela.get_by_role("button", name="Salvar").click()
    expect(janela).to_have_count(0)
    assert supabase.gravacoes[-1][2]["p_tipos"] == ["Sede administrativa", "Psiquiátrico"]


def test_unidade_sem_nome_nao_grava(pagina, supabase):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Unidades").click()
    pagina.get_by_role("button", name="Nova unidade").click()
    pagina.get_by_role("dialog").get_by_role("button", name="Cadastrar").click()
    expect(pagina.get_by_role("dialog")).to_be_visible()
    assert supabase.gravacoes == []


def test_unidades_aparecem_em_cartoes(pagina):
    from conftest import DADOS

    unidade = DADOS["unidades"][0]
    unidade.update(razao_social="Centro de Atenção Integrada", endereco="Avenida Miguel Stéfano, 3030")
    try:
        entrar(pagina, ADMIN)
        pagina.get_by_role("link", name="Unidades", exact=True).click()
        cartao = cartao_unidade(pagina, "Sede")
        expect(cartao.get_by_role("heading", name="Sede")).to_be_visible()
        expect(cartao).to_contain_text("Centro de Atenção Integrada")
        expect(cartao).to_contain_text("Avenida Miguel Stéfano, 3030")
        expect(cartao.locator(".selo").first).to_have_text("São Paulo - SP")
        expect(cartao.locator(".selo--tipo")).to_have_text(["Sede administrativa"])
        expect(cartao.get_by_role("button", name="Ver detalhes")).to_be_visible()
    finally:
        unidade.update(razao_social=None, endereco=None)


def test_busca_de_unidades(pagina):
    entrar(pagina, ADMIN)
    pagina.get_by_role("link", name="Unidades", exact=True).click()
    expect(pagina.locator(".cartao-unidade")).to_have_count(1)
    busca = pagina.get_by_label("Buscar")
    busca.fill("administrativa")  # tipo de estabelecimento também entra na busca
    expect(pagina.locator(".cartao-unidade")).to_have_count(1)
    busca.fill("inexistente")
    expect(pagina.locator(".cartao-unidade")).to_have_count(0)
    expect(pagina.get_by_text("Nenhuma unidade encontrada para essa busca.")).to_be_visible()


def test_tecnico_so_consulta_unidades(pagina):
    entrar(pagina, TECNICO)
    pagina.get_by_role("link", name="Unidades", exact=True).click()
    expect(pagina.get_by_role("button", name="Nova unidade")).to_have_count(0)
    cartao_unidade(pagina, "Sede").get_by_role("button", name="Ver detalhes").click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_label("Nome fantasia")).to_have_value("Sede")
    expect(janela.get_by_label("Nome fantasia")).to_be_disabled()
    expect(janela.get_by_role("button", name="Salvar")).to_have_count(0)
    expect(janela.get_by_role("button", name="Adicionar")).to_be_disabled()


def test_pagina_de_tipos_nao_existe_mais(pagina):
    entrar(pagina, ADMIN)
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
    expect(pagina.locator(".menu").get_by_role("link", name="Tipos de estabelecimento")).to_have_count(0)
    # Endereço antigo leva ao painel.
    pagina.goto(pagina.url.split("#")[0] + "#/tipos")
    expect(pagina.get_by_role("heading", name="Painel")).to_be_visible()
