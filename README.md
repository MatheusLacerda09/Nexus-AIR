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
- **Services**: `ObterDashboardService`, `GerarRelatorioSuporteService`, `sistema_service` (leitura de dados reais de CPU via módulo `os` do Node).
- **Controllers**: `AlertaController`, `sistema_controller`.

## 🖥️ Front-end
- `frontend/html/index.html`: estrutura da página (dashboard + abas do menu).
- `backend/css/style.css`: estilos, fonte Oswald e todas as animações (menu retrátil, troca de abas, gráficos, notificações).
- `backend/javascript/script.js`: toda a lógica de interface (tabela de processos, notificações, gráficos em canvas, busca dos dados reais de CPU).
- `frontend/assets/logo.png`: logo exibida centralizada abaixo do menu lateral.

## 🚀 Como Executar o Projeto

### Backend de consultas (Python/SQL)
1. Importe o script SQL contendo o esquema do banco e as Procedures:
   ```bash
   mysql -u usuario -p nexus_air < script_nexus_air.sql
   ```
2. Instale as dependências Python listadas em `requirements.txt` e rode a API de alertas normalmente.

### Servidor do dashboard e dados reais de CPU (Node.js)
O navegador não tem acesso à frequência real do processador, ao uso de CPU ou ao tempo ligado do computador (isso é bloqueado por segurança em qualquer site). Por isso, o card de CPU do dashboard busca esses dados de um pequeno servidor em Node.js, que lê as informações reais da máquina onde ele estiver rodando através do módulo nativo `os`.

```bash
npm install
npm start
```

Depois acesse `http://localhost:3000` no navegador. Enquanto o servidor não estiver rodando, o card de CPU mostra apenas o número de núcleos do seu navegador e o tempo de sessão, avisando que o backend precisa ser conectado para os dados completos.

> No Windows, se aparecer erro pedindo para "instalar o bash" ao rodar `npm install`/`npm start`, rode os comandos pelo Git Bash, WSL, ou troque o terminal usado (o projeto em si não precisa de bash para funcionar).
