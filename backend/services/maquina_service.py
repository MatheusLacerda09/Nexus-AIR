"""Máquinas cadastradas no Nexus Air e leitura das métricas delas no Zabbix.

- As máquinas ficam no armazenamento de automação (data/automation.json), na lista "maquinas",
  sempre separadas por empresa (campo "cliente").
- O servidor Zabbix é o configurado no .env (ZABBIX_URL + credencial). Aqui só
  localizamos o host (pelo nome no Zabbix ou pelo IP) e lemos os itens dele (CPU, RAM, uptime).
- Devolve as métricas no mesmo formato de /api/sistema/status, então o dashboard
  desenha os mesmos cards para qualquer máquina.
"""
import threading
import time
from datetime import datetime, timezone

from config import Config
from services.zabbix_client import ZabbixClient, ZabbixErro

import re

TIPOS = {"linux", "windows", "banco", "outro"}
SID_VALIDO = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,29}$")
CACHE_SEGUNDOS = 10

_trava = threading.Lock()
_cliente = {"chave": None, "obj": None}
_cache_metricas = {}

def _chave_config():
    return (Config.ZABBIX_URL, Config.ZABBIX_TOKEN, Config.ZABBIX_USER, Config.ZABBIX_PASSWORD)

def cliente_zabbix():
    """Um cliente reaproveitado (evita logar e checar versão a cada chamada)."""
    if not Config.zabbix_ativo():
        raise ZabbixErro("Zabbix desligado: defina ZABBIX_URL e ZABBIX_TOKEN (ou ZABBIX_USER/ZABBIX_PASSWORD) no backend/.env.")
    with _trava:
        if _cliente["chave"] != _chave_config():
            _cliente["obj"] = ZabbixClient(Config.ZABBIX_URL, Config.ZABBIX_TOKEN, Config.ZABBIX_USER,
                                           Config.ZABBIX_PASSWORD, Config.ZABBIX_TIMEOUT, Config.ZABBIX_VERIFY_SSL)
            _cliente["chave"] = _chave_config()
        return _cliente["obj"]

def listar_hosts_zabbix():
    zbx = cliente_zabbix()
    hosts = zbx.chamar("host.get", {
        "output": ["hostid", "host", "name", "status"],
        "selectInterfaces": ["ip", "dns"],
        "sortfield": "name", "limit": 1000,
    }) or []
    saida = []
    for h in hosts:
        ips = [i.get("ip") for i in h.get("interfaces", []) if i.get("ip") and i.get("ip") != "0.0.0.0"]
        saida.append({
            "hostid": h["hostid"], "host": h.get("host"), "nome": h.get("name") or h.get("host"),
            "ip": ips[0] if ips else "", "ativo": str(h.get("status", "0")) == "0",
        })
    return saida

def localizar_host(zbx, maquina):
    """Acha o host no Zabbix: nome técnico/visível informado, depois IP ou DNS."""
    campos = ["hostid", "host", "name", "status"]
    nome = (maquina.get("host_zabbix") or "").strip()
    endereco = (maquina.get("endereco") or "").strip()

    if nome:
        for filtro in ({"host": [nome]}, {"name": [nome]}):
            achados = zbx.chamar("host.get", {"output": campos, "filter": filtro, "limit": 1}) or []
            if achados:
                return achados[0]
    for filtro in ({"ip": [endereco]}, {"dns": [endereco]}) if endereco else ():
        interfaces = zbx.chamar("hostinterface.get", {"output": ["hostid"], "filter": filtro, "limit": 1}) or []
        if interfaces:
            achados = zbx.chamar("host.get", {"output": campos, "hostids": [interfaces[0]["hostid"]]}) or []
            if achados:
                return achados[0]
    return None

def _numero(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None

def _interpretar_itens(itens):
    valores = {i["key_"]: _numero(i.get("lastvalue")) for i in itens if _numero(i.get("lastvalue")) is not None}
    agora = time.time()

    def chave(*opcoes):
        for o in opcoes:
            if valores.get(o) is not None:
                return valores[o]
        return None

    nucleos = chave("system.cpu.num")
    cpu = chave("system.cpu.util")
    if cpu is None:
        idle = next((v for k, v in valores.items() if k.startswith("system.cpu.util[") and "idle" in k), None)
        cpu = 100 - idle if idle is not None else None
    if cpu is None:
        cpu = next((v for k, v in valores.items()
                    if "processor" in k.lower() and ("utility" in k.lower() or "% processor time" in k.lower())), None)
    if cpu is None:
        carga = next((v for k, v in valores.items() if k.startswith("system.cpu.load")), None)
        if carga is not None and nucleos:
            cpu = carga / nucleos * 100
    cpu = None if cpu is None else max(0.0, min(100.0, cpu))

    total = chave("vm.memory.size[total]")
    disponivel = chave("vm.memory.size[available]")
    pct_ram = chave("vm.memory.utilization", "vm.memory.util")
    if total and disponivel is not None:
        usada = total - disponivel
        pct_ram = usada / total * 100
    elif total and pct_ram is not None:
        disponivel = total * (1 - pct_ram / 100)
        usada = total - disponivel
    else:
        usada = None

    uptime = chave("system.uptime")
    if uptime is None:
        boot = chave("system.boottime")
        uptime = agora - boot if boot else None

    freq = chave("system.cpu.freq")
    ghz = round(freq / 1e9, 2) if freq and freq > 1e6 else (round(freq, 2) if freq else None)

    avisos = []
    if cpu is None:
        avisos.append("sem item de CPU")
    if pct_ram is None:
        avisos.append("sem item de memória")
    if uptime is None:
        avisos.append("sem item de uptime")

    return {
        "velocidadeGHz": ghz,
        "nucleos": int(nucleos) if nucleos else None,
        "usoPercentual": round(cpu) if cpu is not None else 0,
        "livrePercentual": round(100 - cpu) if cpu is not None else 0,
        "tempoAtividadeSegundos": int(uptime) if uptime is not None else 0,
        "inicioProjetoEpoch": (agora - uptime) if uptime is not None else agora,
        "inicioAtividadeEpoch": (agora - uptime) if uptime is not None else agora,
        "ramTotalBytes": total or 0,
        "ramUsadaBytes": usada or 0,
        "ramLivreBytes": disponivel or 0,
        "ramUsoPercentual": round(pct_ram) if pct_ram is not None else 0,
        "avisos": avisos,
    }

def metricas(maquina, usar_cache=True):
    """Métricas atuais da máquina, lidas do Zabbix."""
    if usar_cache:
        guardado = _cache_metricas.get(maquina["id"])
        if guardado and time.time() - guardado[0] < CACHE_SEGUNDOS:
            return guardado[1]
    zbx = cliente_zabbix()
    host = localizar_host(zbx, maquina)
    if not host:
        raise ZabbixErro("Host não encontrado no Zabbix. Confira o nome do host ou o IP.")
    itens = zbx.chamar("item.get", {
        "hostids": [host["hostid"]],
        "output": ["key_", "lastvalue"],
        "search": {"key_": ["system.cpu", "vm.memory", "system.uptime", "system.boottime", "Processor"]},
        "searchByAny": True, "limit": 400,
    }) or []
    dados = _interpretar_itens(itens)
    dados["host"] = host.get("name") or host.get("host")
    dados["hostid"] = host["hostid"]
    if len(dados["avisos"]) == 3:
        raise ZabbixErro("O host existe no Zabbix, mas não tem itens de CPU, memória ou uptime (confira o template Linux/Windows).")
    _cache_metricas[maquina["id"]] = (time.time(), dados)
    return dados

def agora_iso():
    return datetime.now(timezone.utc).isoformat()
