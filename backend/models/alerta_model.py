class AlertaModel:
    def __init__(self, id=None, ip_maquina=None, ip_banco=None, tipo_alerta=None, status_alerta=None, contexto=None, horario=None, origem=None):
        self.id = id
        self.ip_maquina = ip_maquina
        self.ip_banco = ip_banco
        self.tipo_alerta = tipo_alerta
        self.status_alerta = status_alerta
        self.contexto = contexto
        self.horario = horario
        self.origem = origem

    def to_dict(self):
        return {
            "id": self.id,
            "ip_maquina": self.ip_maquina,
            "ip_banco": self.ip_banco,
            "tipo_alerta": self.tipo_alerta,
            "status_alerta": self.status_alerta,
            "contexto": self.contexto,
            "horario": str(self.horario) if self.horario else None,
            "origem": self.origem
        }