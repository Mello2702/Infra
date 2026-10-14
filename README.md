# Sistema de Gestão — Núcleo de Infraestrutura

Site do Núcleo de Infraestrutura (marca **nie**), com banco de dados e login no Supabase,
código no GitHub e publicação gratuita na Cloudflare.

O site é estático (HTML, CSS e JavaScript, sem etapa de build): roda no navegador e fala direto
com o Supabase. Quem decide o que cada pessoa pode ver ou alterar são as regras de RLS do banco.

## O que o sistema faz

- **Painel** — totais do inventário, visitas agendadas, atrasadas e pendências.
- **Equipamentos** — inventário com patrimônio, tipo, marca/modelo, nº de série, unidade,
  localização e status; busca, filtros e exportação em CSV.
- **Visitas** — agendamento e registro de visitas às unidades, com objetivo, relato e pendências.
- **Unidades** — cadastro das unidades atendidas.
- **Usuários** — definição do papel de cada pessoa (somente administradores).
- **Minha conta** — dados do usuário e troca de senha.

### Papéis

| Ação | Técnico | Gestor | Administrador |
| --- | :---: | :---: | :---: |
| Consultar tudo | ✔ | ✔ | ✔ |
| Cadastrar e editar equipamentos | ✔ | ✔ | ✔ |
| Registrar e editar as próprias visitas | ✔ | ✔ | ✔ |
| Editar visitas de outros técnicos | | ✔ | ✔ |
| Excluir equipamentos e visitas | | ✔ | ✔ |
| Cadastrar e editar unidades | | ✔ | ✔ |
| Excluir unidades e gerenciar usuários | | | ✔ |

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `web/index.html` | Página única do site |
| `web/js/app.js` | Login, menu e navegação (rotas com `#`) |
| `web/js/paginas/` | Uma página do sistema por arquivo |
| `web/js/dados.js` | Leitura e gravação nas tabelas do Supabase |
| `web/js/config.js` | URL e chave `anon` do projeto Supabase |
| `web/css/estilo.css` | Visual nie (paleta e fontes em `web/assets/README.md`) |
| `supabase/migrations/` | Schema do banco e regras de acesso (RLS) |
| `worker/index.js`, `wrangler.jsonc` | Publicação na Cloudflare |
| `tests/` | Testes do site num navegador real, com Supabase simulado |

## Supabase

1. Aplique o schema com `supabase link --project-ref <id>` e `supabase db push`, ou cole
   [o SQL da migration](supabase/migrations/20261009120000_schema_inicial.sql) no SQL Editor.
2. Em **Authentication → Sign In / Providers**, mantenha desativado *Allow new users to sign up*.
3. Crie usuários em **Authentication → Users → Add user** (com *Auto Confirm User*).
   **O primeiro usuário criado vira administrador**; os seguintes entram como Técnico e o papel
   é ajustado na página *Usuários*.

A chave em `web/js/config.js` é a `anon`/`publishable`, feita para ficar no navegador. Nunca use
ali a `service_role`.

Para alterar o banco, crie uma migration nova com `supabase migration new <nome>`; o workflow
[migrations.yml](.github/workflows/migrations.yml) a aplica quando chega à `main` (secrets
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` e `SUPABASE_DB_PASSWORD`).

## Publicação na Cloudflare (plano gratuito)

O Worker `nie-infra` só entrega os arquivos de `web/`. Ele está ligado ao repositório pelo
**Workers Builds**: cada push na `main` publica de novo. Configuração do build no painel da
Cloudflare (**Workers & Pages → nie-infra → Settings → Builds**):

- Build command: `npm install`
- Deploy command: `npx wrangler deploy`

## Rodar localmente

Não precisa de instalação: sirva a pasta `web/` e abra no navegador.

```powershell
python -m http.server 8000 --directory web
# abra http://localhost:8000
```

## Testes

```powershell
pip install -r requirements-dev.txt
python -m playwright install chromium
ruff check .
pytest
```

Para usar o Edge já instalado em vez de baixar o Chromium: `$env:PW_CANAL = "msedge"`.
