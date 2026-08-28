from flask import Blueprint, request, jsonify

from database import get_db_connection
from repositories.alerta_repository import AlertaRepository
from services.dashboard_service import DashboardService
from services.relatorio_suporte_service import RelatorioSuporteService
from seguranca import login_obrigatorio

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


_controller = AlertaController()
alerta_bp.add_url_rule("/dashboard", view_func=login_obrigatorio(_controller.dashboard), methods=["GET"])
alerta_bp.add_url_rule(
    "/relatorio-suporte",
    view_func=login_obrigatorio(_controller.relatorio_suporte),
    methods=["GET"],
)
