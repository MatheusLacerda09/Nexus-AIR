# Relatórios agendados (Nexus Air + n8n + Gmail)

O cliente escolhe no dashboard **quando** (todo dia, toda semana, a cada N dias ou todo mês), **qual instância**, **quais seções** e **para quais e-mails**. A cada minuto o n8n verifica se há algo na hora, roda o relatório no Oracle, gera o PDF e envia pelo Gmail.

```
Dashboard ──► Flask (guarda agenda, calcula próximo envio, monta o PDF)
                 ▲  │  GET /api/n8n/agendamentos/devidos
                 │  ▼
              n8n (a cada 1 min)
                 │  1) COLETA : SSH ──► servidor Oracle (relatorio_oracle.sh, só leitura)
                 │  2) SALVA  : POST .../coleta   (Flask guarda o resultado bruto)
                 │  3) PDF    : POST .../pdf      (Flask monta o PDF com a coleta guardada)
                 └─► Gmail (anexo PDF) ─► POST .../resultado
```

O PDF só é montado **depois** que a coleta terminou e foi guardada. Na tela, a coluna "Último envio" mostra
*Coletando dados…* e depois *Gerando PDF…*. Se a coleta falhar, nenhum PDF é gerado e o motivo aparece como *Falhou*.

**Bancos:** a lista do agendamento vem de **Conectores de Dados**: cadastre lá um item do tipo *Banco de dados*
(com a **Instância / SID**, ex.: ORCL). Se o banco já existir sem SID, o formulário pede o SID na hora e o salva no cadastro.
Cada empresa vê só os próprios bancos.

> **Atualização do workflow (v2):** ao atualizar o projeto, **exclua o workflow antigo no n8n antes de importar o novo**
> (dois workflows ativos disputam os mesmos relatórios e o antigo pode marcá-los como *Falhou*). A v2 corrige os nós
> *Reportar sucesso/falha*, que não enviavam o corpo e faziam todo envio aparecer como *Falhou* mesmo com o e-mail enviado.
> Reassocie as credenciais depois de importar. Passo a passo completo: **Manual do n8n** (`n8n/LEIAME.md`).

**Formulário:** nome, banco, usuário administrador + senha, e-mails e *quando executar*: **Executar agora**
(uma vez, no próximo ciclo do n8n) ou **Em data e horário**, com a opção **Só uma vez** (desmarque para repetir
todo dia/semana/mês). A senha é guardada cifrada (chave derivada do `SECRET_KEY` do `.env` — **não troque o
`SECRET_KEY`** depois, ou será preciso recriar os agendamentos) e nunca volta para a tela. Ela segue ao servidor Oracle em
base64 pela entrada padrão do script (`-C`), e não como argumento. O usuário `SYS` conecta `as sysdba`; os demais, como usuário comum
com privilégio de DBA. Sem credenciais (agendamentos antigos), o script continua usando `/ as sysdba`.
Atenção: o comando aparece na execução do n8n, então restrinja quem acessa o n8n. Rode `pip install -r requirements.txt` (entrou `cryptography`)
e **copie de novo** `servidor-oracle/relatorio_oracle.sh` para o servidor Oracle.

Onde fica o quê: a agenda e as regras de frequência ficam **no Nexus Air** (editáveis pela tela). O n8n não precisa ser editado para mudar horário de ninguém.

---

## 1. Servidor Oracle

```bash
# como root/sudo, no servidor do banco
mkdir -p /opt/nexus/relatorio
cp -r servidor-oracle/* /opt/nexus/relatorio/
chown -R oracle:oinstall /opt/nexus/relatorio
chmod 750 /opt/nexus/relatorio/relatorio_oracle.sh
```

Teste manual (como `oracle`) — deve imprimir blocos `@@SECAO|...@@` e terminar com `@@FIM@@`:

```bash
sudo su - oracle
/opt/nexus/relatorio/relatorio_oracle.sh -i SUAINSTANCIA -s 2,4,6
```

**Usuário SSH para o n8n** (recomendado: um usuário só para isso, não o `oracle`):

```bash
useradd -m nexus_report
# colocar a chave pública do n8n em /home/nexus_report/.ssh/authorized_keys
echo 'nexus_report ALL=(oracle) NOPASSWD: /opt/nexus/relatorio/relatorio_oracle.sh *' > /etc/sudoers.d/nexus_report
chmod 440 /etc/sudoers.d/nexus_report
```

Se preferir que o n8n entre direto como `oracle`, ponha `ORACLE_USE_SUDO=false` no `.env` do Nexus Air.

Requisitos: Oracle 12.1.0.2 ou superior (as consultas usam `oracle_maintained` e `v$lock_type`) e o pacote `sysstat` para a seção de carga (`sar`).

## 2. Nexus Air

1. Copie os arquivos deste pacote por cima do projeto (não há `.env` aqui; o seu não é alterado).
2. No `.env`, acrescente (veja `.env.example`):
   ```
   N8N_API_KEY=<gere com: python -c "import secrets;print(secrets.token_urlsafe(32))">
   REPORT_TZ=America/Sao_Paulo
   ORACLE_SCRIPT_PATH=/opt/nexus/relatorio/relatorio_oracle.sh
   ORACLE_USE_SUDO=true
   ```
3. `pip install -r requirements.txt` (entram `reportlab` e `tzdata`; o `tzdata` é necessário no Windows/WAMP).
4. Reinicie o Flask. A tela fica em **Orquestrador de Fluxos → Relatórios agendados por e-mail**.

## 3. n8n

**Subir o n8n (Docker)** — pasta `n8n/`:

```bash
cd n8n
python gerar_chaves.py            # gera N8N_ENCRYPTION_KEY e N8N_API_KEY
copy .env.example .env            # (Linux: cp) e cole a N8N_ENCRYPTION_KEY
n8n.bat iniciar                   # Linux/macOS: ./n8n.sh iniciar  -> abra http://localhost:5678
```

**Configurar**

1. **Import from file** → `n8n/nexus-relatorios-agendados.workflow.json` e `n8n/nexus-teste-conexao.workflow.json`.
2. Crie/associe três credenciais:
   | Credencial | Tipo | Valor |
   |---|---|---|
   | Nexus API Key | Header Auth | Name `X-API-Key`, Value = o `N8N_API_KEY` do `.env` do Nexus Air |
   | Servidor Oracle | SSH (chave privada) | host do banco, usuário `nexus_report` |
   | Gmail | Gmail OAuth2 | conta que vai aparecer como remetente |
3. No nó **Config**, ajuste `base_url` para o endereço do Nexus Air *visto de dentro do n8n*.
   - n8n em Docker, Flask no mesmo PC: `http://host.docker.internal:5000` (o `docker-compose.yml` já resolve esse nome)
   - n8n e Flask em máquinas diferentes: `http://IP-DO-NEXUS:5000`
4. Rode o workflow **Nexus Air - Teste de conexão** (*Execute workflow*). Os três nós precisam ficar verdes.
5. Ative o workflow de relatórios (chave **Active/Publish**).

## 4. Testar

No dashboard, crie um agendamento e clique em **Enviar agora**. Em até 1 minuto o n8n pega, e a coluna "Último envio" muda para *Enviado* (ou *Falhou*, com o motivo ao passar o mouse). Para depurar, abra a execução no n8n (por padrão só execuções com **erro** ficam guardadas, porque o comando carrega a senha do banco em base64).

---

## O que mudou em relação ao relatório original

As consultas do PDF original chegaram com trechos corrompidos na cópia (`v$database`, `*100`, aspas, a parte do meio da query de maiores tabelas). Reescrevi cada uma; **valide as seções abaixo no seu banco** antes de colocar em produção:

| Seção | Mudança |
|---|---|
| 4, 6 | Reconstruídas (o `*100` e as aspas estavam perdidos). Divisão por zero protegida em `%Livre`. |
| 5 Maiores tabelas | Reescrita com CTEs (dados + índices + LOB). Resultado equivalente, não idêntico. |
| 8 Estatísticas | Exclusão de schemas via `dba_users.oracle_maintained`. **A lista de schemas próprios (BSS, GTI, TSCDUAGNT…) veio ilegível**: reinclua-os no `08_estatisticas.sql`, no `and owner not in (...)` comentado. |
| 9 Locks | O `DECODE` de ~300 linhas virou um join com `v$lock_type`. |
| 10 Esperas | O original (`rownum <= 10 order by 2 asc`) pegava 10 linhas quaisquer e as ordenava. Agora mostra os 10 maiores, ignorando eventos idle. |
| 12 Log do backup | No original era idêntico ao 11 (só `COMPLETED`). Agora mostra **todos** os status, incluindo `FAILED`. |
| 14, 15, 16 | Antes eram `vim`/`tail` manuais. Agora: último log do expdp, erros `ORA-`/`TNS-` das últimas 24h do alert log, e o bloco do `sar`. |

Passos 1 (entrar no oracle), 3 (sqlplus) e 13 (sair) são procedimento manual e não viram seção.

## Segurança

- Tudo que vem do formulário é validado no Flask **e** de novo no script (instância e seções só aceitam o formato esperado). Nada é concatenado em comando sem passar por isso.
- Cada empresa só vê e mexe nos próprios agendamentos.
- Os endpoints do n8n só respondem com a chave `X-API-Key`. Sem `N8N_API_KEY` no `.env`, ficam desligados.
- O script só faz `SELECT`/leitura. O acesso é `/ as sysdba` como o usuário `oracle`, então proteja a chave SSH do n8n.

## Limites conhecidos

- **Um servidor Oracle por workflow.** O nó SSH do n8n tem credencial fixa. Para vários servidores, duplique o nó SSH e coloque um `Switch` antes dele.
- Se o n8n ficar fora do ar no horário, o relatório sai assim que ele voltar (uma vez só, sem acumular).
- Falhas não são reenviadas automaticamente: o próximo envio segue a agenda normal e a falha aparece na tela.
- A agenda fica em `backend/data/automation.json`, o mesmo armazenamento já usado pelos conectores e fluxos.
