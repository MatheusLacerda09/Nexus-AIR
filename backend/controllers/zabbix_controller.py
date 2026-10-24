from flask import Blueprint, jsonify

from config import Config
from seguranca import login_obrigatorio
from services import zabbix_sync
from services.zabbix_client import ZabbixErro

zabbix_bp = Blueprint("zabbix", __name__, url_prefix="/api/zabbix")

@zabbix_bp.get("/status")
@login_obrigatorio
def status():
    return jsonify({"ativo": Config.zabbix_ativo(), "intervalo": Config.ZABBIX_INTERVALO, **zabbix_sync.estado})

@zabbix_bp.post("/sincronizar")
@login_obrigatorio
def sincronizar():
    try:
        return jsonify({"status": "ok", **zabbix_sync.sincronizar()})
    except ZabbixErro as erro:
        return jsonify({"status": "error", "message": str(erro)}), 502
