# Nexus Air API - Etapa de Consultas e Procedures

## 📌 Funcionalidades Implementadas
- **Dashboard de Monitoramento**: Consulta detalhada trazendo dados de alertas, consumo de CPU/RAM da VM e status do banco.
- **Relatório de Suporte**: Histórico de chamados resolvidos cruzando dados do `relatorio_alerta` e do `usuario_suporte`.
- **Análise de Métrica Crítica**: Identificação de máquinas virtuais operando com CPU acima do limite tolerado.

## 🗄️ Stored Procedures Utilizadas
- `sp_obter_alertas_detalhados(p_tipo_alerta)`: Realiza JOIN entre `alerta`, `maquinas_virtuais` e `banco`.
- `sp_relatorio_resolucao_suporte(p_id_suporte)`: Realiza JOIN entre `relatorio_alerta`, `usuario_suporte` e `maquinas_virtuais`.
- `sp_maquinas_alto_consumo(p_cpu_limite)`: Agrupa (`GROUP BY`) os alertas por máquina filtrando por consumo de CPU (`WHERE`).

## 🌐 Rotas da API
| Método | Rota | Descrição | Parâmetros (Query) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alertas/dashboard` | Retorna o painel geral de alertas e máquinas em estado crítico | `tipo` (opcional), `cpu_limite` (padrão: 80) |
| `GET` | `/api/alertas/relatorio-suporte` | Traz o histórico de suporte com dados dos agentes | `id_suporte` (opcional) |

## 🏗️ Estrutura de Camadas (Arquitetura)
- **Models**: `Empresa`, `Banco`, `MaquinaVirtual`, `Usuario`, `Alerta`, `RelatorioAlerta`.
- **Repositories**: `AlertaRepository` (Centraliza chamadas de `CALL procedure`).
- **Services**: `ObterDashboardService`, `GerarRelatorioSuporteService`.
- **Controllers**: `AlertaController`.

## 🚀 Como Executar o Projeto
1. Importe o script SQL contendo o esquema do banco e as Procedures:
   ```bash
   mysql -u usuario -p nexus_air < script_nexus_air.sql