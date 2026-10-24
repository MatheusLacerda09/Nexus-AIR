# n8n do Nexus Air — início rápido

Manual completo: **"Manual do n8n - Nexus Air"** (documento entregue junto com este pacote).

## Arquivos desta pasta
| Arquivo | Para que serve |
|---|---|
| `docker-compose.yml` | Sobe o n8n com volume persistente, fuso de São Paulo, limpeza de histórico e `host.docker.internal` |
| `.env.example` | Modelo do `.env` (copie para `.env`) |
| `gerar_chaves.py` | Gera `N8N_ENCRYPTION_KEY` e `N8N_API_KEY` |
| `n8n.bat` / `n8n.sh` | `iniciar`, `parar`, `reiniciar`, `status`, `logs`, `versao`, `backup`, `atualizar` |
| `nexus-teste-conexao.workflow.json` | Diagnóstico: Nexus Air → SSH/Oracle → Gmail |
| `nexus-relatorios-agendados.workflow.json` | Workflow de produção (v2, corrigido) |

## 6 passos
1. `python gerar_chaves.py` → copie `N8N_ENCRYPTION_KEY` para `n8n/.env` e `N8N_API_KEY` para o `.env` da raiz do Nexus Air; reinicie o Flask.
2. `n8n.bat iniciar` (Windows) ou `./n8n.sh iniciar` → abra http://localhost:5678 e crie a conta de dono.
3. Importe os dois `.workflow.json` e crie as credenciais **Nexus API Key**, **Servidor Oracle** e **Gmail**.
4. Rode **Nexus Air - Teste de conexão** até os 3 nós ficarem verdes.
5. Ative **Nexus Air - Relatórios agendados**.
6. No dashboard: crie um agendamento → **Enviar agora** → em até 1 minuto vira *Enviado*.

Problemas? Veja a seção "Solução de problemas" do manual.
