# Sistema de Gestão — Núcleo de Infraestrutura

Aplicação web em Python (Streamlit) para o Núcleo de Infraestrutura, com banco de dados
e autenticação no Supabase e integração contínua no GitHub.

## O que o sistema faz

- **Painel** — totais do inventário, visitas agendadas, atrasadas e pendências.
- **Equipamentos** — inventário com patrimônio, tipo, marca/modelo, nº de série, unidade,
  localização e status; busca, filtros e exportação em CSV.
- **Visitas** — agendamento e registro de visitas às unidades, com objetivo, relato e pendências.
- **Unidades** — cadastro das unidades atendidas.
- **Usuários** — definição do papel de cada pessoa (somente administradores).

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

Essas regras são aplicadas no próprio banco (RLS), não só na tela.

## Configuração inicial

### 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard>.
2. Aplique o schema, de uma destas formas:
   - **CLI:** `supabase login`, depois `supabase link --project-ref <id-do-projeto>` e
     `supabase db push`;
   - **Painel:** cole o conteúdo de
     [supabase/migrations/20261009120000_schema_inicial.sql](supabase/migrations/20261009120000_schema_inicial.sql)
     no SQL Editor e execute.
3. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**,
   para que só entrem pessoas cadastradas por você.
4. Em **Authentication → Users → Add user**, crie o seu usuário (marque *Auto Confirm User*).
   **O primeiro usuário criado vira administrador**; os seguintes entram como Técnico e o
   papel é ajustado na página *Usuários* do sistema.

### 2. Rodar localmente

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .streamlit\secrets.toml.example .streamlit\secrets.toml
# edite .streamlit\secrets.toml com a URL e a chave anon do projeto
streamlit run app.py
```

A URL e a chave ficam em **Project Settings → API** no Supabase. Use a chave
`anon`/`publishable` — nunca a `service_role`.

### 3. GitHub

```powershell
git add .
git commit -m "Versão inicial"
git remote add origin https://github.com/<organizacao>/<repositorio>.git
git push -u origin main
```

Dois workflows rodam no GitHub Actions:

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — `ruff` e `pytest` a cada push e
  pull request.
- **Migrations** ([.github/workflows/migrations.yml](.github/workflows/migrations.yml)) — aplica
  no Supabase as migrations novas que chegam à `main`. Requer estes *secrets* do repositório
  (**Settings → Secrets and variables → Actions**):

  | Secret | Onde obter |
  | --- | --- |
  | `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> |
  | `SUPABASE_PROJECT_ID` | Project Settings → General → Project ID |
  | `SUPABASE_DB_PASSWORD` | Senha do banco definida ao criar o projeto |

### 4. Publicar (opcional)

No [Streamlit Community Cloud](https://share.streamlit.io), aponte para o repositório, arquivo
`app.py`, e cole o conteúdo do seu `secrets.toml` em **Advanced settings → Secrets**.

## Desenvolvimento

```powershell
ruff check .
pytest
```

Os testes usam um cliente Supabase falso e não acessam a rede.

| Pasta | Conteúdo |
| --- | --- |
| `app.py` | Ponto de entrada: login, menu e navegação |
| `views/` | Uma página por arquivo |
| `core/` | Cliente Supabase, autenticação, acesso a dados e utilitários de tela |
| `supabase/migrations/` | Schema do banco e regras de acesso (RLS) |
| `tests/` | Testes das páginas |

Para alterar o banco, crie uma migration nova com `supabase migration new <nome>` em vez de
editar uma já aplicada.
