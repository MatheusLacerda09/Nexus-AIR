# Integração Nexus Air ↔ Zabbix

Os alertas ficam sincronizados nos dois sentidos, sem ninguém precisar copiar nada.

| Aconteceu em… | Efeito no outro lado |
|---|---|
| Zabbix: problema novo | Vira alerta na Central de Alertas (origem `zabbix`, ligado pelo id do evento) |
| Zabbix: severidade/título mudou | Atualiza o alerta no Nexus |
| Zabbix: problema reconhecido (ack) | Alerta fica **verificado** no Nexus (quem reconheceu e a mensagem aparecem) |
| Zabbix: problema resolvido | Alerta fica verificado no Nexus (estado `resolvido`) |
| Nexus: alerta do Zabbix verificado | Evento é **reconhecido no Zabbix** com comentário "Verificado no Nexus Air por X: observação" |

Se o Zabbix estiver fora do ar na hora de verificar, o alerta fica marcado (`zabbix_pendente`) e é reenviado no próximo ciclo.

## Ligar
1. Instale a dependência nova: `pip install -r requirements.txt` (entrou `requests`).
2. No `backend/.env` (modelo em `.env.example`) preencha `ZABBIX_URL` e `ZABBIX_TOKEN` (ou `ZABBIX_USER`/`ZABBIX_PASSWORD`). O usuário/token precisa de permissão de leitura nos hosts e de **reconhecer eventos**.
3. Suba o backend normalmente. As colunas novas na tabela `alerta` são criadas sozinhas (`ip_maquina`/`ip_banco` passam a aceitar vazio, porque o host do Zabbix pode não existir no Nexus).
4. A associação com máquina/banco é feita pelo **IP da interface do host** no Zabbix.

## Endpoints (precisam de login)
- `GET /api/zabbix/status` — ligado?, última sincronização, último erro, versão do Zabbix.
- `POST /api/zabbix/sincronizar` — força um ciclo agora.

## Observações
- Funciona com Zabbix 5.4 a 7.x (detecta a versão e usa Bearer/`auth` conforme precisa).
- Alertas criados à mão no Nexus **não** viram problemas no Zabbix (o Zabbix só cria problemas por gatilhos). Se quiser isso, dá para enviar via `history.push` para um item trapper.
- Alertas de tarefa do Nexus não são enviados ao Zabbix.

## Máquinas (Conectores de Dados + dashboard)
- Em **Conectores de Dados** dá para cadastrar máquinas (Servidor Linux/Windows, Banco, Outro host). Informe o **nome do host no Zabbix** (a tela lista os hosts do Zabbix para escolher) e/ou o **IP**; o Nexus localiza o host sozinho.
- **Validar** confere se o host existe no Zabbix; **Conectar** valida e já lê CPU/RAM/uptime; **Ver no dashboard** abre o dashboard naquela máquina.
- No topo do **Dashboard** aparece o seletor **Máquina**: o dashboard passa a mostrar CPU, RAM e uptime da máquina escolhida (lidos do Zabbix). A escolha fica salva no navegador.
- Itens lidos no Zabbix: `system.cpu.util` (ou `system.cpu.util[,idle]`/carga), `system.cpu.num`, `vm.memory.size[total|available]` (ou `vm.memory.utilization`), `system.uptime`. Os templates padrão Linux/Windows já trazem esses itens.
- As máquinas ficam separadas por empresa, em `backend/data/automation.json` (lista `maquinas`).

### Endpoints novos (precisam de login)
- `GET/POST /api/maquinas`, `DELETE /api/maquinas/<id>`
- `POST /api/maquinas/<id>/validar` · `POST /api/maquinas/<id>/conectar`
- `GET /api/maquinas/<id>/status` — métricas no mesmo formato de `/api/sistema/status`
- `GET /api/maquinas/zabbix-hosts` — hosts existentes no Zabbix
