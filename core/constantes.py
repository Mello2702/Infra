"""Listas de valores usadas nos formulários. As chaves dos dicionários são gravadas no banco."""

PAPEIS = {"admin": "Administrador", "gestor": "Gestor", "tecnico": "Técnico"}

STATUS_EQUIPAMENTO = {
    "em_uso": "Em uso",
    "estoque": "Em estoque",
    "manutencao": "Em manutenção",
    "baixado": "Baixado",
}

STATUS_VISITA = {"agendada": "Agendada", "realizada": "Realizada", "cancelada": "Cancelada"}

# Sugestões; o formulário aceita digitar um tipo novo.
TIPOS_EQUIPAMENTO = [
    "Desktop",
    "Notebook",
    "Monitor",
    "Impressora",
    "Switch",
    "Roteador",
    "Access Point",
    "Servidor",
    "Nobreak",
    "Telefone IP",
    "Outro",
]

TIPOS_VISITA = ["Preventiva", "Corretiva", "Instalação", "Vistoria", "Levantamento", "Outro"]
