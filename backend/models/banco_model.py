class BancoModel:
    def __init__(self, id=None, ip=None, status_zabbix=None, status_olvm=None, log_erro=None, consumo_memoria=None):
        self.id = id
        self.ip = ip
        self.status_zabbix = status_zabbix
        self.status_olvm = status_olvm
        self.log_erro = log_erro
        self.consumo_memoria = consumo_memoria

    def to_dict(self):
        return {
            "id": self.id,
            "ip": self.ip,
            "status_zabbix": self.status_zabbix,
            "status_olvm": self.status_olvm,
            "log_erro": self.log_erro,
            "consumo_memoria": float(self.consumo_memoria) if self.consumo_memoria is not None else None
        }