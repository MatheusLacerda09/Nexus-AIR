from flask import Blueprint, jsonify, request

from database import get_db_connection
from repositories.alerta_repository import CentralAlertasRepository, TarefaRepository
from seguranca import login_obrigatorio, cliente_da_sessao, usuario_da_sessao
from services.central_alertas_service import AlertaInvalido
from services.tarefa_service import TarefaInvalida, TarefaNaoEncontrada, TarefaService

tarefa_bp = Blueprint("tarefas", __name__, url_prefix="/api/tarefas")

def _executar(acao):
    conexao = get_db_connection()
    try:
        servico = TarefaService(TarefaRepository(conexao), CentralAlertasRepository(conexao))
        usuario = usuario_da_sessao()
        return jsonify(acao(servico, cliente_da_sessao(), (usuario.nome if usuario else None) or "Usuário"))
    except (TarefaInvalida, AlertaInvalido) as erro:
        return jsonify({"status": "error", "message": str(erro)}), 400
    except TarefaNaoEncontrada:
        return jsonify({"status": "error", "message": "Tarefa não encontrada."}), 404
    except Exception as erro:
        return jsonify({"status": "error", "message": str(erro)}), 500
    finally:
        conexao.close()

@tarefa_bp.get("")
@login_obrigatorio
def listar():
    return _executar(lambda s, cliente, nome: {"tarefas": s.listar(cliente)})

@tarefa_bp.patch("/<tarefa_id>")
@login_obrigatorio
def mudar_status(tarefa_id):
    status = (request.get_json(silent=True) or {}).get("status")
    return _executar(lambda s, cliente, nome: {"tarefa": s.mudar_status(cliente, tarefa_id, status, nome)})

@tarefa_bp.delete("/<tarefa_id>")
@login_obrigatorio
def excluir(tarefa_id):
    def acao(s, cliente, nome):
        s.excluir(cliente, tarefa_id, nome)
        return {"status": "ok"}
    return _executar(acao)
