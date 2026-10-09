"""Acesso às tabelas do Supabase."""

from postgrest.exceptions import APIError

from core.supabase_client import cliente

# Limite padrão de linhas por requisição da API do Supabase.
PAGINA = 1000

_MENSAGENS = {
    "23505": "Já existe um registro com esse valor (nome ou patrimônio duplicado).",
    "23503": "Este registro está vinculado a outros cadastros e não pode ser excluído.",
    "23514": "Valor inválido para um dos campos.",
    "42501": "Você não tem permissão para essa operação.",
}


class ErroDados(Exception):
    """Falha ao ler ou gravar, com mensagem pronta para mostrar ao usuário."""


def _executar(consulta) -> list[dict]:
    try:
        return consulta.execute().data
    except APIError as erro:
        mensagem = _MENSAGENS.get(erro.code, f"Erro no banco de dados: {erro.message}")
        raise ErroDados(mensagem) from erro
    except Exception as erro:
        raise ErroDados("Não foi possível conectar ao Supabase. Tente novamente.") from erro


def _listar(tabela: str, colunas: str, ordem: str, desc: bool = False) -> list[dict]:
    linhas: list[dict] = []
    while True:
        lote = _executar(
            cliente()
            .table(tabela)
            .select(colunas)
            .order(ordem, desc=desc)
            .order("id")
            .range(len(linhas), len(linhas) + PAGINA - 1)
        )
        linhas.extend(lote)
        if len(lote) < PAGINA:
            return linhas


def _achatar(linhas: list[dict], relacao: str, destino: str) -> None:
    """Troca o objeto aninhado da relação (ex.: unidades) pela coluna com o nome."""
    for linha in linhas:
        linha[destino] = (linha.pop(relacao, None) or {}).get("nome")


def listar_unidades(apenas_ativas: bool = False) -> list[dict]:
    unidades = _listar("unidades", "*", "nome")
    return [u for u in unidades if u["ativo"]] if apenas_ativas else unidades


def listar_perfis() -> list[dict]:
    return _listar("perfis", "id, nome, email, papel, ativo", "nome")


def listar_equipamentos() -> list[dict]:
    linhas = _listar("equipamentos", "*, unidades(nome)", "tipo")
    _achatar(linhas, "unidades", "unidade")
    return linhas


def listar_visitas() -> list[dict]:
    linhas = _listar("visitas", "*, unidades(nome), perfis(nome)", "data_visita", desc=True)
    _achatar(linhas, "unidades", "unidade")
    _achatar(linhas, "perfis", "tecnico")
    return linhas


def inserir(tabela: str, valores: dict) -> None:
    _executar(cliente().table(tabela).insert(valores))


def atualizar(tabela: str, id_registro, valores: dict) -> None:
    # Quando a RLS barra uma alteração, a API não dá erro: só não devolve linha nenhuma.
    if not _executar(cliente().table(tabela).update(valores).eq("id", id_registro)):
        raise ErroDados(_MENSAGENS["42501"])


def excluir(tabela: str, id_registro) -> None:
    if not _executar(cliente().table(tabela).delete().eq("id", id_registro)):
        raise ErroDados(_MENSAGENS["42501"])
