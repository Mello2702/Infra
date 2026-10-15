"""Testes da ferramenta de consulta ao SEI (ferramentas/sei) contra um SEI falso local.

O SEI falso (tests/sei_falso) reproduz a estrutura da Pesquisa Pública real e
simula a pessoa digitando o CAPTCHA (?auto=1), sem acessar o SEI de verdade.
"""

import functools
import importlib.util
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

RAIZ = Path(__file__).parent.parent
SCRIPT = RAIZ / "ferramentas" / "sei" / "sei_busca_processo.py"
spec = importlib.util.spec_from_file_location("sei_busca", SCRIPT)
sei = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sei)

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


@pytest.mark.parametrize("aba", ["mesma", "nova"])
def test_consulta_processo_na_mesma_aba_ou_em_aba_nova(navegador, sei_falso, tmp_path, aba):
    # O script original quebrava quando o processo abria na mesma aba.
    url = f"{sei_falso}/pesquisa.html?auto=1&aba={aba}"
    [r] = sei.consultar([NUMERO], url=url, saida=tmp_path, espera_s=20, navegador=navegador)

    assert r["situacao"] == "ok"
    assert r["tipo_processo"] == "Infraestrutura: Manutenção predial"
    assert r["cabecalho"]["Processo"] == NUMERO
    assert r["cabecalho"]["Interessados"] == "Núcleo de Infraestrutura"
    assert r["andamentos"][0] == {
        "Data/Hora": "05/03/2026 14:10",
        "Unidade": "PRODESP-NIE",
        "Descrição": "Processo recebido na unidade",
    }
    assert len(r["andamentos"]) == 2
    # A coluna de caixa de seleção (sem título nem valor) é descartada.
    assert r["documentos"][0] == {
        "Documento / Processo": "12345678",
        "Tipo de Documento": "Ofício",
        "Data do Documento": "02/03/2026",
        "Unidade": "PRODESP-NIE",
    }

    arquivo = json.loads((tmp_path / "processos.json").read_text(encoding="utf-8"))
    assert arquivo["formato"] == sei.FORMATO
    assert arquivo["processos"][0]["numero"] == NUMERO
    assert (tmp_path / "024_00120830_2026_12.png").exists()


def test_espera_novo_captcha_depois_de_erro(navegador, sei_falso, tmp_path):
    # Captcha vazio/errado: o SEI avisa e a pessoa tenta de novo; o script continua esperando.
    url = f"{sei_falso}/pesquisa.html?auto=1&errar=1"
    [r] = sei.consultar([NUMERO], url=url, saida=tmp_path, espera_s=20, navegador=navegador)
    assert r["situacao"] == "ok"


def test_processo_nao_encontrado(navegador, sei_falso, tmp_path):
    url = f"{sei_falso}/pesquisa.html?auto=1"
    resultados = sei.consultar(
        ["999.99999999/2026-99", NUMERO], url=url, saida=tmp_path, espera_s=20, navegador=navegador
    )
    assert [r["situacao"] for r in resultados] == ["nao_encontrado", "ok"]


def test_numeros_repetidos_e_linhas_vazias_sao_ignorados(tmp_path):
    lista = tmp_path / "numeros.txt"
    lista.write_text(f"{NUMERO}\n\n  {NUMERO}  \n024.1/2026-01\n", encoding="utf-8")

    class Args:
        numeros = [NUMERO]
        arquivo = lista

    assert sei.ler_numeros(Args) == [NUMERO, "024.1/2026-01"]
