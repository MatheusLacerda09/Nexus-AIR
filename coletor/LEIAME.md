# Coletor Python do Nexus Air (substitui o n8n)

Um único programa (`coletor.py`) faz o que o workflow do n8n fazia:

```
Nexus Air (agenda) ◄── a cada 30 s ── coletor.py
                                         1) SSH ──► servidor do banco (relatorio_oracle.sh, só leitura)
                                         2) entrega a coleta ao Nexus Air
                                         3) Nexus Air monta o PDF
                                         4) coletor envia o PDF por e-mail (SMTP/Gmail)
                                         5) informa Enviado/Falhou ao Nexus Air
```

A tela do dashboard não muda: agenda, "Enviar agora" e a coluna "Último envio" continuam iguais.
O endereço SSH vem do **banco cadastrado em Conectores de Dados** (campo Endereço), então cada
agendamento entra no servidor certo, sem limite de "um servidor por workflow" como no n8n.
A pasta `n8n/` foi mantida; só não deixe o n8n e o coletor ligados ao mesmo tempo.

## Passo a passo

1. `pip install -r requirements.txt` (entrou o `paramiko`).
2. No `.env` da raiz (modelo em `.env.example`, bloco "Coletor Python") preencha:
   - `ORACLE_SSH_USER` e `ORACLE_SSH_KEY` (ou `ORACLE_SSH_PASSWORD`)
   - `SMTP_USER` e `SMTP_PASSWORD`. No Gmail ligue a verificação em 2 etapas e crie uma **senha de app**.
   - `N8N_API_KEY` já existe e é reaproveitada.
3. O servidor do banco continua como no guia dos relatórios agendados: script copiado para
   `/opt/nexus/relatorio/` e usuário SSH com sudo para `oracle` (`RELATORIOS_AGENDADOS.md`, seção 1).
4. Reinicie o Flask (ele passou a guardar o servidor do banco no agendamento).
5. Teste: `python coletor/coletor.py --testar` (Flask, SSH e e-mail; para testar o SSH, defina `ORACLE_SSH_HOST`).
6. Rode: `python coletor/coletor.py`. No dashboard, crie um agendamento e clique em **Enviar agora**.

Agendamentos criados **antes** desta versão não têm o servidor guardado: defina `ORACLE_SSH_HOST`
no `.env` (vale como padrão) ou crie o agendamento de novo.

## Deixar rodando sempre

**Linux (systemd)** — `/etc/systemd/system/nexus-coletor.service`:
```
[Unit]
Description=Coletor Nexus Air
After=network-online.target

[Service]
WorkingDirectory=/caminho/Nexus-AIR-main
ExecStart=/usr/bin/python3 coletor/coletor.py
Restart=always
User=nexus

[Install]
WantedBy=multi-user.target
```
`systemctl enable --now nexus-coletor`

**Windows**: abra o Agendador de Tarefas, crie uma tarefa "Ao iniciar o sistema" que execute
`python coletor\coletor.py` na pasta do projeto.

## Opções (.env)

| Variável | Padrão | Para quê |
|---|---|---|
| `COLETOR_BASE_URL` | `http://127.0.0.1:5000` | Endereço do Flask |
| `COLETOR_INTERVALO` | 30 | Segundos entre verificações |
| `COLETOR_PARALELO` | 2 | Relatórios ao mesmo tempo |
| `ORACLE_SSH_TIMEOUT` | 900 | Tempo máximo do script, em segundos |
| `ORACLE_SSH_HOSTKEY` | `confiar` | `confiar` grava a chave do servidor no 1º acesso e recusa se ela mudar; `estrito` só aceita servidores já listados em `coletor/known_hosts` |

## Segurança

- A senha do banco segue para o servidor em base64 pela entrada padrão do script, como no n8n, e o coletor **nunca escreve o comando no log**.
- Proteja o `.env` e a chave SSH: quem os tiver acessa o servidor do banco e o e-mail.
- Se o coletor ficar fora do ar, o relatório sai quando ele voltar (uma vez só). Falhas não são reenviadas sozinhas: aparecem na tela como *Falhou*, com o motivo.
