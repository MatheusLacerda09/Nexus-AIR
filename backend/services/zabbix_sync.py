"""Sincronização de alertas Nexus Air <-> Zabbix.

Zabbix -> Nexus (a cada ZABBIX_INTERVALO s):
  * problema novo vira alerta (origem "zabbix", ligado pelo id do evento);
  * severidade/título mudados lá são atualizados aqui;
  * problema reconhecido (ack) no Zabbix  -> alerta verificado aqui;
  * problema resolvido no Zabbix          -> alerta verificado aqui (estado "resolvido").
Nexus -> Zabbix:
  * alerta do Zabbix verificado no Nexus -> event.acknowledge (ack + comentário) lá.
    Se o Zabbix estiver fora do ar, fica marcado (zabbix_pendente) e é reenviado.
"""
import threading
from datetime import datetime

from config import Config
from database import get_db_connection
from services.zabbix_client import ZabbixClient, ZabbixErro

SEV = {"0": "baixa", "1": "baixa", "2": "media", "3": "media", "4": "alta", "5": "critica"}
_trava = threading.Lock()
estado = {"ultima_sincronizacao": None, "ultimo_erro": None, "versao": None, "importados": 0, "enviados": 0}

def _cliente_zabbix():
    return ZabbixClient(Config.ZABBIX_URL, Config.ZABBIX_TOKEN, Config.ZABBIX_USER,
                        Config.ZABBIX_PASSWORD, Config.ZABBIX_TIMEOUT, Config.ZABBIX_VERIFY_SSL)

def _cortar(texto, n):
    texto = (texto or "").strip()
    return texto if len(texto) <= n else texto[: n - 1] + "…"

def _quem_reconheceu(acks):
    """Último reconhecimento (ação ack=2) -> (usuário, mensagem)."""
    escolhido = None
    for a in acks or []:
        if int(a.get("action", 0)) & 2:
            if escolhido is None or int(a.get("clock", 0)) >= int(escolhido.get("clock", 0)):
                escolhido = a
    if not escolhido:
        return "Zabbix", None
    nome = escolhido.get("username") or " ".join(filter(None, [escolhido.get("name"), escolhido.get("surname")])) \
        or f"usuário {escolhido.get('userid', '?')}"
    return _cortar(f"{nome} (Zabbix)", 100), (escolhido.get("message") or None)

def _mapear_ips(cur, ips):
    """IPs do host no Zabbix -> (ip_maquina, ip_banco) conhecidos no Nexus."""
    maq = banco = None
    for ip in ips:
        if not maq:
            cur.execute("SELECT ip FROM maquinas_virtuais WHERE ip = %s", [ip])
            if cur.fetchone():
                maq = ip
        if not banco:
            cur.execute("SELECT ip FROM banco WHERE ip = %s", [ip])
            if cur.fetchone():
                banco = ip
    return maq, banco

def _verificar_local(cur, alerta_id, por, obs, quando, estado_zbx=None):
    cur.execute(
        "UPDATE alerta SET verificado = 1, verificado_por = %s, verificado_em = %s, "
        "observacao_verificacao = %s, zabbix_pendente = 0 WHERE id = %s AND verificado = 0",
        [por, quando, _cortar(obs, 500) or None, alerta_id])

def _puxar(db, zbx):
    cliente = Config.ZABBIX_CLIENTE
    agora = datetime.now().replace(microsecond=0)
    cur = db.cursor(dictionary=True)
    problemas = zbx.problemas_ativos(Config.ZABBIX_LIMITE)
    ids_ativos = {p["eventid"] for p in problemas}

    eventos = {e["eventid"]: e for e in zbx.eventos(ids_ativos)}
    hostids = {h["hostid"] for e in eventos.values() for h in e.get("hosts", [])}
    ips_por_host = zbx.ips_dos_hosts(hostids)

    importados = 0
    for p in problemas:
        eid = p["eventid"]
        ev = eventos.get(eid, {})
        hosts = ev.get("hosts") or []
        host_nome = _cortar((hosts[0].get("name") or hosts[0].get("host")) if hosts else "", 150)
        ips = [ip for h in hosts for ip in ips_por_host.get(h["hostid"], [])]
        sev = SEV.get(str(p.get("severity", "3")), "media")
        titulo = _cortar(p.get("name"), 200)
        ack = str(p.get("acknowledged", "0")) == "1"

        cur.execute("SELECT id, verificado, severidade, status_alerta FROM alerta WHERE cliente = %s AND zabbix_eventid = %s",
                    [cliente, eid])
        existente = cur.fetchone()
        if not existente:
            maq, banco = _mapear_ips(db.cursor(), ips)
            quando = datetime.fromtimestamp(int(p.get("clock", 0))) if p.get("clock") else agora
            cur.execute(
                "INSERT INTO alerta (cliente, ip_maquina, ip_banco, tipo_alerta, status_alerta, contexto, horario, origem, "
                "severidade, descricao, recomendacao, criado_por, verificado, zabbix_eventid, zabbix_estado, zabbix_host) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,'zabbix',%s,%s,%s,'Zabbix',0,%s,'problema',%s)",
                [cliente, maq, banco, "Alerta Zabbix", titulo, host_nome or None, quando, sev,
                 _cortar(f"Problema detectado pelo Zabbix no host {host_nome or 'desconhecido'} (evento {eid}).", 500),
                 "Investigue a causa. Ao verificar aqui, o evento é reconhecido no Zabbix automaticamente (e vice-versa).",
                 eid, host_nome or None])
            novo_id = cur.lastrowid
            importados += 1
            if ack:
                por, msg = _quem_reconheceu(p.get("acknowledges"))
                _verificar_local(cur, novo_id, por, msg or "Reconhecido no Zabbix", agora)
        else:
            if existente["severidade"] != sev or existente["status_alerta"] != titulo:
                cur.execute("UPDATE alerta SET severidade = %s, status_alerta = %s WHERE id = %s", [sev, titulo, existente["id"]])
            if ack and not existente["verificado"]:
                por, msg = _quem_reconheceu(p.get("acknowledges"))
                _verificar_local(cur, existente["id"], por, msg or "Reconhecido no Zabbix", agora)

    cur.execute("SELECT id, zabbix_eventid, verificado FROM alerta WHERE cliente = %s AND zabbix_estado = 'problema'", [cliente])
    sumiram = [r for r in cur.fetchall() if r["zabbix_eventid"] not in ids_ativos]
    if sumiram:
        achados = {e["eventid"]: e for e in zbx.eventos([r["zabbix_eventid"] for r in sumiram])}
        for r in sumiram:
            e = achados.get(r["zabbix_eventid"])
            if e is None:
                continue
            if str(e.get("r_eventid", "0")) != "0":
                cur.execute("UPDATE alerta SET zabbix_estado = 'resolvido' WHERE id = %s", [r["id"]])
                if not r["verificado"]:
                    _verificar_local(cur, r["id"], "Zabbix", "Problema resolvido no Zabbix.", agora)
    db.commit()
    cur.close()
    return importados

def _empurrar(db, zbx):
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT id, zabbix_eventid, verificado_por, observacao_verificacao FROM alerta "
                "WHERE zabbix_pendente = 1 AND zabbix_eventid IS NOT NULL AND verificado = 1")
    enviados = 0
    for r in cur.fetchall():
        msg = f"Verificado no Nexus Air por {r['verificado_por'] or 'usuário'}"
        if r["observacao_verificacao"]:
            msg += f": {r['observacao_verificacao']}"
        try:
            zbx.reconhecer(r["zabbix_eventid"], msg)
        except ZabbixErro as erro:
            if "already" in str(erro).lower() or "no permissions" in str(erro).lower():
                pass
            else:
                raise
        c2 = db.cursor()
        c2.execute("UPDATE alerta SET zabbix_pendente = 0 WHERE id = %s", [r["id"]])
        c2.close()
        enviados += 1
    db.commit()
    cur.close()
    return enviados

def sincronizar():
    """Um ciclo completo. Retorna dict com o resumo; levanta ZabbixErro se o Zabbix falhar."""
    if not Config.zabbix_ativo():
        raise ZabbixErro("Integração desligada: defina ZABBIX_URL e ZABBIX_TOKEN (ou ZABBIX_USER/ZABBIX_PASSWORD).")
    with _trava:
        db = get_db_connection()
        try:
            zbx = _cliente_zabbix()
            try:

                enviados = _empurrar(db, zbx)
                importados = _puxar(db, zbx)
                estado.update(versao=getattr(zbx, "versao_texto", None), ultimo_erro=None,
                              ultima_sincronizacao=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                              importados=importados, enviados=enviados)
                return {"importados": importados, "enviados": enviados}
            except ZabbixErro as erro:
                estado["ultimo_erro"] = str(erro)
                raise
        finally:
            db.close()

def empurrar_em_segundo_plano():
    """Chamado ao verificar um alerta: não deixa a tela esperando o Zabbix."""
    if not Config.zabbix_ativo():
        return

    def _rodar():
        try:
            sincronizar()
        except Exception as erro:
            print(f"[Zabbix] envio adiado (tenta no próximo ciclo): {erro}")
    threading.Thread(target=_rodar, daemon=True).start()

def iniciar_thread():
    if not Config.zabbix_ativo():
        print("[Zabbix] Integração desligada (ZABBIX_URL/credenciais não definidos).")
        return

    def _laco():
        import time
        while True:
            try:
                r = sincronizar()
                if r["importados"] or r["enviados"]:
                    print(f"[Zabbix] sincronizado: {r['importados']} novo(s), {r['enviados']} enviado(s).")
            except Exception as erro:
                print(f"[Zabbix] falha na sincronização: {erro}")
            time.sleep(Config.ZABBIX_INTERVALO)
    threading.Thread(target=_laco, name="zabbix-sync", daemon=True).start()
    print(f"[Zabbix] Sincronizando a cada {Config.ZABBIX_INTERVALO}s com {Config.ZABBIX_URL}")
