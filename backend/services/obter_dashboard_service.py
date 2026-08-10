class ObterDashboardService:
    def __init__(self, alerta_repository):
        self.alerta_repo = alerta_repository

    def executar(self, tipo_alerta=None, cpu_limite=80.0):
        alertas = self.alerta_repo.buscar_alertas_detalhados(tipo_alerta)
        maquinas_criticas = self.alerta_repo.listar_maquinas_criticas(cpu_limite)

        return {
            "total_alertas": len(alertas),
            "alertas": alertas,
            "maquinas_criticas": maquinas_criticas
        }
