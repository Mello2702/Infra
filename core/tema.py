"""Identidade visual "nie": tela de fundo e marca, aplicadas por CSS.

As cores e fontes base ficam no tema de .streamlit/config.toml; aqui entra só o
que o tema não cobre (imagem de fundo, marca e alguns ajustes de contraste).
"""

import base64
from pathlib import Path

import streamlit as st

ASSETS = Path(__file__).parent.parent / "src" / "assets"

# Só a grade do fundo, para as páginas internas (o gráfico competiria com as tabelas).
_GRADE = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">'
    '<path d="M48 0H0V48" fill="none" stroke="#162235" stroke-width="1"/></svg>'
)

_BASE = """
header[data-testid="stHeader"] { background: transparent; }
/* Texto escuro sobre o laranja de destaque, para ter contraste. */
button[kind="primary"], button[kind="primaryFormSubmit"] { color: #0D1624; font-weight: 600; }

.nie-marca { display: flex; flex-direction: column; gap: 12px; }
.nie-logo { display: flex; align-items: flex-end; gap: 10px; }
.nie-logo__texto {
  font-family: "Sora", sans-serif; font-weight: 700; color: #F2F5F9;
  font-size: 96px; line-height: 0.9; letter-spacing: -4px;
}
.nie-logo__ponto {
  width: 18px; height: 18px; border-radius: 4px; margin-bottom: 10px; background: #F2A541;
}
.nie-subtitulo {
  margin: 0; font-family: "Manrope", sans-serif; font-weight: 600; color: #8FA1B8;
  font-size: 16px; letter-spacing: 5px; text-transform: uppercase;
}
.nie-marca--pequena { gap: 6px; margin-bottom: 8px; }
.nie-marca--pequena .nie-logo__texto { font-size: 40px; letter-spacing: -1.5px; }
.nie-marca--pequena .nie-logo__ponto {
  width: 8px; height: 8px; margin-bottom: 5px; border-radius: 2px;
}
.nie-marca--pequena .nie-subtitulo { font-size: 10px; letter-spacing: 3px; }
"""


def _data_uri(svg: bytes) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg).decode()


def _imagem(nome: str) -> str:
    """URL do SVG de fundo, ou 'none' se o arquivo não estiver no projeto."""
    try:
        return f'url("{_data_uri((ASSETS / nome).read_bytes())}")'
    except FileNotFoundError:
        return "none"


def _css(regras: str) -> None:
    st.html(f"<style>{_BASE}{regras}</style>")


def marca(pequena: bool = False) -> None:
    classe = "nie-marca nie-marca--pequena" if pequena else "nie-marca"
    st.html(
        f'<div class="{classe}">'
        '<div class="nie-logo"><span class="nie-logo__texto">nie</span>'
        '<span class="nie-logo__ponto" aria-hidden="true"></span></div>'
        '<p class="nie-subtitulo">Sistema de Gestão</p></div>'
    )


def fundo_login() -> None:
    """Tela de fundo completa (grade + gráfico), com o conteúdo à esquerda."""
    _css(f"""
    [data-testid="stApp"] {{
      background: #0D1624 {_imagem("nie-fundo-desktop.svg")} right center / cover no-repeat;
    }}
    [data-testid="stMainBlockContainer"] {{ padding-top: 12vh; }}
    [data-testid="stForm"] {{
      background: rgba(13, 22, 36, 0.88); border: 1px solid #2A3B55; border-radius: 12px;
    }}
    @media (max-width: 640px) {{
      [data-testid="stApp"] {{
        background: #0D1624 {_imagem("nie-fundo-mobile.svg")} top center / 100% auto no-repeat;
      }}
      /* No celular o gráfico ocupa o topo; a marca e o login vêm abaixo dele. */
      [data-testid="stMainBlockContainer"] {{ padding-top: 122vw; }}
      .nie-logo__texto {{ font-size: 72px; letter-spacing: -3px; }}
      .nie-logo__ponto {{ width: 14px; height: 14px; margin-bottom: 8px; }}
      .nie-subtitulo {{ font-size: 13px; letter-spacing: 4px; }}
    }}
    """)


def fundo_interno() -> None:
    """Páginas do sistema: apenas a grade, para não atrapalhar a leitura."""
    _css(f"""
    [data-testid="stApp"] {{
      background: #0D1624 url("{_data_uri(_GRADE.encode())}") repeat;
    }}
    """)
