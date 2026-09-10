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
| **10** | **Relatório de Suporte** | `GET /api/alertas/relatorio-suporte` | `RelatorioSuporteService.executar` | `CALL sp_relatorio_resolucao_suporte` |

> ⚡ **Recursos Adicionais Incluídos**:
> - **Logout de Sessão** (`POST /api/auth/logout`): Encerramento seguro da sessão (`session.pop`).
> - **Telemetria de Hardware** (`GET /api/sistema/status`): Leitura direta de consumo de CPU/RAM e Uptime via `psutil`.

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

### 1. Pré-requisitos
Certifique-se de possuir em seu ambiente local:
- **Python 3.10+**
- **Servidor MySQL** (via MySQL Workbench, WampServer ou container local)
- **Pip** (gerenciador de pacotes Python)

---

### 2. Configuração do Banco de Dados

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
```

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
3. **Acesse a aplicação**:
   Abra o navegador em `http://localhost:5000` para visualizar o sistema em execução.
