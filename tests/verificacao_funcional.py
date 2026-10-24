
"""
Verificação funcional do Nexus Air — roda SEM MySQL, SEM Oracle e SEM internet.

  python tests/verificacao_funcional.py

O que é executado de verdade (Flask real, rotas reais, PDF real, e-mail real):
  - agendamentos (criar, prévia, pausar, executar agora, excluir) e as 5 frequências
  - coletor embutido -> coleta -> PDF -> e-mail SMTP com anexo -> status na tela
  - conectores, validação de dados, fluxos, relatórios PDF, máquinas, telemetria
  - isolamento entre empresas e proteção das rotas
  - migração do esquema (contra uma conexão MySQL simulada)

O que é SIMULADO: o SSH no servidor Oracle (devolve uma saída de exemplo), o servidor
SMTP (um servidor local com TLS) e a conexão MySQL da migração.
O que NÃO é coberto: usuários/login, alertas, tarefas e Zabbix (dependem de MySQL/Zabbix reais).

Os dados do teste ficam numa pasta temporária: o seu automation.json não é tocado.
"""
import importlib.util
import os
import re
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import types
import base64
import email
import json

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="nexus-teste-")
sys.path.insert(0, os.path.join(RAIZ, "backend"))

os.environ.update(SECRET_KEY="chave-de-teste", N8N_API_KEY="chave-api-teste", FLASK_DEBUG="false",
                  REPORT_TZ="America/Sao_Paulo", COLETOR_INTERVALO="5", SMTP_HOST="localhost",
                  SMTP_SSL="true", SMTP_USER="remetente@teste.com", SMTP_PASSWORD="abcd efgh ijkl mnop",
                  SMTP_NOME="Nexus Air", ZABBIX_URL="")

def _faltando(nome):
    try:
        return importlib.util.find_spec(nome) is None
    except (ImportError, ValueError):
        return True

if _faltando("mysql"):
    mysql = types.ModuleType("mysql"); conn = types.ModuleType("mysql.connector")
    class _Erro(Exception):
        errno = 0
    conn.Error = _Erro
    conn.connect = lambda *a, **k: (_ for _ in ()).throw(_Erro("MySQL indisponível no teste"))
    conn.pooling = types.SimpleNamespace(MySQLConnectionPool=object)
    conn.errorcode = types.SimpleNamespace(ER_ACCESS_DENIED_ERROR=1045)
    sys.modules.update({"mysql": mysql, "mysql.connector": conn, "mysql.connector.errorcode": conn.errorcode})
    mysql.connector = conn
if _faltando("flask_cors"):
    fc = types.ModuleType("flask_cors"); fc.CORS = lambda *a, **k: None; sys.modules["flask_cors"] = fc
if _faltando("paramiko"):
    sys.modules["paramiko"] = types.ModuleType("paramiko")

CAIXA = []
def _porta_livre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

def _smtp_falso(porta):
    cert, chave = os.path.join(TMP, "cert.pem"), os.path.join(TMP, "key.pem")
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", chave, "-out", cert,
                    "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"],
                   check=True, capture_output=True)
    os.environ["SSL_CERT_FILE"] = cert
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert, chave)
    srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", porta)); srv.listen(5)
    def tratar(c):
        c = ctx.wrap_socket(c, server_side=True); f = c.makefile("rwb")
        def w(x): f.write((x + "\r\n").encode()); f.flush()
        w("220 fake"); msg = {"to": [], "data": b"", "auth": None}
        while True:
            l = f.readline()
            if not l: break
            t = l.decode().strip(); u = t.upper()
            if u.startswith("EHLO"): w("250-fake"); w("250 AUTH PLAIN LOGIN")
            elif u.startswith("AUTH PLAIN"): msg["auth"] = base64.b64decode(t.split()[2]).split(b"\0")[1:]; w("235 ok")
            elif u.startswith("AUTH LOGIN"):
                w("334 VXNlcm5hbWU6"); a = f.readline(); w("334 UGFzc3dvcmQ6"); b = f.readline()
                msg["auth"] = [base64.b64decode(a), base64.b64decode(b)]; w("235 ok")
            elif u.startswith("MAIL"): w("250 ok")
            elif u.startswith("RCPT"): msg["to"].append(t.split(":", 1)[1].strip()); w("250 ok")
            elif u == "DATA":
                w("354 go"); buf = b""
                while True:
                    x = f.readline()
                    if x == b".\r\n": break
                    buf += x
                msg["data"] = buf; w("250 queued"); CAIXA.append(msg); msg = {"to": [], "data": b"", "auth": msg["auth"]}
            elif u == "QUIT": w("221 bye"); break
            else: w("250 ok")
        c.close()
    def laco():
        while True:
            c, _ = srv.accept(); threading.Thread(target=tratar, args=(c,), daemon=True).start()
    threading.Thread(target=laco, daemon=True).start()

PORTA_SMTP, PORTA_FLASK = _porta_livre(), _porta_livre()
os.environ["SMTP_PORT"] = str(PORTA_SMTP); os.environ["FLASK_PORT"] = str(PORTA_FLASK)
os.environ["COLETOR_BASE_URL"] = f"http://127.0.0.1:{PORTA_FLASK}"
_smtp_falso(PORTA_SMTP)

from werkzeug.serving import make_server
import app as nexus
import seguranca
from controllers import agendamento_controller as ac, automation_controller as au, maquina_controller as mc
from services import automation_store as store, agendamento_service as svc, coletor_embutido as emb

store.BASE_DIR = TMP; store.STORE_PATH = os.path.join(TMP, "automation.json"); svc.PASTA_COLETAS = os.path.join(TMP, "coletas")
EMPRESA = {"v": "Empresa A"}
for m in (ac, au, mc, seguranca):
    m.cliente_da_sessao = lambda: EMPRESA["v"]
servidor = make_server("127.0.0.1", PORTA_FLASK, nexus.app, threaded=True)
threading.Thread(target=servidor.serve_forever, daemon=True).start()

SAIDA_ORACLE = """@@META|srv-oracle|23/10/2026 20:00:00|ORCL@@
@@SECAO|2|Espaço livre em disco@@
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   20G   30G  40% /
@@SECAO|6|Tablespaces@@
TABLESPACE   TOTAL_MB   USADO_MB  PCT_LIVRE
------------ ---------- ---------- ----------
SYSTEM             800        500         37
USERS             1000        100         90
@@FIM@@
"""
_orig = emb._carregar
def _carregar():
    m = _orig()
    m.rodar_ssh = lambda host, cmd, lim: (0, SAIDA_ORACLE, "") if cmd.startswith("printf") and " -C" in cmd else (1, "", "comando inesperado")
    return m
emb._carregar = _carregar

RES = []
def t(nome, ok, det=""):
    ok = bool(ok); RES.append(ok)
    print(("  ✔ " if ok else "  ✘ ") + nome + (f"  [{det}]" if det and not ok else ""))
def J(r):
    try: return r.get_json()
    except Exception: return None
def secao(x): print(f"\n{x}")

c = nexus.app.test_client()

secao("Acesso e segurança")
t("rotas protegidas respondem 401 sem login", c.get("/api/fluxos").status_code == 401)
t("endpoint do coletor recusa chave errada (401)", c.get("/api/n8n/agendamentos/devidos").status_code == 401)
with c.session_transaction() as s: s["usuario_id"] = 1
t("telemetria do servidor (CPU/RAM/uptime via psutil)", J(c.get("/api/sistema/status")).get("status") == "success")

secao("Conectores de dados e validação")
r = c.post("/api/conectores", json={"nome": "API X", "tipo": "api", "url": "http://x"}); cid = (J(r) or {}).get("item", {}).get("id")
t("cadastrar conector", r.status_code == 201)
t("conector inválido é recusado com os motivos", c.post("/api/conectores", json={"nome": "", "tipo": "sql", "url": ""}).status_code == 400)
t("validar conector (confere os campos)", J(c.post(f"/api/conectores/{cid}/validar"))["valido"])
j = J(c.post("/api/conectores/validar-dados", json={"linhas": [{"a": 1, "b": ""}, {"a": 1, "b": ""}, {"a": 5, "b": 2}], "obrigatorios": ["b"], "intervalos": {"a": {"max": 3}}}))
t("validar dados: obrigatório, duplicidade e intervalo", {e["tipo"] for e in j["erros"]} >= {"obrigatorio", "duplicidade", "intervalo"})

secao("Fluxos e relatórios em PDF")
r = c.post("/api/fluxos", json={"nome": "Fluxo 1", "conector_id": cid}); fid = (J(r) or {}).get("item", {}).get("id")
t("cadastrar fluxo", r.status_code == 201)
r = c.get(f"/api/fluxos/{fid}/pdf"); t("PDF do fluxo", r.status_code == 200 and r.data[:4] == b"%PDF")
r = c.post("/api/relatorios/pdf", json={"titulo": "Teste", "dados": [{"nome": "a", "status": "ok"}], "filtros": {}})
t("relatório PDF personalizado", r.status_code == 200 and r.data[:4] == b"%PDF")
t("excluir fluxo", c.delete(f"/api/fluxos/{fid}").status_code == 200)

secao("Máquinas (Conectores de Dados)")
r = c.post("/api/maquinas", json={"nome": "BANCO-1", "tipo": "banco", "endereco": "10.0.0.5", "instancia": "orcl"}); mid = (J(r) or {}).get("item", {}).get("id")
t("cadastrar máquina/banco", r.status_code == 201)
t("nome duplicado é recusado", c.post("/api/maquinas", json={"nome": "banco-1", "tipo": "linux", "endereco": "1.1.1.1"}).status_code == 400)
t("editar instância (SID)", J(c.patch(f"/api/maquinas/{mid}", json={"instancia": "prod1"}))["item"]["instancia"] == "PROD1")
j = J(c.post(f"/api/maquinas/{mid}/validar"))
t("validar sem Zabbix configurado explica o motivo", j["valido"] is False and "Zabbix" in j["message"])

secao("Isolamento entre empresas")
EMPRESA["v"] = "Empresa B"
t("máquinas de A invisíveis para B", J(c.get("/api/maquinas"))["itens"] == [])
t("conectores de A invisíveis para B", J(c.get("/api/conectores"))["itens"] == [])
t("fluxos de A invisíveis para B", J(c.get("/api/fluxos"))["itens"] == [])
t("logs de A invisíveis para B", J(c.get("/api/governanca/logs"))["itens"] == [])
t("B não consegue validar/excluir conector de A", c.post(f"/api/conectores/{cid}/validar").status_code == 404 and c.delete(f"/api/conectores/{cid}").status_code == 404)
t("B não consegue criar fluxo usando conector de A", c.post("/api/fluxos", json={"nome": "X", "conector_id": cid}).status_code == 400)
EMPRESA["v"] = "Empresa A"
t("A continua vendo os próprios dados", len(J(c.get("/api/conectores"))["itens"]) == 1 and len(J(c.get("/api/governanca/logs"))["itens"]) >= 3)

secao("Agendamento de relatórios")
base = dict(nome="Rel", maquina_id=mid, instancia="PROD1", usuario_banco="system", senha_banco="s3nha", destinatarios="a@b.com", hora="07:30", secoes=[2, 6])
j = J(c.post("/api/agendamentos/previa", json=dict(frequencia="semanal", hora="07:30", dias_semana=[0, 2], secoes=[2], nome="n")))
t("prévia mostra as 3 próximas execuções", len(j["proximas"]) == 3)
ultimo = None
for freq, extra in [("diaria", {}), ("semanal", {"dias_semana": [1, 3]}), ("intervalo", {"intervalo_dias": 3}), ("mensal", {"dia_mes": 31})]:
    r = c.post("/api/agendamentos", json=dict(base, frequencia=freq, **extra)); t(f"agendar: {freq}", r.status_code == 201, J(r))
    if r.status_code == 201: ultimo = J(r)["item"]["id"]
t("e-mail inválido é recusado", c.post("/api/agendamentos", json=dict(base, frequencia="diaria", destinatarios="invalido")).status_code == 400)
t("data no passado é recusada", c.post("/api/agendamentos", json=dict(base, frequencia="unica", data_inicio="2020-01-01")).status_code == 400)
t("pausar", J(c.patch(f"/api/agendamentos/{ultimo}", json={"ativo": False}))["item"]["proxima_execucao"] is None)
t("reativar", bool(J(c.patch(f"/api/agendamentos/{ultimo}", json={"ativo": True}))["item"]["proxima_execucao"]))
t("a senha do banco nunca volta para a tela", "s3nha" not in json.dumps(J(c.get("/api/agendamentos"))))
t("excluir agendamento", c.delete(f"/api/agendamentos/{ultimo}").status_code == 200)
for a in store.all_items("schedules"): store.remove("schedules", a["id"])

secao("Envio do relatório por e-mail (SSH e SMTP simulados)")
r = c.post("/api/agendamentos", json=dict(base, nome="Envio", frequencia="diaria", destinatarios="ti@empresa.com, gestor@empresa.com",
                                          executar_agora=True, assunto="Rel {instancia} {data}", mensagem="Olá"))
rid = (J(r) or {}).get("item", {}).get("id")
t("pedir 'Executar agora' pela tela", r.status_code == 201, J(r))
emb.iniciar_thread()
for _ in range(40):
    time.sleep(1)
    it = store.get("schedules", rid) or {}
    if it.get("ultimo_status"): break
t("coletor embutido processou e a tela mostra 'sucesso'", it.get("ultimo_status") == "sucesso", it.get("ultimo_detalhe"))
t("exatamente 1 e-mail chegou ao servidor SMTP", len(CAIXA) == 1, len(CAIXA))
if CAIXA:
    msg = email.message_from_bytes(CAIXA[0]["data"])
    t("login SMTP com a senha de app (espaços removidos)", CAIXA[0]["auth"] == [b"remetente@teste.com", b"abcdefghijklmnop"])
    t("os dois destinatários receberam", CAIXA[0]["to"] == ["<ti@empresa.com>", "<gestor@empresa.com>"])
    t("assunto personalizado com {instancia} e {data}", re.fullmatch(r"Rel PROD1 \d\d/\d\d/\d{4}", msg["Subject"] or ""), msg["Subject"])
    pdfs = [p for p in msg.walk() if p.get_content_type() == "application/pdf"]
    pdf = pdfs[0].get_payload(decode=True) if pdfs else b""
    t("PDF anexado e válido", pdf[:4] == b"%PDF" and len(pdf) > 5000)
t("log 'agendamento.enviado' gravado para a empresa", any(l["evento"] == "agendamento.enviado" and l["cliente"] == "Empresa A" for l in store.all_items("logs")))

secao("Migração automática do banco (conexão MySQL simulada)")
import mysql.connector as mc_
from database import migracao
EST = {"cols": {"id", "ip_maquina", "ip_banco", "tipo_alerta", "status_alerta", "contexto", "horario", "origem"},
       "nulos": {"ip_maquina": "NO", "ip_banco": "NO"}, "idx": False, "sql": []}
class Cur:
    rowcount = 0
    def execute(self, q, p=None):
        q = " ".join(q.split()); self.q, self.p = q, p
        if not q.startswith("SELECT"): EST["sql"].append(q)
        m = re.match(r"ALTER TABLE alerta ADD COLUMN (\w+)", q)
        if m: EST["cols"].add(m.group(1))
        m = re.match(r"ALTER TABLE alerta MODIFY (\w+)", q)
        if m: EST["nulos"][m.group(1)] = "YES"
        if q.startswith("CREATE INDEX idx_alerta_cliente"): EST["idx"] = True
    def fetchone(self):
        q = self.q
        if "IS_NULLABLE" in q: return (EST["nulos"][self.p[1]],)
        if "information_schema.TABLES" in q: return (1,)
        if "information_schema.COLUMNS" in q: return (1 if (self.p[1] != "alerta" or self.p[2] in EST["cols"]) else 0,)
        if "TABLE_CONSTRAINTS" in q: return (1,)
        if "STATISTICS" in q: return (1 if EST["idx"] else 0,)
        return (0,)
    def close(self): pass
class Con:
    def cursor(self, *a, **k): return Cur()
    def commit(self): pass
    def close(self): pass
original = migracao.mysql.connector.connect
migracao.mysql.connector.connect = lambda **k: Con()
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    migracao.garantir_esquema()
tabelas = {re.search(r"EXISTS (\w+)", q).group(1) for q in EST["sql"] if q.startswith("CREATE TABLE")}
t("cria as tabelas tarefa e alerta_tarefa", {"tarefa", "alerta_tarefa"} <= tabelas)
precisa = {"cliente", "severidade", "verificado", "zabbix_eventid", "zabbix_pendente", "observacao_verificacao"}
t("acrescenta as colunas que faltavam em alerta", precisa <= EST["cols"])
t("ip_maquina/ip_banco passam a aceitar vazio (alertas do Zabbix)", EST["nulos"] == {"ip_maquina": "YES", "ip_banco": "YES"})
EST["sql"].clear()
with contextlib.redirect_stdout(io.StringIO()):
    migracao.garantir_esquema()
t("rodar de novo não repete nenhuma alteração", not [q for q in EST["sql"] if q.startswith(("ALTER", "CREATE INDEX"))])
migracao.mysql.connector.connect = original

ok = sum(RES)
print(f"\n{ok}/{len(RES)} verificações passaram.")
sys.exit(0 if ok == len(RES) else 1)
