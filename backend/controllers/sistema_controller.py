from flask import Blueprint, jsonify

from services.sistema_service import SistemaService
from seguranca import login_obrigatorio

sistema_bp = Blueprint("sistema", __name__, url_prefix="/api/sistema")


class SistemaController:
    """Controller (classe) da rota de status de sistema (CPU/uptime)."""

    def __init__(self):
        self.service = SistemaService()

    def status(self):
        try:
            dados = self.service.obter_status()
            return jsonify({"status": "success", "data": dados}), 200
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500


_controller = SistemaController()
sistema_bp.add_url_rule("/status", view_func=login_obrigatorio(_controller.status), methods=["GET"])
