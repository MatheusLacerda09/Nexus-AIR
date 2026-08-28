# Nexus Air

Dashboard de monitoramento de infraestrutura (VM Oracle Linux) com login,
cadastro de usuários (CRUD completo) e uma API de consultas/procedures,
tudo em **um único backend Flask**.

> ### 🔧 Sobre a mudança de arquitetura
> Anteriormente o projeto rodava **dois servidores** (Flask + Node.js), o
> segundo existindo só para servir o HTML/CSS/JS e ler dados reais de CPU
> da máquina. Isso duplicava responsabilidades sem necessidade técnica real.
> A coleta de CPU/uptime, que só era possível em Node, passou a ser feita em
> Python com a biblioteca [`psutil`](https://pypi.org/project/psutil/)
> (`backend/services/sistema_service.py`), então **todo o sistema roda agora
> em um único servidor Flask**: uma API, um banco, uma arquitetura.

## 📌 Funcionalidades Implementadas

Cada item abaixo é uma **funcionalidade completa**, no sentido exigido pela
disciplina: possui uma tela que o usuário realmente usa, essa tela consome
uma rota da API Flask, que passa por Controller (classe) → Service → Model
e/ou Repository → Banco de Dados (MySQL). Nenhuma delas é só uma tela solta,
uma rota isolada ou uma função que fala direto com o banco.

1. **Cadastrar usuário (signup)** — tela `cadastro.html` → `POST /api/auth/cadastro`
   → `AuthController` → `UsuarioService.cadastrar` → `UsuarioModel` (hash de
   senha) → `UsuarioRepository` → tabela `usuario`.
2. **Login** — tela `login.html` → `POST /api/auth/login` → `AuthController`
   → `UsuarioService.autenticar` → `UsuarioModel.buscar_por_email` →
   `UsuarioRepository` → tabela `usuario`.
3. **Ver usuário logado (sessão ativa)** — cabeçalho do dashboard (nome/e-mail
   do usuário) → `GET /api/auth/me` → `AuthController.usuario_logado` →
   `UsuarioService.obter` → `UsuarioModel.buscar_por_id` → tabela `usuario`.
4. **Listar usuários** — aba `Usuários` do menu lateral → `GET /api/usuarios`
   → `UsuarioController` (MethodView) → `UsuarioService.listar` →
   `UsuarioModel.listar_todos` → `UsuarioRepository` → tabela `usuario`.
5. **Criar usuário (administração)** — botão `+ Novo Usuário` → `POST /api/usuarios`
   → `UsuarioController` → `UsuarioService.cadastrar` → `UsuarioModel` →
   `UsuarioRepository` → tabela `usuario`.
6. **Atualizar usuário** — modal de edição na aba `Usuários` → `PUT /api/usuarios/<id>`
   → `UsuarioController` → `UsuarioService.atualizar` → `UsuarioModel` →
   `UsuarioRepository` → tabela `usuario`.
7. **Excluir usuário** — botão 🗑️ na aba `Usuários` → `DELETE /api/usuarios/<id>`
   → `UsuarioController` → `UsuarioService.remover` → `UsuarioModel` →
   `UsuarioRepository` → tabela `usuario`.
8. **Dashboard de alertas** — aba `Dashboard`, painel "Central de Alertas" →
   `GET /api/alertas/dashboard` → `AlertaController.dashboard` →
   `DashboardService.executar` → `AlertaRepository` (`CALL
   sp_obter_alertas_detalhados`) → tabelas `alerta`, `maquinas_virtuais`,
   `banco`.
9. **Análise de máquinas em consumo crítico de CPU** — mesma aba `Dashboard`,
   lista de máquinas críticas → `GET /api/alertas/dashboard?cpu_limite=` →
   `AlertaController.dashboard` → `DashboardService.executar` →
   `AlertaRepository` (`CALL sp_maquinas_alto_consumo`) → tabela
   `maquinas_virtuais` (com `GROUP BY`/`JOIN` em `alerta`).
10. **Relatório de resolução de suporte** — aba `Relatórios` (tabela +
    filtro por ID do agente de suporte) → `GET /api/alertas/relatorio-suporte`
    → `AlertaController.relatorio_suporte` → `RelatorioSuporteService.executar`
    → `AlertaRepository` (`CALL sp_relatorio_resolucao_suporte`) → tabelas
    `relatorio_alerta`, `usuario_suporte`, `maquinas_virtuais`.

### Funcionalidades extras (fora da contagem das 10)
- **Logout**: só encerra a sessão (`session.pop`), não passa por
  Service/Model/Repository, então não conta como funcionalidade completa
  pelo critério do enunciado — mas continua disponível na interface.
- **Status de CPU/RAM/uptime em tempo real** (`GET /api/sistema/status`,
  via `psutil`): tem tela e API, mas não passa por Model/Repository/Banco
  de Dados (lê dados ao vivo da máquina, não dado persistido), então também
  fica de fora da contagem das 10 — é um extra do dashboard, não uma das
  funcionalidades exigidas.

## 🏗️ Arquitetura em Camadas

O backend segue a arquitetura trabalhada em aula, com todas as camadas
implementadas de forma consistente para cada funcionalidade:

```
Controller  →  Service  →  Model  →  Repository  →  Banco de Dados
(HTTP/rotas)  (regras de   (entidade,   (SQL puro,
              negócio)      métodos      parametrizado)
                            CRUD)
```

- **Controllers** (`backend/controllers/`): classes responsáveis somente
  por traduzir HTTP ↔ Service (nunca contêm SQL nem regra de negócio).
  `UsuarioController` usa `flask.views.MethodView` (o padrão de classes do
  próprio Flask); `AuthController`, `AlertaController` e `SistemaController`
  também são classes, registradas via Blueprints.
- **Services** (`backend/services/`): regras de negócio — validação de
  e-mail/senha, verificação de duplicidade, orquestração de múltiplos
  repositórios (`UsuarioService`, `DashboardService`,
  `RelatorioSuporteService`, `SistemaService`).
- **Models** (`backend/models/`): entidades com métodos de CRUD
  (`salvar`, `excluir`, `buscar_por_id`, `buscar_por_email`,
  `listar_todos`), representação (`to_dict`) e, no caso do usuário,
  hashing de senha. O Model nunca escreve SQL: delega ao Repository.
- **Repositories** (`backend/repositories/`): única camada que fala SQL
  com o banco, sempre com queries parametrizadas.

```
backend/
  app.py                      # cria o Flask, registra blueprints, serve o frontend
  config.py                   # variáveis de ambiente centralizadas
  erros.py                    # exceções de domínio (ErroDeValidacao, NaoAutenticado, NaoEncontrado)
  seguranca.py                # decorator @login_obrigatorio (sessão)
  database/__init__.py        # conexão MySQL
  controllers/
    auth_controller.py        # /api/auth/... (cadastro, login, logout, me)
    usuario_controller.py     # /api/usuarios (CRUD, MethodView)
    alerta_controller.py      # /api/alertas/... (dashboard, relatório de suporte)
    sistema_controller.py     # /api/sistema/status (CPU/uptime via psutil)
  services/
    usuario_service.py
    dashboard_service.py
    relatorio_suporte_service.py
    sistema_service.py
  models/
    usuario_model.py          # CRUD + hash de senha
    alerta_model.py, banco_model.py, maquina_virtual_model.py, empresa_model.py
  repositories/
    usuario_repository.py
    alerta_repository.py      # centraliza chamadas de `CALL procedure`
  database/banco.sql
  procedures/procedures_banco.sql

frontend/
  index.html                  # dashboard (protegido por login)
  login.html
  cadastro.html
  css/style.css
  js/script.js                # lógica do dashboard + CRUD de usuários
  js/auth.js                  # lógica de login/cadastro
  assets/logo.png
```

## 🗄️ Stored Procedures Utilizadas
- `sp_obter_alertas_detalhados(p_tipo_alerta)`: realiza JOIN entre `alerta`, `maquinas_virtuais` e `banco`.
- `sp_relatorio_resolucao_suporte(p_id_suporte)`: realiza JOIN entre `relatorio_alerta`, `usuario_suporte` e `maquinas_virtuais`.
- `sp_maquinas_alto_consumo(p_cpu_limite)`: agrupa (`GROUP BY`) os alertas por máquina filtrando por consumo de CPU (`WHERE`).

## 🌐 Rotas da API

| Método | Rota | Descrição | Autenticação |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/cadastro` | Cria uma conta (signup) | — |
| `POST` | `/api/auth/login` | Autentica e inicia sessão | — |
| `POST` | `/api/auth/logout` | Encerra a sessão | — |
| `GET`  | `/api/auth/me` | Retorna o usuário logado | Sim |
| `GET`  | `/api/usuarios` | Lista todos os usuários | Sim |
| `GET`  | `/api/usuarios/<id>` | Busca um usuário | Sim |
| `POST` | `/api/usuarios` | Cria um usuário | Sim |
| `PUT`  | `/api/usuarios/<id>` | Atualiza um usuário | Sim |
| `DELETE` | `/api/usuarios/<id>` | Remove um usuário | Sim |
| `GET`  | `/api/alertas/dashboard` | Painel geral de alertas e máquinas críticas (`tipo`, `cpu_limite`) | Sim |
| `GET`  | `/api/alertas/relatorio-suporte` | Histórico de suporte (`id_suporte`) | Sim |
| `GET`  | `/api/sistema/status` | Núcleos, velocidade, uso/livre de CPU e uptime reais | Sim |

## 🚀 Guia Passo a Passo — Como Rodar o Projeto do Zero

Este guia assume que você acabou de baixar/clonar o projeto e não tem
nada configurado ainda.

### Passo 1 — Pré-requisitos
Antes de começar, tenha instalado na sua máquina:
- **Python 3.10+** (`python --version` para conferir)
- **WampServer** (para conexão com o MYSQL WORKBENCH)
- **MySQL** (servidor rodando localmente ou acessível na rede)
- **pip** (já vem com o Python)

### Passo 2 — Criar o banco de dados

Escolha uma das duas opções abaixo — o resultado final é o mesmo.

#### Opção A — MySQL Workbench (interface gráfica)

1. Abra o **MySQL Workbench** e crie/abra uma conexão com o seu servidor
   MySQL local (ícone `+` ao lado de "MySQL Connections"). Exemplo de
   configuração da conexão:

   ```
   Connection Name: Nexus Air (local)
   Hostname:        127.0.0.1
   Port:             3306
   Username:         root
   ```

2. Conecte-se (duplo clique na conexão) e abra o script do banco:
   **File → Open SQL Script...** → selecione `backend/database/banco.sql`.
3. Execute o script inteiro clicando no ícone de raio ⚡ (ou `Ctrl+Shift+Enter`).
   Isso cria o banco `nexus_air` e todas as tabelas.
4. Repita o processo para as *stored procedures*: **File → Open SQL Script...**
   → `backend/procedures/procedures_banco.sql` → execute com ⚡.
   O Workbench já entende o `DELIMITER $$` usado no arquivo, sem precisar
   de nenhum ajuste.
5. No painel **Navigator**, aba **Schemas**, clique com o botão direito e
   em **Refresh All** para conferir se o banco `nexus_air` apareceu, com:
   - Tables: `usuario`, `alerta`, `maquinas_virtuais`, `banco`,
     `relatorio_alerta`, `usuario_suporte`
   - Stored Procedures: `sp_obter_alertas_detalhados`,
     `sp_relatorio_resolucao_suporte`, `sp_maquinas_alto_consumo`

6. (Opcional) Para validar rapidamente pelo próprio Workbench, abra uma
   nova aba de query (ícone de folha com `+`) e rode:
   ```sql
   USE nexus_air;
   SHOW TABLES;
   SHOW PROCEDURE STATUS WHERE Db = 'nexus_air';
   ```

#### Opção B — Terminal

Com o MySQL rodando, execute na raiz do projeto:
```bash
mysql -u root -p < backend/database/banco.sql
mysql -u root -p nexus_air < backend/procedures/procedures_banco.sql
```
O primeiro comando cria o banco `nexus_air` e as tabelas; o segundo cria
as *stored procedures* usadas pelo dashboard e pelos relatórios.

> ⚠️ Se você já tinha o banco criado com uma versão antiga do schema,
> apague e recrie a tabela `usuario` (pelo Workbench: botão direito na
> tabela → **Drop Table**, ou rode `DROP DATABASE nexus_air;` e refaça os
> passos acima) para garantir que as colunas usadas pelo login existam.

### Passo 3 — Configurar as variáveis de ambiente
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
Abra o `.env` e ajuste:
- `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT`: as mesmas credenciais
  usadas na conexão do MySQL Workbench (Passo 2, Opção A) — ex.: se você
  conectou com `Hostname: 127.0.0.1`, `Port: 3306`, `Username: root`, use
  esses mesmos valores aqui.
- `SECRET_KEY`: troque pelo um valor aleatório e secreto — é o que assina
  o cookie de sessão do login. Nunca use o valor de exemplo em produção.

### Passo 4 — Instalar as dependências
Na raiz do projeto:
```bash
pip install -r requirements.txt
```
(Se preferir isolar o ambiente, crie antes um virtualenv com
`python -m venv venv` e ative-o antes deste comando.)

### Passo 5 — Rodar o servidor
```bash
cd backend
python app.py
```
Se tudo estiver certo, o terminal vai mostrar que o Flask subiu em
`http://localhost:5000` (ou na porta definida em `FLASK_PORT`).
API e front-end rodam **juntos**, no mesmo servidor — não há mais
`npm install` / `npm start`, o servidor Node.js foi removido.

### Passo 6 — Criar sua conta e entrar
1. Acesse `http://localhost:5000/cadastro` e crie seu primeiro usuário.
2. Você já entra logado automaticamente após o cadastro.
3. Nas próximas vezes, acesse `http://localhost:5000/login` para entrar
   com e-mail e senha.
4. O dashboard fica em `http://localhost:5000/` (protegido: se você não
   estiver logado, é redirecionado para `/login` automaticamente).

### Passo 7 — Testar a API (opcional)
```bash
curl http://localhost:5000/api
# {"status": "online", "servico": "Nexus Air API"}
```

### 🔑 Mensagens de erro do login
O endpoint `POST /api/auth/login` agora diferencia os dois motivos de
falha, para facilitar o diagnóstico durante o desenvolvimento/uso:

| Situação | Mensagem retornada |
| :--- | :--- |
| E-mail não cadastrado | `Usuario incorreto.` |
| E-mail existe, senha não confere | `Senha incorreta.` |

Essa lógica está em `backend/services/usuario_service.py`, no método
`autenticar()`. O front-end (`frontend/js/auth.js`) apenas exibe a
mensagem que a API devolver, então basta ajustar o texto no back-end
para mudar o que aparece na tela.

> ℹ️ **Nota de segurança**: mensagens separadas são ótimas para
> desenvolvimento e uso interno, mas em um sistema público exposto na
> internet elas permitem que alguém descubra, por tentativa e erro,
> quais e-mails estão cadastrados (enumeração de usuários). Se este
> projeto for para produção/público, considere voltar para uma mensagem
> genérica como `E-mail ou senha invalidos.`.

## 🖥️ Front-end
- `frontend/index.html`: dashboard (protegido — redireciona para `/login`
  se não houver sessão ativa) com a nova aba **Usuários**, onde o CRUD é
  demonstrado na prática (criar, editar e excluir usuários).
- `frontend/login.html` / `frontend/cadastro.html`: telas de autenticação.
- `frontend/css/style.css`: estilos, fonte Oswald, animações e os novos
  componentes (formulários, modal, dropdown do usuário).
- `frontend/js/script.js`: lógica do dashboard (tabela de processos,
  notificações, gráficos em canvas, CPU real) e do CRUD de usuários.
- `frontend/js/auth.js`: lógica das telas de login/cadastro.
