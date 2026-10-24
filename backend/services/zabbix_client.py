"""Cliente JSON-RPC do Zabbix (baseado no zabbix_integration.py original, reforçado).

- Aceita API token (recomendado) ou usuário/senha.
- Detecta a versão: até 6.2 manda "auth" no corpo e loga com "user";
  a partir da 6.4 usa "Authorization: Bearer" e loga com "username".
- Tem timeout, relogin automático e levanta ZabbixErro (nunca imprime/engole erro).
"""
import requests

class ZabbixErro(Exception):
    pass

class ZabbixClient:
    def __init__(self, url, token="", usuario="", senha="", timeout=15, verificar_ssl=True):
        self.url = url
        self.token = token or ""
        self.usuario = usuario
        self.senha = senha
        self.timeout = timeout
        self.sessao = requests.Session()
        self.sessao.verify = verificar_ssl
        self._versao = None
        self._auth = self.token or None
        self._id = 0

    def _post(self, metodo, params, com_auth=True):
        self._id += 1
        corpo = {"jsonrpc": "2.0", "method": metodo, "params": params, "id": self._id}
        cabecalhos = {"Content-Type": "application/json-rpc"}
        if com_auth and self._auth:
            if self._usa_bearer():
                cabecalhos["Authorization"] = f"Bearer {self._auth}"
            else:
                corpo["auth"] = self._auth
        try:
            resp = self.sessao.post(self.url, json=corpo, headers=cabecalhos, timeout=self.timeout)
            resp.raise_for_status()
            dados = resp.json()
        except requests.RequestException as erro:
            raise ZabbixErro(f"Não foi possível falar com o Zabbix: {erro}") from erro
        except ValueError as erro:
            raise ZabbixErro("Resposta do Zabbix não é JSON (confira ZABBIX_URL).") from erro
        if "error" in dados:
            e = dados["error"]
            raise ZabbixErro(f"{e.get('message', 'Erro')}: {e.get('data', '')}".strip(": "))
        return dados.get("result")

    def _usa_bearer(self):
        v = self.versao()
        return v >= (6, 4)

    def versao(self):
        if self._versao is None:
            texto = self._post("apiinfo.version", [], com_auth=False)
            partes = (texto or "0.0").split(".")
            self._versao = (int(partes[0]), int(partes[1]) if len(partes) > 1 and partes[1].isdigit() else 0)
            self.versao_texto = texto
        return self._versao

    def login(self):
        if self.token:
            self._auth = self.token
            return
        campo = "username" if self.versao() >= (5, 4) else "user"
        self._auth = None
        self._auth = self._post("user.login", {campo: self.usuario, "password": self.senha}, com_auth=False)

    def chamar(self, metodo, params):
        if not self._auth:
            self.login()
        try:
            return self._post(metodo, params)
        except ZabbixErro as erro:
            if not self.token and any(t in str(erro).lower() for t in ("re-login", "session terminated", "not authorised", "not authorized")):
                self._auth = None
                self.login()
                return self._post(metodo, params)
            raise

    def problemas_ativos(self, limite=500):
        return self.chamar("problem.get", {
            "output": "extend", "selectAcknowledges": "extend",
            "sortfield": ["eventid"], "sortorder": "DESC", "limit": limite,
        })

    def eventos(self, ids):
        if not ids:
            return []
        return self.chamar("event.get", {
            "eventids": list(ids), "output": ["eventid", "name", "severity", "acknowledged", "r_eventid", "clock"],
            "selectHosts": ["hostid", "host", "name"], "selectAcknowledges": "extend",
        })

    def ips_dos_hosts(self, hostids):
        if not hostids:
            return {}
        hosts = self.chamar("host.get", {"hostids": list(hostids), "output": ["hostid"], "selectInterfaces": ["ip"]})
        return {h["hostid"]: [i.get("ip") for i in h.get("interfaces", []) if i.get("ip")] for h in hosts}

    def reconhecer(self, eventid, mensagem):
        """Reconhece (2) + comenta (4) o evento."""
        return self.chamar("event.acknowledge", {"eventids": [str(eventid)], "action": 6, "message": mensagem[:2000]})

    def testar(self):
        self.versao()
        self.login()
        return getattr(self, "versao_texto", "")
