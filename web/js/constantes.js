// Listas de valores usadas nos formulários. As chaves dos objetos são gravadas no banco.

// Atalhos para sistemas externos, abertos numa aba nova. Cada pessoa entra
// com o próprio login: o sistema nie não recebe nem guarda essas credenciais.
export const ACESSOS_EXTERNOS = [
  { titulo: "Minha Área SP", url: "https://minhaarea.sp.gov.br/" },
  { titulo: "SEI-SP", url: "https://sei.sp.gov.br/sei/" },
];

export const PAPEIS ={ admin: "Administrador", gestor: "Gestor", tecnico: "Técnico" };

export const STATUS_EQUIPAMENTO = {
  em_uso: "Em uso",
  estoque: "Em estoque",
  manutencao: "Em manutenção",
  baixado: "Baixado",
};

export const STATUS_VISITA = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" };

// Sugestões; o formulário aceita digitar um tipo novo.
export const TIPOS_EQUIPAMENTO = [
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
];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const TIPOS_VISITA =["Preventiva", "Corretiva", "Instalação", "Vistoria", "Levantamento", "Outro"];
