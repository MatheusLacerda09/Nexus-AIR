
"""
Nexus Air - Coletor (substitui o n8n)

A cada ciclo:
  1) pergunta ao Flask quais relatórios estão na hora   GET  /api/n8n/agendamentos/devidos
  2) entra por SSH no servidor do banco e roda o script relatorio_oracle.sh (somente leitura)
  3) entrega a coleta ao Flask                          POST .../coleta
  4) pede o PDF ao Flask                                POST .../pdf
  5) envia o PDF por e-mail (SMTP, ex.: Gmail)
  6) informa sucesso/falha ao Flask                     POST .../resultado

Uso:
  python coletor.py              roda continuamente (Ctrl+C para parar)
  python coletor.py --uma-vez    processa o que estiver devido agora e termina
  python coletor.py --testar     testa Flask, SSH e SMTP sem gerar relatório
"""
import argparse
import logging
import os
import smtplib
import ssl
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from email.utils import formataddr

import paramiko
import requests
from dotenv import load_dotenv

AQUI = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(AQUI, "..", ".env"))
load_dotenv(os.path.join(AQUI, ".env"), override=True)

def _env(nome, padrao=""):
    return os.getenv(nome, padrao).strip()

class Cfg:
    BASE_URL = _env("COLETOR_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    API_KEY = _env("N8N_API_KEY") or _env("COLETOR_API_KEY")
    INTERVALO = max(5, int(_env("COLETOR_INTERVALO", "30")))
    PARALELO = max(1, int(_env("COLETOR_PARALELO", "2")))

    SSH_HOST = _env("ORACLE_SSH_HOST")
    SSH_PORT = int(_env("ORACLE_SSH_PORT", "22"))
    SSH_USER = _env("ORACLE_SSH_USER", "nexus_report")
    SSH_KEY = _env("ORACLE_SSH_KEY")
    SSH_KEY_PASS = _env("ORACLE_SSH_KEY_PASSPHRASE") or None
    SSH_PASSWORD = os.getenv("ORACLE_SSH_PASSWORD", "") or None
    SSH_TIMEOUT = int(_env("ORACLE_SSH_TIMEOUT", "900"))
    KNOWN_HOSTS = _env("ORACLE_SSH_KNOWN_HOSTS", os.path.join(AQUI, "known_hosts"))

    HOSTKEY = _env("ORACLE_SSH_HOSTKEY", "confiar").lower()

    SMTP_HOST = _env("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(_env("SMTP_PORT", "587"))
    SMTP_USER = _env("SMTP_USER")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
    SMTP_NOME = _env("SMTP_NOME", "Nexus Air")
    SMTP_SSL = _env("SMTP_SSL", "false").lower() == "true"

log = logging.getLogger("coletor")

class Falha(Exception):
    """Falha esperada, com mensagem que aparece na tela do Nexus Air."""

def api(metodo, caminho, **kw):
    kw.setdefault("timeout", 120)
    r = requests.request(metodo, Cfg.BASE_URL + caminho, headers={"X-API-Key": Cfg.API_KEY}, **kw)
    return r

def _erro_http(r):
    try:
        return r.json().get("message") or r.text[:200]
    except ValueError:
        return r.text[:200]

def _cliente_ssh(host):
    c = paramiko.SSHClient()
    if os.path.exists(Cfg.KNOWN_HOSTS):
        c.load_host_keys(Cfg.KNOWN_HOSTS)
    c.set_missing_host_key_policy(paramiko.RejectPolicy() if Cfg.HOSTKEY == "estrito" else paramiko.AutoAddPolicy())
    args = dict(hostname=host, port=Cfg.SSH_PORT, username=Cfg.SSH_USER, timeout=20,
                banner_timeout=20, auth_timeout=20, look_for_keys=False, allow_agent=False)
    if Cfg.SSH_KEY:
        args.update(key_filename=Cfg.SSH_KEY, passphrase=Cfg.SSH_KEY_PASS)
    elif Cfg.SSH_PASSWORD:
        args.update(password=Cfg.SSH_PASSWORD)
    else:
        raise Falha("Defina ORACLE_SSH_KEY (chave privada) ou ORACLE_SSH_PASSWORD no .env.")
    try:
        c.connect(**args)
    except paramiko.BadHostKeyException:
        raise Falha(f"A chave SSH de {host} mudou desde o primeiro acesso. Se foi intencional, apague a linha dele em {Cfg.KNOWN_HOSTS}.")
    except paramiko.AuthenticationException:
        raise Falha(f"Autenticação SSH recusada para {Cfg.SSH_USER}@{host}.")
    except (paramiko.SSHException, OSError) as e:
        raise Falha(f"Não foi possível conectar por SSH em {host}:{Cfg.SSH_PORT} ({e}).")
    if Cfg.HOSTKEY != "estrito":
        os.makedirs(os.path.dirname(Cfg.KNOWN_HOSTS), exist_ok=True)
        c.save_host_keys(Cfg.KNOWN_HOSTS)
    return c

def rodar_ssh(host, comando, limite):
    """Executa o comando e devolve (codigo, stdout, stderr). O comando leva a senha do banco
    (base64), por isso ele nunca é escrito no log."""
    c = _cliente_ssh(host)
    try:
        _, out, err = c.exec_command(comando, timeout=limite)
        out.channel.settimeout(limite)
        fim = time.monotonic() + limite

        bo, be = [], []
        ch = out.channel
        while not ch.exit_status_ready() or ch.recv_ready() or ch.recv_stderr_ready():
            if time.monotonic() > fim:
                ch.close()
                raise Falha(f"O script passou de {limite}s no servidor e foi interrompido.")
            if ch.recv_ready():
                bo.append(ch.recv(65536))
            elif ch.recv_stderr_ready():
                be.append(ch.recv_stderr(65536))
            else:
                time.sleep(0.2)
        codigo = ch.recv_exit_status()
        return codigo, b"".join(bo).decode("utf-8", "replace"), b"".join(be).decode("utf-8", "replace")
    finally:
        c.close()

def _smtp():
    if not (Cfg.SMTP_USER and Cfg.SMTP_PASSWORD):
        raise Falha("Defina SMTP_USER e SMTP_PASSWORD (senha de app do Gmail) no .env.")
    ctx = ssl.create_default_context()
    try:
        if Cfg.SMTP_SSL:
            s = smtplib.SMTP_SSL(Cfg.SMTP_HOST, Cfg.SMTP_PORT, timeout=30, context=ctx)
        else:
            s = smtplib.SMTP(Cfg.SMTP_HOST, Cfg.SMTP_PORT, timeout=30)
            s.starttls(context=ctx)
        s.login(Cfg.SMTP_USER, Cfg.SMTP_PASSWORD)
        return s
    except smtplib.SMTPAuthenticationError:
        raise Falha("O servidor de e-mail recusou o login. No Gmail use uma senha de app (não a senha da conta).")
    except (smtplib.SMTPException, OSError) as e:
        raise Falha(f"Não foi possível conectar ao e-mail ({Cfg.SMTP_HOST}:{Cfg.SMTP_PORT}): {e}")

def enviar_email(item, pdf, nome_pdf):
    destinos = [d.strip() for d in item["destinatarios"].split(",") if d.strip()]
    msg = EmailMessage()
    msg["Subject"] = item["assunto"]
    msg["From"] = formataddr((Cfg.SMTP_NOME, Cfg.SMTP_USER))
    msg["To"] = ", ".join(destinos)
    msg.set_content("Segue em anexo o relatório de monitoramento.")
    msg.add_alternative(item["mensagem_html"], subtype="html")
    msg.add_attachment(pdf, maintype="application", subtype="pdf", filename=nome_pdf)
    s = _smtp()
    try:
        s.send_message(msg, to_addrs=destinos)
    except smtplib.SMTPException as e:
        raise Falha(f"Falha ao enviar o e-mail: {e}")
    finally:
        try:
            s.quit()
        except Exception:
            pass
    return destinos

def processar(item):
    rid, nome = item["id"], item.get("nome", item["id"])
    try:
        host = item.get("host") or Cfg.SSH_HOST
        if not host:
            raise Falha("Sem endereço do servidor: o banco cadastrado precisa ter endereço, ou defina ORACLE_SSH_HOST no .env.")
        log.info("[%s] coletando em %s (instância %s)...", nome, host, item.get("instancia"))
        codigo, stdout, stderr = rodar_ssh(host, item["comando"], Cfg.SSH_TIMEOUT)
        if codigo != 0 or "@@FIM@@" not in stdout:
            detalhe = (stderr.strip() or stdout.strip()[-300:]
                       or (f"Script retornou código {codigo}." if codigo else "Saída do script incompleta (faltou @@FIM@@)."))
            raise Falha(detalhe[:300])

        r = api("POST", f"/api/n8n/agendamentos/{rid}/coleta", json={"stdout": stdout})
        if r.status_code != 200:
            raise Falha(f"Nexus Air recusou a coleta: {_erro_http(r)}")

        log.info("[%s] gerando PDF...", nome)
        r = api("POST", f"/api/n8n/agendamentos/{rid}/pdf")
        if r.status_code != 200:
            raise Falha(f"Nexus Air não gerou o PDF: {_erro_http(r)}")
        arquivo = r.headers.get("Content-Disposition", "").split("filename=")[-1].strip('" ') or "Relatorio.pdf"

        log.info("[%s] enviando e-mail...", nome)
        destinos = enviar_email(item, r.content, arquivo)
        ok, msg = True, "Enviado para " + ", ".join(destinos)
    except Falha as e:
        ok, msg = False, str(e)
    except Exception as e:
        log.exception("[%s] erro inesperado", nome)
        ok, msg = False, f"Erro inesperado no coletor: {type(e).__name__}: {e}"

    (log.info if ok else log.error)("[%s] %s", nome, msg)
    for _ in range(3):
        try:
            api("POST", f"/api/n8n/agendamentos/{rid}/resultado", json={"ok": ok, "mensagem": msg}, timeout=30)
            break
        except requests.RequestException as e:
            log.warning("[%s] não consegui avisar o resultado ao Nexus Air (%s); tentando de novo...", nome, e)
            time.sleep(5)

def ciclo():
    try:
        r = api("GET", "/api/n8n/agendamentos/devidos", timeout=30)
    except requests.RequestException as e:
        log.warning("Nexus Air indisponível em %s (%s).", Cfg.BASE_URL, e)
        return 0
    if r.status_code != 200:
        log.error("Nexus Air respondeu %s: %s", r.status_code, _erro_http(r))
        return 0
    itens = r.json().get("itens", [])
    if itens:
        log.info("%d relatório(s) na hora.", len(itens))
        with ThreadPoolExecutor(max_workers=Cfg.PARALELO) as pool:
            list(pool.map(processar, itens))
    return len(itens)

def testar():
    ok = True

    def passo(nome, fn):
        nonlocal ok
        try:
            print(f"[ OK ] {nome}: {fn()}")
        except Falha as e:
            ok = False
            print(f"[ERRO] {nome}: {e}")
        except Exception as e:
            ok = False
            print(f"[ERRO] {nome}: {type(e).__name__}: {e}")

    def t_flask():
        r = api("GET", "/api/n8n/ping", timeout=15)
        if r.status_code != 200:
            raise Falha(f"{r.status_code} {_erro_http(r)}")
        j = r.json()
        return f"fuso {j['fuso']}, hora do servidor {j['hora_servidor']}, script {j['script_oracle']}"

    def t_ssh():
        if not Cfg.SSH_HOST:
            return "pulado (defina ORACLE_SSH_HOST para testar; os agendamentos usam o endereço do banco cadastrado)"
        cod, out, err = rodar_ssh(Cfg.SSH_HOST, "echo conectado; hostname", 30)
        if cod != 0:
            raise Falha(err.strip() or f"código {cod}")
        return out.strip().replace("\n", " / ")

    def t_smtp():
        s = _smtp()
        s.quit()
        return f"login aceito em {Cfg.SMTP_HOST} como {Cfg.SMTP_USER}"

    passo("Nexus Air (Flask)", t_flask)
    passo("SSH", t_ssh)
    passo("E-mail (SMTP)", t_smtp)
    return 0 if ok else 1

def main():
    ap = argparse.ArgumentParser(description="Coletor Nexus Air (substitui o n8n)")
    ap.add_argument("--uma-vez", action="store_true", help="processa o que estiver devido e termina")
    ap.add_argument("--testar", action="store_true", help="testa Flask, SSH e e-mail")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%d/%m %H:%M:%S")
    logging.getLogger("paramiko").setLevel(logging.WARNING)

    if not Cfg.API_KEY:
        sys.exit("Defina N8N_API_KEY no .env (a mesma chave do Nexus Air).")
    if a.testar:
        sys.exit(testar())
    if a.uma_vez:
        ciclo()
        return
    log.info("Coletor ligado. Nexus Air em %s, ciclo de %ss.", Cfg.BASE_URL, Cfg.INTERVALO)
    try:
        while True:
            ciclo()
            time.sleep(Cfg.INTERVALO)
    except KeyboardInterrupt:
        log.info("Coletor encerrado.")

if __name__ == "__main__":
    main()
