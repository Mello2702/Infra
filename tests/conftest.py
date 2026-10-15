"""Infraestrutura dos testes: servidor local do site e um Supabase simulado.

O site roda num navegador de verdade (Playwright). As chamadas ao Supabase são
interceptadas e respondidas aqui, sem acesso ao projeto real.
"""

import base64
import copy
import functools
import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import sync_playwright

WEB = Path(__file__).parent.parent / "web"
SUPABASE_TESTE = "https://teste.supabase.co"
SENHA = "senha-certa-123"

ADMIN = {"id": "u1", "nome": "Ana", "email": "ana@exemplo.com", "papel": "admin", "ativo": True}
TECNICO = {**ADMIN, "id": "u2", "nome": "Beto", "email": "beto@exemplo.com", "papel": "tecnico"}
INATIVO = {**ADMIN, "id": "u3", "nome": "Caio", "email": "caio@exemplo.com", "ativo": False}

DADOS = {
    "perfis": [ADMIN, TECNICO, INATIVO],
    "tipos_estabelecimento": [
        {"id": 1, "nome": "Sede administrativa", "descricao": None, "ativo": True},
        {"id": 2, "nome": "Posto de atendimento", "descricao": None, "ativo": True},
        {"id": 3, "nome": "Almoxarifado", "descricao": None, "ativo": False},
    ],
    "unidades": [
        {
            "id": 1,
            "nome": "Sede",
            "razao_social": None,
            "endereco": None,
            "cidade": "São Paulo",
            "uf": "SP",
            "uge": None,
            "ativo": True,
            "unidade_tipos": [
                {"posicao": 1, "tipo_id": 1, "tipos_estabelecimento": {"nome": "Sede administrativa"}}
            ],
        }
    ],
    "processos_sei": [
        {
            "id": 1,
            "numero": "024.00120830/2026-12",
            "unidade_id": 1,
            "descricao": "Reforma elétrica",
            "tipo_processo": "Infraestrutura: Manutenção predial",
            "url": "https://sei.sp.gov.br/sei/modulos/pesquisa/md_pesq_processo_exibir.php?x=1",
            "cabecalho": {"Processo": "024.00120830/2026-12", "Interessados": "Núcleo de Infraestrutura"},
            "documentos": [{"Documento / Processo": "12345678", "Tipo de Documento": "Ofício"}],
            "andamentos": [
                {"Data/Hora": "05/03/2026 14:10", "Unidade": "PRODESP-NIE", "Descrição": "Processo recebido"},
                {"Data/Hora": "02/03/2026 09:00", "Unidade": "PRODESP-GAB", "Descrição": "Processo remetido"},
            ],
            "consultado_em": "2026-10-15T12:00:00+00:00",
            "unidades": {"nome": "Sede"},
        },
        {
            "id": 2,
            "numero": "024.00000001/2026-01",
            "unidade_id": None,
            "descricao": None,
            "tipo_processo": None,
            "url": None,
            "cabecalho": {},
            "documentos": [],
            "andamentos": [],
            "consultado_em": None,
            "unidades": None,
        },
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


def _jwt(usuario: dict) -> str:
    def parte(dados: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(dados).encode()).decode().rstrip("=")

    agora = int(time.time())
    carga = {"sub": usuario["id"], "email": usuario["email"], "role": "authenticated",
             "aud": "authenticated", "iat": agora, "exp": agora + 3600}
    return f"{parte({'alg': 'HS256', 'typ': 'JWT'})}.{parte(carga)}.assinatura"


class SupabaseFalso:
    """Responde às rotas de auth e REST usadas pelo site e registra as gravações."""

    def __init__(self):
        self.gravacoes: list[tuple[str, str, object]] = []

    def responder(self, route):
        req = route.request
        url = urlparse(req.url)
        if url.path == "/auth/v1/token":
            return self._login(route, json.loads(req.post_data or "{}"))
        if url.path == "/auth/v1/logout":
            return route.fulfill(status=204)
        if url.path.startswith("/rest/v1/"):
            return self._rest(route, url.path.removeprefix("/rest/v1/"), parse_qs(url.query))
        return route.fulfill(status=404, json={"message": "rota não simulada"})

    def _login(self, route, corpo):
        usuario = next((p for p in DADOS["perfis"] if p["email"] == corpo.get("email")), None)
        if usuario is None or corpo.get("password") != SENHA:
            return route.fulfill(
                status=400,
                json={"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"},
            )
        return route.fulfill(json={
            "access_token": _jwt(usuario), "token_type": "bearer", "expires_in": 3600,
            "expires_at": int(time.time()) + 3600, "refresh_token": "refresh",
            "user": {"id": usuario["id"], "aud": "authenticated", "role": "authenticated",
                     "email": usuario["email"], "app_metadata": {}, "user_metadata": {},
                     "created_at": "2026-01-01T00:00:00Z"},
        })

    def _rest(self, route, tabela, consulta):
        req = route.request
        if req.method != "GET":
            corpo = json.loads(req.post_data) if req.post_data else None
            self.gravacoes.append((req.method, tabela, corpo))
            if tabela.startswith("rpc/"):  # funções do banco (ex.: salvar_unidade)
                return route.fulfill(json=1)
            if req.method == "POST":
                return route.fulfill(status=201, body="")
            return route.fulfill(json=[{"id": 1}])
        linhas = copy.deepcopy(DADOS[tabela])
        if "id" in consulta and consulta["id"][0].startswith("eq."):
            linhas = [linha for linha in linhas if str(linha["id"]) == consulta["id"][0][3:]]
        if "vnd.pgrst.object" in req.headers.get("accept", ""):
            return route.fulfill(json=linhas[0]) if linhas else route.fulfill(
                status=406, json={"code": "PGRST116", "message": "0 rows"})
        return route.fulfill(json=linhas)


class _Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def site():
    servidor = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Silencioso, directory=WEB))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{servidor.server_port}"
    servidor.shutdown()


@pytest.fixture(scope="session")
def navegador():
    with sync_playwright() as p:
        # Localmente pode usar o Edge/Chrome instalado: PW_CANAL=msedge
        b = p.chromium.launch(channel=os.environ.get("PW_CANAL") or None)
        yield b
        b.close()


@pytest.fixture
def supabase():
    return SupabaseFalso()


@pytest.fixture
def pagina(navegador, site, supabase):
    contexto = navegador.new_context(viewport={"width": 1280, "height": 900})
    pg = contexto.new_page()
    pg.erros = []
    pg.on("pageerror", lambda erro: pg.erros.append(str(erro)))
    pg.route(f"{SUPABASE_TESTE}/**", supabase.responder)
    pg.route("**/js/config.js", lambda route: route.fulfill(
        content_type="text/javascript",
        body=f'export const SUPABASE_URL = "{SUPABASE_TESTE}";\nexport const SUPABASE_ANON_KEY = "anon";\n',
    ))
    pg.goto(site)
    yield pg
    assert pg.erros == [], f"erros de JavaScript na página: {pg.erros}"
    contexto.close()


def entrar(pg, usuario: dict, senha: str = SENHA) -> None:
    pg.get_by_label("E-mail").fill(usuario["email"])
    pg.get_by_label("Senha").fill(senha)
    pg.get_by_role("button", name="Entrar").click()
