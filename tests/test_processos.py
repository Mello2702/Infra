"""Testes da página Processos SEI (navegador real, Supabase simulado)."""

import json

from conftest import ADMIN, TECNICO, entrar
from playwright.sync_api import expect

NUMERO = "024.00120830/2026-12"


def abrir_pagina(pagina, usuario=ADMIN):
    entrar(pagina, usuario)
    pagina.get_by_role("link", name="Processos SEI").click()
    expect(pagina.get_by_role("heading", name="Processos SEI")).to_be_visible()


def arquivo_json(tmp_path, conteudo, nome="processos.json"):
    caminho = tmp_path / nome
    caminho.write_text(json.dumps(conteudo, ensure_ascii=False), encoding="utf-8")
    return caminho


def test_lista_mostra_ultimo_andamento(pagina):
    abrir_pagina(pagina)
    linha = pagina.get_by_role("row", name=NUMERO)
    expect(linha).to_contain_text("Sede")
    expect(linha).to_contain_text("05/03/2026 14:10 — Processo recebido")
    expect(pagina.get_by_role("row", name="024.00000001/2026-01")).to_contain_text("Ainda não consultado")


def test_detalhes_mostram_dados_do_sei(pagina):
    abrir_pagina(pagina)
    pagina.get_by_role("row", name=NUMERO).click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_label("Número do processo")).to_have_value(NUMERO)
    expect(janela).to_contain_text("Núcleo de Infraestrutura")
    expect(janela.get_by_role("heading", name="Andamentos (2)")).to_be_visible()
    expect(janela.get_by_role("cell", name="Processo remetido")).to_be_visible()
    expect(janela.get_by_role("cell", name="Ofício")).to_be_visible()
    expect(janela.get_by_role("link", name="abrir no SEI")).to_have_attribute(
        "href", "https://sei.sp.gov.br/sei/modulos/pesquisa/md_pesq_processo_exibir.php?x=1"
    )


def test_cadastro_de_processo(pagina, supabase):
    abrir_pagina(pagina)
    pagina.get_by_role("button", name="Novo processo").click()
    janela = pagina.get_by_role("dialog")
    janela.get_by_label("Número do processo").fill(" 024.00099999/2026-05 ")
    janela.get_by_label("Unidade").select_option(label="Sede")
    janela.get_by_label("Descrição (para que serve o processo)").fill("Troca de nobreak")
    janela.get_by_role("button", name="Cadastrar").click()
    expect(janela).to_have_count(0)
    assert supabase.gravacoes[-1] == (
        "POST",
        "processos_sei",
        {"numero": "024.00099999/2026-05", "unidade_id": 1, "descricao": "Troca de nobreak"},
    )


def test_importar_resultado_da_ferramenta(pagina, supabase, tmp_path):
    abrir_pagina(pagina)
    arquivo = arquivo_json(
        tmp_path,
        {
            "formato": 1,
            "processos": [
                {
                    "numero": NUMERO,
                    "situacao": "ok",
                    "url": "https://sei.sp.gov.br/sei/processo",
                    "consultado_em": "2026-10-15T13:00:00+00:00",
                    "tipo_processo": "Infraestrutura",
                    "cabecalho": {"Tipo": "Infraestrutura"},
                    "documentos": [],
                    "andamentos": [{"Data/Hora": "15/10/2026 10:00", "Descrição": "Novo andamento"}],
                },
                {
                    "numero": "024.55555555/2026-55",
                    "situacao": "ok",
                    "url": "javascript:alert(1)",  # endereço adulterado: deve ser descartado
                    "andamentos": [],
                },
                {"numero": "999.99999999/2026-99", "situacao": "nao_encontrado"},
            ],
        },
    )
    pagina.locator("[data-importar]").set_input_files(arquivo)
    expect(pagina.locator(".aviso")).to_contain_text(
        "2 processo(s) importado(s): 1 novo(s), 1 atualizado(s); 1 não encontrado(s) no SEI ficaram de fora."
    )
    metodo, tabela, linhas = supabase.gravacoes[-1]
    assert (metodo, tabela) == ("POST", "processos_sei")
    assert [linha["numero"] for linha in linhas] == [NUMERO, "024.55555555/2026-55"]
    assert linhas[0]["url"] == "https://sei.sp.gov.br/sei/processo"
    assert linhas[0]["andamentos"] == [{"Data/Hora": "15/10/2026 10:00", "Descrição": "Novo andamento"}]
    assert linhas[1]["url"] is None
    # Unidade e descrição cadastradas no sistema não são sobrescritas pela importação.
    assert "unidade_id" not in linhas[0] and "descricao" not in linhas[0]


def test_importar_arquivo_invalido(pagina, supabase, tmp_path):
    abrir_pagina(pagina)
    arquivo = arquivo_json(tmp_path, {"outra": "coisa"})
    pagina.locator("[data-importar]").set_input_files(arquivo)
    expect(pagina.locator(".aviso--erro")).to_contain_text("formato desconhecido")
    assert supabase.gravacoes == []


def test_tecnico_nao_exclui_processo(pagina):
    abrir_pagina(pagina, TECNICO)
    pagina.get_by_role("row", name=NUMERO).click()
    janela = pagina.get_by_role("dialog")
    expect(janela.get_by_role("button", name="Salvar")).to_be_visible()
    expect(janela.get_by_role("button", name="Excluir")).to_have_count(0)
