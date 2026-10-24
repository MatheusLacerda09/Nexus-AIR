# 🛸 Nexus Air — Central de Monitoramento & Gestão

> **Solução Full-Stack Unificada para Monitoramento de Infraestrutura em VM Oracle Linux**
>
> *API RESTful, Autenticação de Sessão, Procedures MySQL e Telemetria em Tempo Real reunidos em um único backend Python/Flask.*

---

## 🎨 Apresentação do Projeto

O **Nexus Air** é uma plataforma completa de monitoramento e governança de infraestrutura. Ela integra, em uma única aplicação, o controle de acesso de usuários (CRUD e autenticação), a gestão e emissão de alertas de sistema e a telemetria ao vivo da máquina hospedeira.

### 🔧 Evolução de Arquitetura: Servidor Único

| Antes (Sistemas Duplicados) | Agora (Arquitetura Unificada) |
| :--- | :--- |
| • Backend Flask (API e Regras de Negócio)<br>• Servidor Node.js (Leitura de CPU/Uptime + Front-end)<br>• Duplicação de rotas, portas e complexidade de deploy | • **Servidor Único Flask (Python 3.10+)**<br>• Servimento estático de front-end, API REST e telemetria<br>• Telemetria de CPU/RAM/Uptime nativa via biblioteca `psutil` |

> 🎯 **Resultado**: Redução de complexidade, manutenção simplificada, menor consumo de memória e arquitetura unificada sob o padrão **MVC + Service + Repository**.

---

## 📌 Mapeamento de Funcionalidades Completo

Cada funcionalidade listada cumpre integralmente o ciclo **Tela/UI → Rota HTTP → Controller → Service → Model/Repository → Banco MySQL**:

```
 🖥️ Interface (UI)       🌐 Rota API        🧩 Controller             ⚙️ Service                  🗄️ Model / Repository            💾 Banco de Dados
[ cadastro.html ]  ──>  POST /auth/cadastro ──> AuthController     ──> UsuarioService.cadastrar     ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ login.html ]     ──>  POST /auth/login    ──> AuthController     ──> UsuarioService.autenticar    ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ Header (Me) ]    ──>  GET  /auth/me       ──> AuthController     ──> UsuarioService.obter         ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ Aba Usuários ]   ──>  GET  /usuarios      ──> UsuarioController  ──> UsuarioService.listar        ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ + Novo Usuário ] ──>  POST /usuarios      ──> UsuarioController  ──> UsuarioService.cadastrar     ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ Modal Edição ]   ──>  PUT  /usuarios/<id>  ──> UsuarioController  ──> UsuarioService.atualizar     ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ Botão Excluir ]  ──>  DELETE /usuarios/<id>──> UsuarioController  ──> UsuarioService.remover       ──> UsuarioModel / Repository  ──> Tabela `usuario`
[ Painel Alertas ] ──>  GET  /alertas/dash  ──> AlertaController   ──> DashboardService.executar    ──> AlertaRepository (Procedure) ──> CALL sp_obter_alertas_detalhados
[ Máq. Críticas ]  ──>  GET  /alertas/dash? ──> AlertaController   ──> DashboardService.executar    ──> AlertaRepository (Procedure) ──> CALL sp_maquinas_alto_consumo
[ Rel. Suporte ]   ──>  GET  /alertas/rel   ──> AlertaController   ──> RelatorioSuporteService     ──> AlertaRepository (Procedure) ──> CALL sp_relatorio_resolucao_suporte
```

### 📋 Tabela Detalhada dos 10 Fluxos Principais

| # | Funcionalidade | Endpoint HTTP | Camada Service | Procedimento / Tabela Banco |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Cadastro (Signup)** | `POST /api/auth/cadastro` | `UsuarioService.cadastrar` | Tabela `usuario` (Hash de Senha) |
| **2** | **Autenticação (Login)** | `POST /api/auth/login` | `UsuarioService.autenticar` | Tabela `usuario` |
| **3** | **Sessão Ativa** | `GET /api/auth/me` | `UsuarioService.obter` | Tabela `usuario` |
| **4** | **Listagem de Usuários** | `GET /api/usuarios` | `UsuarioService.listar` | Tabela `usuario` |
| **5** | **Criação de Usuário (Admin)** | `POST /api/usuarios` | `UsuarioService.cadastrar` | Tabela `usuario` |
| **6** | **Atualização de Usuário** | `PUT /api/usuarios/<id>` | `UsuarioService.atualizar` | Tabela `usuario` |
| **7** | **Remoção de Usuário** | `DELETE /api/usuarios/<id>` | `UsuarioService.remover` | Tabela `usuario` |
| **8** | **Dashboard de Alertas** | `GET /api/alertas/dashboard` | `DashboardService.executar` | `CALL sp_obter_alertas_detalhados` |
| **9** | **Análise de CPU Crítica** | `GET /api/alertas/dashboard?cpu_limite=` | `DashboardService.executar` | `CALL sp_maquinas_alto_consumo` |
| **10** | **Relatório de Suporte** | `GET /api/alertas/relatorio-suporte` | `RelatorioSuporteService.executar` | `CALL sp_relatorio_resolucao_suporte` *(depende de dados inseridos manualmente — ver Limitações)* |

> ⚡ **Recursos Adicionais Incluídos**:
> - **Logout de Sessão** (`POST /api/auth/logout`): Encerramento seguro da sessão (`session.pop`).
> - **Telemetria de Hardware** (`GET /api/sistema/status`): Leitura direta de consumo de CPU/RAM e Uptime via `psutil`.

---

## ✅ Funcionalidades Implementadas

Uma funcionalidade só entra nesta lista se o ciclo inteiro existe no código: **tela → rota HTTP → regra de negócio → persistência → resultado visível na tela**. Ter só a tela, ou só a rota, **não conta** (esses casos estão em "Limitações conhecidas", mais abaixo).

**26 funcionalidades**, com o nível de comprovação de cada uma:

| Marca | Significado |
| :-: | :--- |
| ✅ | **Executada** pelo teste automatizado (`tests/verificacao_funcional.py`), com Flask, PDF e e-mail reais |
| ◐ | Executada pelo teste, mas com uma parte **simulada** (SSH, servidor SMTP ou conexão MySQL) |
| 🔎 | **Conferida só lendo o código** (tela, rota, service, repositório e SQL batem entre si), porque depende de MySQL, Zabbix ou Oracle reais, que o teste não tem |

### 📧 Relatórios agendados por e-mail
| # | Funcionalidade | Fluxo | |
| :-: | :--- | :--- | :-: |
| 1 | **Agendamento com 5 frequências** — uma vez, diária, semanal (dias escolhidos), a cada N dias e mensal (dia 31 vira o último dia do mês curto), no fuso `REPORT_TZ`; recusa e-mail inválido e data passada | Aba *Relatórios por e-mail* → `POST /api/agendamentos` → `agendamento_service` → `automation.json` | ✅ |
| 2 | **Prévia das próximas execuções** — mostra as 3 próximas datas antes de salvar | `POST /api/agendamentos/previa` | ✅ |
| 3 | **Pausar, reativar, excluir e "Executar agora"** | `PATCH/DELETE /api/agendamentos/<id>`, `POST …/executar-agora` | ✅ |
| 4 | **Coleta remota por SSH** — o endereço vem do banco cadastrado em Conectores de Dados; roda `relatorio_oracle.sh` (somente leitura) com usuário/senha do banco enviados em base64 pela entrada padrão | `coletor` → SSH → `POST …/coleta` | ◐ SSH simulado |
| 5 | **PDF de monitoramento** montado a partir da saída do script (tabelas, seções escolhidas) | `POST /api/n8n/agendamentos/<id>/pdf` → `relatorio_pdf_service` | ✅ |
| 6 | **Envio por SMTP/Gmail com o PDF anexado** — vários destinatários, assunto com `{instancia}`, `{cliente}`, `{data}` e mensagem personalizada; senha de app com espaços é aceita | `coletor.enviar_email` → `POST …/resultado` | ◐ SMTP local com TLS |
| 7 | **Coletor embutido no Flask** — sobe junto com o servidor e mostra na tela *Coletando → Gerando PDF → Enviado/Falhou* (com o motivo); desligável com `COLETOR_EMBUTIDO=false` | `coletor_embutido` (thread) | ◐ |
| 8 | **Credenciais protegidas** — senha do banco cifrada (Fernet) e nunca devolvida à tela; endpoints do coletor só respondem com `X-API-Key` | `agendamento_service.cifrar_senha`, `n8n_obrigatorio` | ✅ |

### 🔌 Conectores, fluxos e relatórios
| # | Funcionalidade | Fluxo | |
| :-: | :--- | :--- | :-: |
| 9 | **Conectores de fontes de dados** (API, SQL, planilha): cadastrar, listar, validar campos e excluir | Conectores/Orquestrador → `/api/conectores` | ✅ |
| 10 | **Validação de qualidade de dados** — campos obrigatórios, linhas duplicadas e intervalos numéricos | `POST /api/conectores/validar-dados` | ✅ |
| 11 | **Cadastro de fluxos com PDF** — criar, listar, baixar/visualizar o PDF e excluir | Orquestrador → `/api/fluxos`, `/api/fluxos/<id>/pdf` | ✅ |
| 12 | **Relatório PDF personalizado** (título, filtros, dados) com visualização e download | Visualização de Relatórios → `POST /api/relatorios/pdf` | ✅ |
| 13 | **Máquinas e bancos cadastrados** — nome único por empresa, tipo (Linux, Windows, Banco, Outro), edição da instância/SID e exclusão | Conectores de Dados → `/api/maquinas` | ✅ |
| 14 | **Isolamento entre empresas** — máquinas, conectores, fluxos, templates, agendamentos e logs só aparecem para a empresa dona; uma empresa não valida, exclui nem usa dados de outra | `cliente_da_sessao()` em todas as rotas | ✅ |
| 15 | **Telemetria do servidor** — CPU, RAM, núcleos e uptime ao vivo | Dashboard → `GET /api/sistema/status` (`psutil`) | ✅ |
| 16 | **Proteção das rotas por sessão** — sem login, as rotas respondem 401 | `@login_obrigatorio` | ✅ |
| 17 | **Migração automática do esquema** — ao iniciar, cria `tarefa` e `alerta_tarefa` e acrescenta em `alerta` as colunas da Central de Alertas/Zabbix; roda quantas vezes precisar sem repetir nada | `database/migracao.py` | ◐ MySQL simulado |

### 👤 Contas, usuários e perfil (MySQL)
| # | Funcionalidade | Fluxo | |
| :-: | :--- | :--- | :-: |
| 18 | **Cadastro de conta e de empresa (CNPJ)** com verificação de e-mail, nome e CNPJ já em uso | `cadastro.html` → `/api/auth/cadastro`, `/cadastro-empresa`, `/verificar-*` → `UsuarioService` → tabelas `usuario`, `empresa` | 🔎 |
| 19 | **Login, logout e sessão** (senha com hash, cookie `HttpOnly`) | `login.html` → `/api/auth/login`, `/logout`, `/me` | 🔎 |
| 20 | **CRUD de usuários com cargos** — 10 cargos oficiais; só gerente ou superior gerencia usuários | Aba Usuários → `/api/usuarios` | 🔎 |
| 21 | **Perfil do usuário** — dados, troca de senha, foto, idioma (PT/EN) e preferências | Menu do usuário → `/api/auth/meu-perfil`, `/minha-senha`, `/minha-foto`, `/idioma`, `/preferencias` | 🔎 |

### 🚨 Alertas, tarefas e Zabbix (MySQL / Zabbix)
| # | Funcionalidade | Fluxo | |
| :-: | :--- | :--- | :-: |
| 22 | **Dashboard de alertas e máquinas críticas** (filtro por tipo e limite de CPU) | Dashboard → `/api/alertas/dashboard` → `CALL sp_obter_alertas_detalhados` / `sp_maquinas_alto_consumo` | 🔎 |
| 23 | **Central de Alertas** — criar, listar (pendentes/verificados), detalhar e verificar com observação, por empresa | `/api/alertas`, `/api/alertas/<id>/verificar` → tabela `alerta` | 🔎 |
| 24 | **Tarefas com alerta automático** — concluir, interromper ou excluir uma tarefa gera um alerta a verificar | Painel de tarefas → `/api/tarefas` → tabelas `tarefa`, `alerta_tarefa` | 🔎 |
| 25 | **Métricas de máquinas via Zabbix** — validar o host, conectar e desenhar CPU/RAM/uptime no dashboard | `/api/maquinas/<id>/validar`, `/conectar`, `/status` | 🔎 |
| 26 | **Sincronização de alertas com o Zabbix nos dois sentidos** — problema novo vira alerta; alerta verificado aqui é reconhecido lá ([ZABBIX.md](ZABBIX.md)) | `zabbix_sync` (thread) | 🔎 |

> **Resumo:** 17 funcionalidades comprovadas por execução (11 totalmente, 6 com uma parte simulada) e 9 conferidas pelo código. Para elevar as 9 para ✅, rode o sistema com MySQL e Zabbix reais e percorra cada fluxo.

### Como reproduzir a verificação
```bash
python tests/verificacao_funcional.py
```
Roda **45 verificações** sem precisar de MySQL, Oracle nem internet. Os dados ficam numa pasta temporária (o `automation.json` não é alterado). Requer `openssl` no PATH para o servidor SMTP de teste.

### ⚠️ Limitações conhecidas (não contadas acima)
Existem no projeto, mas **não estão completas de ponta a ponta** e por isso não entram na lista de funcionalidades:

- **Executar um fluxo** só marca o fluxo como "concluído" e grava o log; não processa dados nem aplica as regras (a tela nunca preenche as etapas).
- **Validar um conector** confere só os campos obrigatórios; **não testa** a conexão com a URL ou o banco.
- **Templates de relatório** (`/api/templates`) e **prévia** (`/api/relatorios/preview`) têm rota, mas não têm tela.
- **Distribuição e Segurança** e a parte de histórico/log de **Sistema e Governança** guardam os dados no navegador (`localStorage`), não no servidor: não são compartilhados entre usuários nem computadores. Só a lista de usuários dessas telas usa dados reais.
- **Relatório de resolução de suporte** (`sp_relatorio_resolucao_suporte`): a consulta e a tela existem, mas nada no sistema grava em `usuario_suporte` e `relatorio_alerta`; só aparece o que for inserido direto no MySQL.
- **Agendamentos, máquinas, conectores, fluxos e logs** ficam em `backend/data/automation.json` (arquivo local), não no MySQL. No modo "banco único" (seção 3.1) esses dados **não** são compartilhados entre computadores.
- O **script Oracle real** (`relatorio_oracle.sh`) não foi executado num Oracle de verdade; valide as seções no seu banco (veja `RELATORIOS_AGENDADOS.md`).
- A tabela `relatorio` do `banco.sql` não é usada pelo código.

---

## 🏗️ Arquitetura e Estrutura de Camadas

A aplicação adota um padrão arquitetural em **4 camadas bem delimitadas**, garantindo a separação rigorosa de responsabilidades:

```
┌─────────────────────────────────────────────────────────┐
│                     CONTROLLER                          │  • Valida os contratos HTTP (Request/Response)
│         (Ex: usuario_controller.py)                     │  • Mapeia payloads e status códigos
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       SERVICE                           │  • Concentra todas as regras de negócio
│          (Ex: usuario_service.py)                       │  • Executa validações, hashing e orquestração
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                        MODEL                            │  • Modela entidades de domínio e DTOs
│           (Ex: usuario_model.py)                        │  • Realiza conversões para JSON (`to_dict`)
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     REPOSITORY                          │  • Executa a persistência e chamadas ao MySQL
│        (Ex: usuario_repository.py)                      │  • Queries parametrizadas e execução de Stored Procedures
└─────────────────────────────────────────────────────────┘
```

### 📁 Organização de Pastas do Projeto

```
nexus-air/
├── backend/
│   ├── app.py                      # Instanciação do Flask, Blueprints e rotas estáticas
│   ├── config.py                   # Centralização de variáveis de ambiente
│   ├── erros.py                    # Hierarquia de exceções de domínio
│   ├── seguranca.py                # Decorators de autenticação (@login_obrigatorio)
│   ├── database/
│   │   ├── __init__.py             # Gerenciamento de conexões MySQL
│   │   ├── wamp_autostart.py       # Auto-start do MySQL do WampServer ao rodar app.py
│   │   └── banco.sql               # DDL do banco de dados (tabelas)
│   ├── procedures/
│   │   └── procedures_banco.sql    # DDL das Stored Procedures
│   ├── controllers/                # Camada HTTP / Entrypoints de API
│   ├── services/                   # Camada de Regras de Negócio
│   ├── models/                     # Camada de Entidades e Representação
│   └── repositories/               # Camada de Persistência SQL
└── frontend/
    ├── index.html                  # Painel de controle e dashboard
    ├── login.html                  # Tela de login
    ├── cadastro.html               # Tela de cadastro inicial
    ├── css/                        # Estilização
    └── js/                         # Lógica do client-side e integração com API
```

---

## 🗄️ Procedimentos Armazenados (Stored Procedures)

A aplicação delega consultas analíticas complexas e agrupamentos para o MySQL por meio de Stored Procedures otimizadas:

| Procedure | Descrição e Estrutura |
| :--- | :--- |
| `sp_obter_alertas_detalhados(p_tipo_alerta)` | Realiza `JOIN` entre `alerta`, `maquinas_virtuais` e `banco` para retornar diagnósticos completos filtrados por tipo. |
| `sp_relatorio_resolucao_suporte(p_id_suporte)` | Cruza `relatorio_alerta`, `usuario_suporte` e `maquinas_virtuais` para consolidar históricos de suporte por agente. |
| `sp_maquinas_alto_consumo(p_cpu_limite)` | Consolida consumo crítico (`GROUP BY` com `JOIN`), retornando máquinas que excedem o limiar térmico/processamento. |

---

## 🌐 Referência de Rotas da API

Todas as rotas da API possuem prefixo `/api` e retornam respostas no formato JSON:

| Método | Rota | Descrição | Autenticação |
| :-: | :--- | :--- | :-: |
| `POST` | `/api/auth/cadastro` | Registra uma nova conta de usuário | Pública |
| `POST` | `/api/auth/login` | Valida credenciais e inicia sessão | Pública |
| `POST` | `/api/auth/logout` | Encerra a sessão do usuário | Autenticada |
| `GET` | `/api/auth/me` | Retorna dados do usuário logado | Autenticada |
| `GET` | `/api/usuarios` | Lista todos os usuários cadastrados | Autenticada |
| `GET` | `/api/usuarios/<id>` | Busca um usuário específico por ID | Autenticada |
| `POST` | `/api/usuarios` | Cria um novo usuário (Painel Admin) | Autenticada |
| `PUT` | `/api/usuarios/<id>` | Atualiza dados de um usuário existente | Autenticada |
| `DELETE` | `/api/usuarios/<id>` | Remove um usuário do sistema | Autenticada |
| `GET` | `/api/alertas/dashboard` | Retorna dados analíticos do dashboard | Autenticada |
| `GET` | `/api/alertas/relatorio-suporte` | Retorna o histórico de resoluções de suporte | Autenticada |
| `GET` | `/api/sistema/status` | Retorna métricas de hardware ao vivo (`psutil`) | Autenticada |

> 🔒 **Mensagens de Autenticação**: O endpoint `/api/auth/login` retorna respostas específicas (`Usuario incorreto.` ou `Senha incorreta.`) facilitando o desenvolvimento e a identificação do fluxo de acesso.

---

## 🚀 Guia de Instalação e Execução

Siga os passos abaixo para preparar o ambiente local e executar a aplicação.

> ✅ **Novidade**: o MySQL do WampServer agora **sobe sozinho** quando você roda `python app.py` — não é mais preciso abrir o WampServer nem o MySQL manualmente a cada vez. Isso só precisa ser configurado uma vez (Passo 3).

### 1. Pré-requisitos

Certifique-se de possuir em seu ambiente local:
- **Python 3.10+**
- **Servidor MySQL via WampServer** (ex.: `C:\wamp64`) — ou MySQL Workbench/container local, se preferir subir o banco manualmente
- **Pip** (gerenciador de pacotes Python)

---

### 2. Configuração do Banco de Dados

Esse passo só precisa ser feito **uma vez**, para criar a estrutura do banco.

#### Opção A — Utilizando o MySQL Workbench (Interface Gráfica)
1. Conecte-se ao seu servidor MySQL local (`127.0.0.1:3306`).
2. Vá em **File → Open SQL Script...** e abra o arquivo `backend/database/banco.sql`.
3. Clique no ícone de raio ⚡ para executar o script e criar a estrutura de tabelas.
4. Repita a operação para o arquivo `backend/procedures/procedures_banco.sql` para registrar as Stored Procedures.
5. No painel **Schemas**, atualize e confirme a criação do schema `nexus_air`.

#### Opção B — Utilizando a Linha de Comando (Terminal)
Execute os comandos a partir da raiz do projeto:
```bash
mysql -u root -p < backend/database/banco.sql
mysql -u root -p nexus_air < backend/procedures/procedures_banco.sql
```

---

### 3. Configuração de Variáveis de Ambiente

Crie o arquivo de configuração local copiando o modelo:
```bash
cp .env.example .env
```
Abra o arquivo `.env` e configure as credenciais de acesso ao seu banco de dados:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=nexus_air
SECRET_KEY=sua_chave_secreta_para_sessoes

# Pasta onde o WampServer está instalado — usada para subir o MySQL
# automaticamente quando você roda "python app.py"
WAMP_PATH=C:\wamp64
```

> 💡 Se o seu WampServer estiver instalado em outra pasta (ex.: `D:\wamp`), ajuste o `WAMP_PATH` de acordo.

---

### 3.1 Banco ÚNICO para todos os computadores (acessível de qualquer lugar)

Com `DB_HOST=localhost` **cada computador tem o seu próprio MySQL** — por isso, ao
configurar em outro PC, os dados do primeiro não aparecem. Para existir **um só banco**:

1. **Hospede um MySQL 8 na internet** (um servidor/VPS seu, ou um MySQL gerenciado — Aiven, Railway,
   Google Cloud SQL, AWS RDS, DigitalOcean etc.). Anote host, porta, usuário e senha.
2. **Leve os dados que você já tem** do WampServer para lá (uma única vez, no PC que tem os dados):
   ```bash
   mysqldump -u root -p --routines nexus_air > nexus_air.sql
   mysql -h SEU_HOST -P 3306 -u SEU_USUARIO -p --ssl-mode=REQUIRED nexus_air < nexus_air.sql
   ```
   (se o schema `nexus_air` ainda não existir lá, crie-o antes: `CREATE DATABASE nexus_air;`)
3. **Em CADA computador**, no `.env`, use exatamente os mesmos valores:
   ```env
   DB_HOST=seu-servidor-mysql.exemplo.com
   DB_PORT=3306
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=nexus_air
   DB_SSL=true
   ```
   Quando `DB_HOST` não é `localhost`, o Nexus Air **não tenta subir o Wamp** e usa só o banco remoto.
4. Pronto: qualquer computador (inclusive na China) que rodar o sistema com esse `.env` lê e grava
   **no mesmo banco** os usuários, empresas, alertas e tarefas. As tabelas/colunas que faltarem são criadas sozinhas ao iniciar.
   Atenção: agendamentos, máquinas, conectores e fluxos ficam em `backend/data/automation.json` e **não** são compartilhados.

> Tarefas, alertas e verificações agora ficam **no banco** (antes parte disso ficava no navegador de
> cada computador e por isso não aparecia nos outros).
> Não coloque o `.env` no Git: ele contém a senha do banco.

### 3.2 Alertas e tarefas são por empresa

Cada alerta e cada tarefa pertence à empresa (campo `cliente`) de quem os gerou. Só usuários da
**mesma empresa** veem e verificam os alertas dela. Concluir, interromper ou **excluir** uma tarefa
gera um alerta que precisa ser verificado na Central de Alertas.

---

### 4. Instalação de Dependências & Execução

1. **Instale os pacotes Python**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Inicie o servidor Flask**:
   ```bash
   cd backend
   python app.py
   ```
   Ao rodar esse comando, a aplicação verifica se o MySQL já está ativo em `DB_HOST:DB_PORT`; se não estiver, ela mesma inicia o `mysqld` do WampServer em segundo plano (sem abrir a janela do Wamp) e só então sobe o Flask.
3. **Acesse a aplicação**:
   Abra o navegador em `http://localhost:5000` para visualizar o sistema em execução.

## Relatórios agendados por e-mail
O envio roda dentro do próprio Flask (`COLETOR_EMBUTIDO`, ligado por padrão). Configure `N8N_API_KEY`, `ORACLE_SSH_*` e `SMTP_*` no `.env`; guia completo em [RELATORIOS_AGENDADOS.md](RELATORIOS_AGENDADOS.md) e [coletor/LEIAME.md](coletor/LEIAME.md).

## Zabbix
Alertas sincronizados com o Zabbix nos dois sentidos — veja [ZABBIX.md](ZABBIX.md).
