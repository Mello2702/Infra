"""Testes da página Processos e das notas de empenho (navegador real, Supabase simulado)."""

import json

from conftest import ADMIN, TECNICO, entrar
from playwright.sync_api import expect

NUMERO = "024.00120830/2026-12"


def abrir_pagina(pagina, usuario=ADMIN):
    entrar(pagina, usuario)
    pagina.get_by_role("link", name="Processos", exact=True).click()
    expect(pagina.get_by_role("heading", name="Processos", exact=True)).to_be_visible()


def abrir_processo(pagina, numero=NUMERO, usuario=ADMIN):
    abrir_pagina(pagina, usuario)
    pagina.get_by_role("row", name=numero).click()
    return pagina.get_by_role("dialog")


def empenhos_na_lista(janela):
    return janela.locator("[data-empenhos] tbody tr td:nth-child(2)")


def conteudo_sei(processo=NUMERO, empenhos=("2026NE000125",), formato="nie-empenhos", versao=1):
    dados = {"formato": formato, "versao": versao, "processo": processo, "empenhos": list(empenhos)}
    return json.dumps(dados)


def test_lista_mostra_notas_de_empenho_em_ordem(pagina):
    abrir_pagina(pagina)
    linha = pagina.get_by_role("row", name=NUMERO)
    expect(linha).to_contain_text("Sede")
    expect(linha).to_contain_text("2026NE000123, 2026NE000124")


def test_busca_por_nota_de_empenho(pagina):
    abrir_pagina(pagina)
    expect(pagina.locator("tbody tr")).to_have_count(2)
    pagina.get_by_label("Buscar").fill("2026ne000124")
    expect(pagina.locator("tbody tr")).to_have_count(1)


def test_cadastro_de_processo_com_notas_de_empenho(pagina, supabase):
    abrir_pagina(pagina)
    pagina.get_by_role("button", name="Novo processo").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Número do processo (SEI)").fill(" 024.00099999/2026-05 ")
    janela.get_by_label("Unidade").select_option(label="Sede")
    janela.get_by_label("Descrição (para que serve o processo)").fill("Troca de nobreak")
    nova = janela.get_by_label("Nota de empenho", exact=True)
    nova.fill("2026 ne 000201")  # espaços e minúsculas são normalizados
    nova.press("Enter")
    nova.fill("2026NE00077")
    janela.get_by_role("button", name="Adicionar").click()
    expect(empenhos_na_lista(janela)).to_have_text(["2026NE000201", "2026NE00077"])
    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    assert supabase.gravacoes[-1] == (
        "POST",
        "rpc/salvar_processo",
        {
            "p_id": None,
            "p_dados": {"numero": "024.00099999/2026-05", "unidade_id": 1, "descricao": "Troca de nobreak"},
            "p_empenhos": ["2026NE000201", "2026NE00077"],
        },
    )


def test_nota_de_empenho_repetida_nao_entra(pagina):
    janela = abrir_processo(pagina)
    expect(empenhos_na_lista(janela)).to_have_text(["2026NE000123", "2026NE000124"])
    janela.get_by_label("Nota de empenho", exact=True).fill("2026ne 000123")
    janela.get_by_role("button", name="Adicionar").click()
    expect(janela.get_by_text("Esse empenho já foi adicionado.")).to_be_visible()
    expect(empenhos_na_lista(janela)).to_have_count(2)


def test_editar_e_remover_nota_de_empenho(pagina, supabase):
    janela = abrir_processo(pagina)
    janela.get_by_role("button", name="Editar 2026NE000124").click()
    edicao = janela.get_by_label("Editar empenho 2")
    edicao.fill("2026NE000130")
    edicao.press("Enter")
    janela.get_by_role("button", name="Remover 2026NE000123").click()
    expect(empenhos_na_lista(janela)).to_have_text(["2026NE000130"])
    janela.get_by_role("button", name="Salvar").click()
    expect(janela).to_have_count(0)
    _, rota, corpo = supabase.gravacoes[-1]
    assert rota == "rpc/salvar_processo"
    assert corpo["p_id"] == 1
    assert corpo["p_empenhos"] == ["2026NE000130"]


def test_colar_do_sei(pagina, supabase):
    abrir_pagina(pagina)
    pagina.get_by_role("button", name="Colar do SEI").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Conteúdo copiado do SEI").fill(
        conteudo_sei(empenhos=["2026NE000123", "2026ne000125", "55/2026"])
    )
    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    expect(pagina.locator(".aviso")).to_contain_text(
        f"Processo {NUMERO}: 2 nota(s) de empenho adicionada(s), 1 já estava(m) cadastrada(s)."
    )
    assert supabase.gravacoes[-1] == (
        "POST",
        "rpc/importar_empenhos",
        {"p_numero": NUMERO, "p_empenhos": ["2026NE000123", "2026NE000125", "55/2026"]},
    )


def test_colar_do_sei_processo_novo(pagina):
    abrir_pagina(pagina)
    pagina.get_by_role("button", name="Colar do SEI").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Conteúdo copiado do SEI").fill(conteudo_sei(processo="024.77777777/2026-07"))
    janela.get_by_role("button", name="Cadastrar").click()
    expect(pagina.locator(".aviso")).to_contain_text("Processo 024.77777777/2026-07 cadastrado: 1 nota(s)")


def test_colar_do_sei_conteudo_invalido(pagina, supabase):
    abrir_pagina(pagina)
    pagina.get_by_role("button", name="Colar do SEI").click()
    janela = pagina.get_by_role("dialog")
    campo = janela.get_by_label("Conteúdo copiado do SEI")
    for conteudo, mensagem in [
        ("texto qualquer", "Copiar para o nie"),
        (conteudo_sei(formato="outro"), "Conteúdo não reconhecido"),
        (conteudo_sei(empenhos=[]), "nenhum número de nota de empenho"),
    ]:
        campo.fill(conteudo)
        janela.get_by_role("button", name="Cadastrar").click()
        expect(janela.locator(".alerta--erro")).to_contain_text(mensagem)
    assert supabase.gravacoes == []


def test_tecnico_edita_mas_nao_exclui_processo(pagina):
    janela = abrir_processo(pagina, usuario=TECNICO)
    expect(janela.get_by_role("button", name="Salvar")).to_be_visible()
    expect(janela.get_by_role("button", name="Excluir")).to_have_count(0)
