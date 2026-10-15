-- Remove a tabela processos_sei: a funcionalidade Processos SEI foi retirada
-- do sistema (commit 54a6e18). Apagada com o único registro de teste
-- (processo 024.00120830/2026-12, sem dados do SEI), por decisão do usuário.
-- Nada mais depende dela; as políticas, o índice e o gatilho saem junto.

drop table if exists public.processos_sei;
