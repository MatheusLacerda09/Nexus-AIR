from flask import Blueprint, request, jsonify, session

from database import get_db_connection
from repositories.alerta_repository import AlertaRepository, CentralAlertasRepository
from services.central_alertas_service import AlertaInvalido, AlertaNaoEncontrado, CentralAlertasService
from services.dashboard_service import DashboardService
from services.relatorio_suporte_service import RelatorioSuporteService
from seguranca import login_obrigatorio, cliente_da_sessao, usuario_da_sessao

alerta_bp = Blueprint("alertas", __name__, url_prefix="/api/alertas")

class AlertaController:

    def dashboard(self):
        tipo_alerta = request.args.get("tipo", None)
        cpu_limite = request.args.get("cpu_limite", default=80.0, type=float)

        conexao = get_db_connection()
        try:
            repositorio = AlertaRepository(conexao)
            servico = DashboardService(repositorio)
            dados = servico.executar(tipo_alerta, cpu_limite)
            return jsonify(dados), 200
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500
        finally:
            conexao.close()

    def relatorio_suporte(self):
        id_suporte = request.args.get("id_suporte", type=int)

        conexao = get_db_connection()
        try:
            repositorio = AlertaRepository(conexao)
            servico = RelatorioSuporteService(repositorio)
            resultados = servico.executar(id_suporte)
            return jsonify(resultados), 200
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500
        finally:
            conexao.close()

    @staticmethod
    def _nome_do_usuario():
        usuario = usuario_da_sessao()
        return (usuario.nome if usuario else None) or "Usuário"

    @staticmethod
    def _executar(acao, sucesso=200):
        conexao = get_db_connection()
        try:
            servico = CentralAlertasService(CentralAlertasRepository(conexao))
            return jsonify(acao(servico, cliente_da_sessao())), sucesso
        except AlertaInvalido as erro:
            return jsonify({"status": "error", "message": erro.erros[0], "errors": erro.erros}), 400
        except AlertaNaoEncontrado:
            return jsonify({"status": "error", "message": "Alerta não encontrado."}), 404
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500
        finally:
            conexao.close()

    def listar(self):
        status = request.args.get("status", "pendente")
        return self._executar(lambda servico, cliente: servico.listar(cliente, status))

    def opcoes(self):
        return self._executar(lambda servico, cliente: servico.opcoes(cliente))

    def detalhar(self, alerta_ref):
        return self._executar(lambda servico, cliente: {"alerta": servico.detalhar(alerta_ref, cliente)})

    def criar(self):
        dados = request.get_json(silent=True) or {}
        nome = self._nome_do_usuario()
        return self._executar(lambda servico, cliente: {"alerta": servico.criar(dados, nome, cliente)}, 201)

    def verificar(self, alerta_ref):
        dados = request.get_json(silent=True) or {}
        nome = self._nome_do_usuario()
        return self._executar(
            lambda servico, cliente: {"alerta": servico.verificar(alerta_ref, nome, dados.get("observacao"), cliente)}
        )

_controller = AlertaController()
alerta_bp.add_url_rule("/dashboard", view_func=login_obrigatorio(_controller.dashboard), methods=["GET"])
alerta_bp.add_url_rule(
    "/relatorio-suporte",
    view_func=login_obrigatorio(_controller.relatorio_suporte),
    methods=["GET"],
)

alerta_bp.add_url_rule("", view_func=login_obrigatorio(_controller.listar), methods=["GET"])
alerta_bp.add_url_rule("", view_func=login_obrigatorio(_controller.criar), methods=["POST"], endpoint="criar")
alerta_bp.add_url_rule("/opcoes", view_func=login_obrigatorio(_controller.opcoes), methods=["GET"])
alerta_bp.add_url_rule("/<alerta_ref>", view_func=login_obrigatorio(_controller.detalhar), methods=["GET"], endpoint="detalhar")
alerta_bp.add_url_rule(
    "/<alerta_ref>/verificar",
    view_func=login_obrigatorio(_controller.verificar),
    methods=["POST"],
    endpoint="verificar",
)
