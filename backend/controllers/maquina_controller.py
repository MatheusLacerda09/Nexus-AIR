from flask import Blueprint, jsonify, request

from config import Config
from seguranca import cliente_da_sessao, login_obrigatorio
from services import maquina_service as svc
from services.automation_store import add_log, all_items, create, get, remove, update
from services.zabbix_client import ZabbixErro

maquina_bp = Blueprint("maquinas", __name__, url_prefix="/api/maquinas")

def _dados():
    return request.get_json(silent=True) or {}

def _publica(m):
    return {k: m.get(k) for k in ("id", "nome", "tipo", "endereco", "host_zabbix", "descricao", "status",
                                  "mensagem", "ultima_validacao", "zabbix_hostid", "instancia")}

def _da_empresa(item_id):
    m = get("maquinas", item_id)
    return m if m and m.get("cliente") == cliente_da_sessao() else None

def _validar(m):
    """Procura o host no Zabbix e grava o resultado na máquina. Devolve (ok, mensagem, máquina)."""
    try:
        host = svc.localizar_host(svc.cliente_zabbix(), m)
    except ZabbixErro as erro:
        return False, str(erro), update("maquinas", m["id"], {"status": "erro", "mensagem": str(erro), "ultima_validacao": svc.agora_iso()})
    if not host:
        msg = "Host não encontrado no Zabbix. Confira o nome do host ou o IP."
        return False, msg, update("maquinas", m["id"], {"status": "não encontrada", "mensagem": msg, "ultima_validacao": svc.agora_iso()})
    msg = f"Host \"{host.get('name') or host.get('host')}\" encontrado no Zabbix."
    return True, msg, update("maquinas", m["id"], {"status": "válida", "mensagem": msg, "zabbix_hostid": host["hostid"],
                                                    "ultima_validacao": svc.agora_iso()})

@maquina_bp.get("")
@login_obrigatorio
def listar():
    cliente = cliente_da_sessao()
    itens = [_publica(m) for m in all_items("maquinas") if m.get("cliente") == cliente]
    return jsonify({"itens": itens, "zabbix_ativo": Config.zabbix_ativo()})

@maquina_bp.post("")
@login_obrigatorio
def criar():
    d = _dados()
    nome = str(d.get("nome", "")).strip()
    endereco = str(d.get("endereco", "")).strip()
    host = str(d.get("host_zabbix", "")).strip()
    tipo = str(d.get("tipo", "linux")).lower()
    erros = []
    if not nome:
        erros.append("Informe o nome da máquina.")
    if not endereco and not host:
        erros.append("Informe o IP/endereço ou o nome do host no Zabbix.")
    if tipo not in svc.TIPOS:
        erros.append("Tipo de máquina inválido.")
    instancia = str(d.get("instancia", "")).strip().upper()
    if tipo == "banco" and instancia and not svc.SID_VALIDO.match(instancia):
        erros.append("Instância/SID inválida: use letras, números e _ (começando por letra).")
    cliente = cliente_da_sessao()
    if nome and any(m.get("cliente") == cliente and m["nome"].lower() == nome.lower() for m in all_items("maquinas")):
        erros.append("Já existe uma máquina com esse nome.")
    if erros:
        return jsonify({"status": "error", "message": erros[0], "errors": erros}), 400

    m = create("maquinas", {"cliente": cliente, "nome": nome[:80], "tipo": tipo, "endereco": endereco[:150],
                            "host_zabbix": host[:150], "instancia": instancia if tipo == "banco" else "", "descricao": str(d.get("descricao", "")).strip()[:300],
                            "status": "não validada", "mensagem": "", "ultima_validacao": None, "zabbix_hostid": None})
    add_log("maquina.criada", m["nome"])
    if Config.zabbix_ativo():
        _, _, m = _validar(m)
    return jsonify({"item": _publica(m)}), 201

@maquina_bp.patch("/<item_id>")
@login_obrigatorio
def atualizar(item_id):
    """Só a instância (SID) pode ser editada aqui: é o que o relatório agendado precisa."""
    m = _da_empresa(item_id)
    if not m:
        return jsonify({"status": "error", "message": "Máquina não encontrada."}), 404
    instancia = str(_dados().get("instancia", "")).strip().upper()
    if m.get("tipo") != "banco":
        return jsonify({"status": "error", "message": "Só bancos de dados têm instância/SID."}), 400
    if not svc.SID_VALIDO.match(instancia):
        return jsonify({"status": "error", "message": "Instância/SID inválida: use letras, números e _ (começando por letra)."}), 400
    m = update("maquinas", item_id, {"instancia": instancia})
    add_log("maquina.sid_definido", f"{m['nome']} ({instancia})")
    return jsonify({"item": _publica(m)})

@maquina_bp.delete("/<item_id>")
@login_obrigatorio
def excluir(item_id):
    m = _da_empresa(item_id)
    if not m:
        return jsonify({"status": "error", "message": "Máquina não encontrada."}), 404
    remove("maquinas", item_id)
    add_log("maquina.excluida", m["nome"])
    return jsonify({"status": "ok"})

@maquina_bp.post("/<item_id>/validar")
@login_obrigatorio
def validar(item_id):
    m = _da_empresa(item_id)
    if not m:
        return jsonify({"status": "error", "message": "Máquina não encontrada."}), 404
    ok, msg, m = _validar(m)
    add_log("maquina.validada", m["nome"], "sucesso" if ok else "erro")
    return jsonify({"valido": ok, "message": msg, "item": _publica(m)})

@maquina_bp.post("/<item_id>/conectar")
@login_obrigatorio
def conectar(item_id):
    """Valida e já lê as métricas: confirma que o Zabbix está entregando dados dessa máquina."""
    m = _da_empresa(item_id)
    if not m:
        return jsonify({"status": "error", "message": "Máquina não encontrada."}), 404
    ok, msg, m = _validar(m)
    if not ok:
        return jsonify({"conectada": False, "message": msg, "item": _publica(m)})
    try:
        dados = svc.metricas(m, usar_cache=False)
    except ZabbixErro as erro:
        m = update("maquinas", m["id"], {"status": "sem dados", "mensagem": str(erro)})
        return jsonify({"conectada": False, "message": str(erro), "item": _publica(m)})
    msg = f"Conectada: CPU {dados['usoPercentual']}% · RAM {dados['ramUsoPercentual']}%."
    m = update("maquinas", m["id"], {"status": "conectada", "mensagem": msg})
    add_log("maquina.conectada", m["nome"])
    return jsonify({"conectada": True, "message": msg, "item": _publica(m)})

@maquina_bp.get("/<item_id>/status")
@login_obrigatorio
def status(item_id):
    """Mesmo formato de /api/sistema/status, para o dashboard desenhar os cards da máquina escolhida."""
    m = _da_empresa(item_id)
    if not m:
        return jsonify({"status": "error", "message": "Máquina não encontrada."}), 404
    try:
        return jsonify({"status": "success", "data": svc.metricas(m)}), 200
    except ZabbixErro as erro:
        return jsonify({"status": "error", "message": str(erro)}), 502

@maquina_bp.get("/zabbix-hosts")
@login_obrigatorio
def hosts_zabbix():
    """Hosts existentes no Zabbix, para o usuário escolher em vez de digitar."""
    try:
        return jsonify({"itens": svc.listar_hosts_zabbix()})
    except ZabbixErro as erro:
        return jsonify({"status": "error", "message": str(erro), "itens": []}), 502
