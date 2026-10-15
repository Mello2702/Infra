"""Testes do script do Tampermonkey (web/ferramentas/sei-nota-empenho.user.js).

Rodam contra páginas que imitam o SEI (tests/sei_falso): pesquisa rápida e
árvore de documentos. O script é injetado em cada página como o Tampermonkey
faria. Sem o pdf.js (@require), a leitura do conteúdo dos PDFs fica de fora.
"""

import functools
import json
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from playwright.sync_api import expect

RAIZ = Path(__file__).parent.parent
SCRIPT = (RAIZ / "web" / "ferramentas" / "sei-nota-empenho.user.js").read_text(encoding="utf-8")
PAGINA_PROCESSOS = (RAIZ / "web" / "js" / "paginas" / "processos.js").read_text(encoding="utf-8")
NUMERO = "024.00120830/2026-12"


class _Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def sei_falso():
    pasta = Path(__file__).parent / "sei_falso"
    servidor = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Silencioso, directory=pasta))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{servidor.server_port}"
    servidor.shutdown()


@pytest.fixture
def sei(navegador, sei_falso):
    contexto = navegador.new_context()
    contexto.grant_permissions(["clipboard-read", "clipboard-write"], origin=sei_falso)
    # Como o Tampermonkey (@run-at document-idle): roda depois que a página carrega.
    contexto.add_init_script(f"window.addEventListener('load', () => {{\n{SCRIPT}\n}});")
    pg = contexto.new_page()
    pg.erros = []
    pg.on("pageerror", lambda erro: pg.erros.append(str(erro)))
    yield pg, sei_falso
    assert pg.erros == [], f"erros de JavaScript: {pg.erros}"
    contexto.close()


def test_pesquisa_le_a_arvore_e_copia_para_o_nie(sei):
    pg, base = sei
    pg.goto(f"{base}/inicio.html")
    pg.once("dialog", lambda d: d.accept(NUMERO))
    pg.get_by_role("button", name="Consultar Empenho").click()

    painel = pg.locator("#seiEmpenhoPainel")
    expect(painel).to_contain_text("Nota(s) de Empenho:")
    # A pesquisa passou pela rotina de envio do SEI (requestSubmit, não submit()).
    assert pg.evaluate("sessionStorage.getItem('teste_onsubmit_rodou')") == "1"
    numeros = painel.locator("li span")
    expect(numeros).to_have_text(["2026NE000123", "55/2026", "2026NE00077"])
    expect(painel.locator("li").nth(0)).to_contain_text("fonte: árvore")
    expect(painel.locator("li").nth(1)).to_contain_text("fonte: rótulo do documento")
    expect(painel).not_to_contain_text("2026NE000999")  # documento que não é PDF

    painel.get_by_role("button", name="Copiar para o nie").click()
    expect(painel).to_contain_text("Copiado!")
    copiado = json.loads(pg.evaluate("navigator.clipboard.readText()"))
    assert copiado == {
        "formato": "nie-empenhos",
        "versao": 1,
        "processo": NUMERO,
        "empenhos": ["2026NE000123", "55/2026", "2026NE00077"],
    }


def test_processo_nao_aberto_pela_pesquisa(sei):
    pg, base = sei
    pg.goto(f"{base}/inicio.html")
    pg.evaluate(f"sessionStorage.setItem('seiEmpenho_processo', '{NUMERO}')")
    pg.reload()
    expect(pg.locator("#seiEmpenhoPainel")).to_contain_text("A pesquisa não abriu um processo")


def test_nao_pergunta_sozinho_ao_abrir_o_sei(sei):
    pg, base = sei
    perguntas = []
    pg.on("dialog", lambda d: (perguntas.append(d.message), d.dismiss()))
    pg.goto(f"{base}/inicio.html")
    expect(pg.get_by_role("button", name="Consultar Empenho")).to_be_visible()
    pg.wait_for_timeout(1500)
    assert perguntas == []


def test_script_roda_so_no_sei_sp():
    matches = re.findall(r"^// @match\s+(\S+)", SCRIPT, re.MULTILINE)
    assert matches == ["https://sei.sp.gov.br/sei/*"]


def test_formato_combina_com_a_pagina_processos():
    # O que o script copia precisa ser o que o "Colar do SEI" aceita.
    no_script = re.search(r"FORMATO_NIE = '([^']+)';\s*const VERSAO_NIE = (\d+);", SCRIPT)
    na_pagina = re.search(r'FORMATO_SEI = "([^"]+)";\s*const VERSAO_SEI = (\d+);', PAGINA_PROCESSOS)
    assert no_script.groups() == na_pagina.groups()
