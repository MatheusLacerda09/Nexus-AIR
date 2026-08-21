# Nexus Air

Dashboard de monitoramento de infraestrutura (VM Oracle Linux) com uma API de consultas e procedures no backend em Python, e uma camada extra em Node.js para servir o front-end e expor dados reais de CPU da máquina local.

## 📌 Funcionalidades Implementadas
- **Dashboard de Monitoramento**: consulta detalhada trazendo dados de alertas, consumo de CPU/RAM da VM e status do banco.
- **Relatório de Suporte**: histórico de chamados resolvidos cruzando dados do `relatorio_alerta` e do `usuario_suporte`.
- **Análise de Métrica Crítica**: identificação de máquinas virtuais operando com CPU acima do limite tolerado.
- **Front-end do dashboard**: interface completa em HTML/CSS/JS (menu lateral retrátil, troca de abas animada, central de notificações, tabela de processos com ações de parar/retomar/excluir).
- **Dados reais de CPU**: núcleos, velocidade, uso/livre e tempo ligado lidos ao vivo da máquina onde o servidor Node estiver rodando.

## 🗄️ Stored Procedures Utilizadas
- `sp_obter_alertas_detalhados(p_tipo_alerta)`: realiza JOIN entre `alerta`, `maquinas_virtuais` e `banco`.
- `sp_relatorio_resolucao_suporte(p_id_suporte)`: realiza JOIN entre `relatorio_alerta`, `usuario_suporte` e `maquinas_virtuais`.
- `sp_maquinas_alto_consumo(p_cpu_limite)`: agrupa (`GROUP BY`) os alertas por máquina filtrando por consumo de CPU (`WHERE`).

## 🌐 Rotas da API
| Método | Rota | Descrição | Parâmetros (Query) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alertas/dashboard` | Retorna o painel geral de alertas e máquinas em estado crítico | `tipo` (opcional), `cpu_limite` (padrão: 80) |
| `GET` | `/api/alertas/relatorio-suporte` | Traz o histórico de suporte com dados dos agentes | `id_suporte` (opcional) |
| `GET` | `/api/sistema/status` | Retorna núcleos, velocidade, uso/livre de CPU e tempo ligado reais da máquina que roda o servidor Node | — |

## 🏗️ Estrutura de Camadas (Arquitetura)
- **Models**: `Empresa`, `Banco`, `MaquinaVirtual`, `Usuario`, `Alerta`, `RelatorioAlerta`.
- **Repositories**: `AlertaRepository` (centraliza chamadas de `CALL procedure`).
- **Services**: `ObterDashboardService`, `GerarRelatorioSuporteService`.
- **Controllers**: `AlertaController`.
- **Entrada da aplicação**: `backend/app.py` (registra os Blueprints) e `backend/database/__init__.py` (conexão MySQL via variáveis de ambiente).

## 🖥️ Front-end
- `frontend/html/index.html`: estrutura da página (dashboard + abas do menu).
- `backend/css/style.css`: estilos, fonte Oswald e todas as animações (menu retrátil, troca de abas, gráficos, notificações).
- `backend/javascript/script.js`: toda a lógica de interface (tabela de processos, notificações, gráficos em canvas, busca dos dados reais de CPU).
- `frontend/assets/logo.png`: logo exibida centralizada abaixo do menu lateral.

## 🚀 Como Executar o Projeto

### Backend de consultas (Python/Flask)
1. Importe o schema do banco e crie as Procedures:
   ```bash
   mysql -u root -p < backend/database/banco.sql
   mysql -u root -p nexus_air < backend/procedures/procedures_banco.sql
   ```
2. Copie `.env.example` para `.env` e ajuste as credenciais do seu MySQL:
   ```bash
   cp .env.example .env
   ```
3. Instale as dependências Python e rode o servidor Flask:
   ```bash
   pip install -r requirements.txt
   cd backend
   python app.py
   ```
   A API sobe em `http://localhost:5000`, com as rotas `/api/alertas/dashboard` e `/api/alertas/relatorio-suporte`.

### Servidor do dashboard e dados reais de CPU (Node.js)
O navegador não tem acesso à frequência real do processador, ao uso de CPU ou ao tempo ligado do computador (isso é bloqueado por segurança em qualquer site). Por isso, o card de CPU do dashboard busca esses dados de um pequeno servidor em Node.js, que lê as informações reais da máquina onde ele estiver rodando através do módulo nativo `os`.

```bash
npm install
npm start
```

Depois acesse `http://localhost:3000` no navegador. Enquanto o servidor não estiver rodando, o card de CPU mostra apenas o número de núcleos do seu navegador e o tempo de sessão, avisando que o backend precisa ser conectado para os dados completos.

> No Windows, se aparecer erro pedindo para "instalar o bash" ao rodar `npm install`/`npm start`, rode os comandos pelo Git Bash, WSL, ou troque o terminal usado (o projeto em si não precisa de bash para funcionar).

## 🔗 Rodando Front-end + Flask + Node juntos
Hoje são dois servidores rodando ao mesmo tempo, cada um com uma função:
- **Flask (porta 5000)**: API real de alertas, consultando o banco.
- **Node (porta 3000)**: serve o HTML/CSS/JS do dashboard e expõe os dados reais de CPU da máquina.

O front-end busca os dois automaticamente. Para ver tudo funcionando junto:

1. Terminal 1 — suba o Flask:
   ```bash
   cd backend
   python app.py
   ```
2. Terminal 2 — suba o Node (em outra aba/janela do terminal, na raiz do projeto):
   ```bash
   npm install
   npm start
   ```
3. Acesse `http://localhost:3000` no navegador.

Com o Flask rodando, a **Central de Alertas** e o sino de notificações passam a mostrar os alertas reais vindos do banco (via `sp_obter_alertas_detalhados`), atualizando a cada 15 segundos. Se o Flask não estiver de pé, o painel continua mostrando os dois avisos de exemplo, sem quebrar a tela.

A tabela "Monitoramento de Processos & Infraestrutura" (com os botões de parar/retomar/excluir) ainda usa dados de exemplo fixos no `script.js` — essa parte só vai virar dado real quando as funcionalidades de execução de tarefas (itens 7 a 9 da nossa lista) forem implementadas.
