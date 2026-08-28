class RelatorioSuporteService:
    """Regra de negocio do relatorio de resolucao de suporte."""

    def __init__(self, alerta_repository):
        self.alerta_repo = alerta_repository

    def executar(self, id_suporte=None):
        return self.alerta_repo.relatorio_resolucao_suporte(id_suporte)
