class MaquinaVirtualModel:
    def __init__(self, id=None, hostname=None, ip=None, status_olvm=None, consumo_cpu=None, consumo_ram=None, status_zabbix=None):
        self.id = id
        self.hostname = hostname
        self.ip = ip
        self.status_olvm = status_olvm
        self.consumo_cpu = consumo_cpu
        self.consumo_ram = consumo_ram
        self.status_zabbix = status_zabbix

    def to_dict(self):
        return {
            "id": self.id,
            "hostname": self.hostname,
            "ip": self.ip,
            "status_olvm": self.status_olvm,
            "consumo_cpu": float(self.consumo_cpu) if self.consumo_cpu is not None else None,
            "consumo_ram": float(self.consumo_ram) if self.consumo_ram is not None else None,
            "status_zabbix": self.status_zabbix
        }