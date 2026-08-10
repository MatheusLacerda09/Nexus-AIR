from flask import Blueprint, jsonify, request
from repositories.alerta_repository import AlertaRepository
from services.obter_dashboard_service import ObterDashboardService
from database import get_db_connection 

alerta_bp = Blueprint('alerta', __name__, url_prefix='/api/alertas')

@alerta_bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    tipo_alerta = request.args.get('tipo', None)
    cpu_limite = request.args.get('cpu_limite', default=80.0, type=float)

    db = get_db_connection()
    repo = AlertaRepository(db)
    service = ObterDashboardService(repo)

    dados = service.executar(tipo_alerta, cpu_limite)
    db.close()

    return jsonify(dados), 200

@alerta_bp.route('/relatorio-suporte', methods=['GET'])
def get_relatorio_suporte():
    id_suporte = request.args.get('id_suporte', type=int)

    db = get_db_connection()
    repo = AlertaRepository(db)
    resultados = repo.relatorio_resolucao_suporte(id_suporte)
    db.close()

    return jsonify(resultados), 200
