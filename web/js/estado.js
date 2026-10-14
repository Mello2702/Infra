// Usuário logado (perfil da tabela perfis), compartilhado entre as páginas.
export const sessao = { usuario: null };

export const temPapel = (...papeis) => sessao.usuario !== null && papeis.includes(sessao.usuario.papel);
