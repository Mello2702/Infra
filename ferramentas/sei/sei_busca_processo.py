"""
Consulta processos na Pesquisa Pública do SEI-SP (sei.sp.gov.br) e gera um
arquivo para importar no sistema nie (página Processos SEI → Importar resultado).

Uso:
    pip install -r ferramentas/sei/requirements.txt
    python ferramentas/sei/sei_busca_processo.py 024.00120830/2026-12
    python ferramentas/sei/sei_busca_processo.py 024.00120830/2026-12 024.00000001/2026-01
    python ferramentas/sei/sei_busca_processo.py --arquivo numeros.txt   # um número por linha

O navegador abre na tela. Para cada processo o script preenche o número e
espera você digitar o CAPTCHA e clicar em "Pesquisar"; o resto é automático.
Se errar o CAPTCHA, basta digitar o novo e pesquisar de novo.

Saída (pasta resultado_sei/):
    processos.json   → arquivo a importar no sistema
    <número>.png     → captura da página de cada processo
    <número>.html    → HTML da página de cada processo
"""

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

URL_PESQUISA = (
    "https://sei.sp.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php"
    "?acao_externa=protocolo_pesquisar"
    "&acao_origem_externa=protocolo_pesquisar"
    "&id_orgao_acesso_externo=0"
)

# Versão do formato de processos.json lido pelo sistema (web/js/paginas/processos.js).
FORMATO = 1

# Texto mostrado pelo SEI quando a pesquisa não encontra nada.
SEM_RESULTADO = re.compile(r"nenhum|não foram encontrad|nao foram encontrad", re.IGNORECASE)

# Converte uma tabela do SEI em lista de dicionários {título da coluna: valor}.
# Colunas sem título e sem valor (ícones, caixas de seleção) são descartadas.
JS_TABELA = """(t) => {
    const linhas = [...t.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr')];
    if (!linhas.length) return [];
    let i = linhas.findIndex((tr) => tr.querySelector('th'));
    if (i < 0) i = 0;
    const cab = [...linhas[i].children].map((c) => c.innerText.trim());
    return linhas.slice(i + 1).map((tr) => {
        const o = {};
        [...tr.children].forEach((c, k) => {
            const valor = c.innerText.trim();
            if (cab[k] || valor) o[cab[k] || `coluna ${k + 1}`] = valor;
        });
        return o;
    }).filter((o) => Object.values(o).some((v) => v));
}"""

# Tabela de autuação (rótulo: valor por linha) → dicionário.
JS_CABECALHO = """(t) => {
    const o = {};
    for (const tr of t.querySelectorAll('tr')) {
        const c = [...tr.children];
        if (c.length < 2) continue;
        const rotulo = c[0].innerText.trim().replace(/:$/, '');
        if (rotulo) o[rotulo] = c.slice(1).map((x) => x.innerText.trim()).join(' ').trim();
    }
    return o;
}"""


def nome_arquivo(numero: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "_", numero).strip("_")


def extrair_tabela(page, seletor: str) -> list[dict]:
    tabela = page.locator(seletor).first
    return tabela.evaluate(JS_TABELA) if tabela.count() else []


def extrair_cabecalho(page) -> dict:
    tabela = page.locator("#tblCabecalho").first
    return tabela.evaluate(JS_CABECALHO) if tabela.count() else {}


def abrir_link(ctx, page, link):
    """Clica no link do processo, que pode abrir numa aba nova ou na mesma aba."""
    try:
        with ctx.expect_page(timeout=5_000) as nova:
            link.click()
        return nova.value
    except PWTimeout:
        # Nenhuma aba nova: o processo abriu na própria aba da pesquisa.
        return page


def consultar_processo(ctx, page, numero: str, url: str, espera_ms: int, saida: Path) -> dict:
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    campo = page.locator("#txtProtocoloPesquisa")
    campo.wait_for(state="visible", timeout=30_000)
    campo.fill(numero)

    captcha = page.locator("#txtInfraCaptcha")
    if captcha.count():
        captcha.focus()
        print(f"    Digite o CAPTCHA no navegador e clique em 'Pesquisar' (até {espera_ms // 1000} s)...")
    else:
        page.locator("#sbmPesquisar").click()

    # O SEI carrega o resultado por AJAX dentro de .retorno-ajax: uma linha
    # tr.pesquisaTituloRegistro por processo, ou um aviso de consulta vazia.
    resultados = page.locator(".retorno-ajax tr.pesquisaTituloRegistro")
    vazio = page.locator(".retorno-ajax").get_by_text(SEM_RESULTADO)
    try:
        resultados.or_(vazio).first.wait_for(state="visible", timeout=espera_ms)
    except PWTimeout:
        print("    Tempo esgotado esperando o resultado da pesquisa.")
        return {"numero": numero, "situacao": "tempo_esgotado"}

    if resultados.count() == 0:
        print("    Nenhum processo encontrado (ou ele é restrito na pesquisa pública).")
        return {"numero": numero, "situacao": "nao_encontrado"}

    link = page.locator(".retorno-ajax a", has_text=numero).first
    if link.count() == 0:
        link = resultados.first.locator("a").first
    processo = abrir_link(ctx, page, link)
    processo.wait_for_load_state("domcontentloaded")
    try:
        processo.locator("#tblCabecalho, #tblDocumentos, #tblHistorico").first.wait_for(timeout=30_000)
    except PWTimeout:
        print("    A página do processo não trouxe as tabelas esperadas; salvo o que houver.")

    cabecalho = extrair_cabecalho(processo)
    dados = {
        "numero": numero,
        "situacao": "ok",
        "url": processo.url,
        "consultado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "tipo_processo": next((v for k, v in cabecalho.items() if k.lower().startswith("tipo")), None),
        "cabecalho": cabecalho,
        "documentos": extrair_tabela(processo, "#tblDocumentos"),
        "andamentos": extrair_tabela(processo, "#tblHistorico"),
    }
    base = saida / nome_arquivo(numero)
    processo.screenshot(path=base.with_suffix(".png"), full_page=True)
    base.with_suffix(".html").write_text(processo.content(), encoding="utf-8")
    if processo is not page:
        processo.close()
    print(f"    Documentos: {len(dados['documentos'])} | Andamentos: {len(dados['andamentos'])}")
    return dados


def consultar(
    numeros, url=URL_PESQUISA, saida=Path("resultado_sei"), espera_s=180, canal=None, navegador=None
):
    """Consulta os processos e grava saida/processos.json. Devolve a lista de resultados.

    `navegador` permite reaproveitar um navegador já aberto (usado nos testes).
    """
    saida = Path(saida)
    saida.mkdir(parents=True, exist_ok=True)
    resultados = []

    def executar(browser):
        ctx = browser.new_context(locale="pt-BR", viewport={"width": 1366, "height": 900})
        page = ctx.new_page()
        for i, numero in enumerate(numeros, 1):
            print(f"[{i}/{len(numeros)}] {numero}")
            resultados.append(consultar_processo(ctx, page, numero, url, espera_s * 1000, saida))
        ctx.close()

    if navegador is not None:
        executar(navegador)
    else:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False, channel=canal)
            executar(browser)
            browser.close()

    arquivo = saida / "processos.json"
    arquivo.write_text(
        json.dumps(
            {
                "formato": FORMATO,
                "origem": "SEI-SP - Pesquisa Pública",
                "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
                "processos": resultados,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return resultados


def ler_numeros(args) -> list[str]:
    numeros = list(args.numeros)
    if args.arquivo:
        numeros += Path(args.arquivo).read_text(encoding="utf-8").splitlines()
    vistos = []
    for n in (n.strip() for n in numeros):
        if n and n not in vistos:
            vistos.append(n)
    return vistos


def main() -> int:
    parser = argparse.ArgumentParser(description="Consulta processos na Pesquisa Pública do SEI-SP.")
    parser.add_argument("numeros", nargs="*", help="números dos processos")
    parser.add_argument("--arquivo", help="arquivo de texto com um número de processo por linha")
    parser.add_argument("--saida", default="resultado_sei", help="pasta de saída (padrão: resultado_sei)")
    parser.add_argument(
        "--espera", type=int, default=180, help="segundos para digitar o CAPTCHA (padrão: 180)"
    )
    parser.add_argument(
        "--navegador",
        default="msedge" if sys.platform == "win32" else None,
        help="msedge, chrome ou chromium (padrão no Windows: msedge, já instalado)",
    )
    args = parser.parse_args()

    numeros = ler_numeros(args)
    if not numeros:
        parser.error("informe ao menos um número de processo")
    canal = None if args.navegador in (None, "chromium") else args.navegador

    resultados = consultar(numeros, saida=Path(args.saida), espera_s=args.espera, canal=canal)
    ok = sum(r["situacao"] == "ok" for r in resultados)
    print(f"\n{ok} de {len(resultados)} processo(s) consultado(s).")
    print(f"Importe no sistema o arquivo: {(Path(args.saida) / 'processos.json').resolve()}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
