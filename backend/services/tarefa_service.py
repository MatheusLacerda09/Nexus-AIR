from datetime import datetime, timedelta

from services.central_alertas_service import CentralAlertasService

STATUS_VALIDOS = ("Em Execução", "Parado", "Concluído")

class TarefaInvalida(Exception):
    pass

class TarefaNaoEncontrada(Exception):
    pass

def _exemplos():
    """Tarefas de exemplo que cada empresa recebe na primeira vez que abre o painel."""
    agora = datetime.now().replace(microsecond=0)
    base = [
        ("REL-00450", "Exportação API", "Em Execução", timedelta(minutes=12)),
        ("REL-00451", "Relatório", "Concluído", timedelta(minutes=70)),
        ("REL-00452", "Fechamento Mensal", "Concluído", timedelta(hours=26)),
        ("REL-00453", "Exportação API", "Concluído", timedelta(days=3)),
        ("REL-00454", "Fechamento Mensal", "Concluído", timedelta(days=12)),
        ("REL-00455", "Relatório", "Concluído", timedelta(days=45)),
    ]
    return [
        {"id": i, "tarefa": nome, "origem": "Oracle", "tempo": "4:43/5:00", "status": st, "quando": agora - atraso}
        for i, nome, st, atraso in base
    ]

def _para_json(linha):
    return {
        "id": linha["id"], "tarefa": linha["tarefa"], "origem": linha["origem"],
        "tempo": linha["tempo"], "status": linha["status"],

        "quando": int(linha["quando"].timestamp() * 1000),
    }

class TarefaService:
    """Tarefas por empresa. Concluir, interromper e EXCLUIR uma tarefa geram um
    alerta que precisa ser verificado na Central de Alertas."""

    def __init__(self, repositorio, repositorio_alertas):
        self.repo = repositorio
        self.alertas = CentralAlertasService(repositorio_alertas)

    def listar(self, cliente):
        if self.repo.contar(cliente) == 0:
            self.repo.inserir_varias(cliente, _exemplos())
        return [_para_json(l) for l in self.repo.listar(cliente)]

    def _obter(self, cliente, tarefa_id):
        linha = self.repo.buscar(cliente, tarefa_id)
        if not linha:
            raise TarefaNaoEncontrada()
        return linha

    def mudar_status(self, cliente, tarefa_id, status, por):
        if status not in STATUS_VALIDOS:
            raise TarefaInvalida("Status de tarefa inválido.")
        atual = self._obter(cliente, tarefa_id)
        anterior = atual["status"]
        self.repo.atualizar_status(cliente, tarefa_id, status)
        atual["status"] = status
        if status == "Concluído" and anterior != "Concluído":
            self.alertas.registrar_alerta_tarefa(cliente, "concluido", atual, por)
        elif status == "Parado" and anterior == "Em Execução":
            self.alertas.registrar_alerta_tarefa(cliente, "interrompido", atual, por)
        return _para_json(atual)

    def excluir(self, cliente, tarefa_id, por):
        atual = self._obter(cliente, tarefa_id)
        self.repo.excluir(cliente, tarefa_id)
        self.alertas.registrar_alerta_tarefa(cliente, "excluido", atual, por)
