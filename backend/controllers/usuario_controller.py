from flask import Blueprint, request, jsonify, session
from flask.views import MethodView

from services.usuario_service import UsuarioService
from erros import ErroDeValidacao, NaoEncontrado
from seguranca import gerente_ou_superior_obrigatorio
from models.usuario_model import UsuarioModel

usuario_bp = Blueprint("usuarios", __name__, url_prefix="/api/usuarios")

class UsuarioController(MethodView):

    decorators = [gerente_ou_superior_obrigatorio]

    def __init__(self):
        self.service = UsuarioService()

    @staticmethod
    def _cliente_da_sessao():
        usuario_id = session.get("usuario_id")
        usuario = UsuarioModel.buscar_por_id(usuario_id) if usuario_id else None
        return usuario.cliente if usuario else None

    def get(self, usuario_id=None):
        try:
            cliente = self._cliente_da_sessao()
            if usuario_id is None:
                usuarios = self.service.listar(cliente=cliente)
                return jsonify({
                    "status": "success",
                    "data": [usuario.to_dict() for usuario in usuarios],
                }), 200

            usuario = self.service.obter(usuario_id, cliente=cliente)
            return jsonify({"status": "success", "data": usuario.to_dict()}), 200
        except NaoEncontrado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 404
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def post(self):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.cadastrar(
                dados,
                permitir_tipo_acesso=True,
                cliente=self._cliente_da_sessao(),
            )
            return jsonify({
                "status": "success",
                "message": "Usuário criado com sucesso.",
                "data": usuario.to_dict(),
            }), 201
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def put(self, usuario_id):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.atualizar(
                usuario_id,
                dados,
                cliente=self._cliente_da_sessao(),
            )

            if session.get("usuario_id") == usuario.id:
                session["usuario_id"] = usuario.id

            return jsonify({
                "status": "success",
                "message": "Usuário atualizado com sucesso.",
                "data": usuario.to_dict(),
            }), 200
        except NaoEncontrado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 404
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def delete(self, usuario_id):
        try:
            self.service.remover(usuario_id, cliente=self._cliente_da_sessao())

            if session.get("usuario_id") == usuario_id:
                session.pop("usuario_id", None)

            return jsonify({"status": "success", "message": "Usuário removido com sucesso."}), 200
        except NaoEncontrado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 404
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

_view = UsuarioController.as_view("usuario_controller")
usuario_bp.add_url_rule("", view_func=_view, methods=["GET", "POST"])
usuario_bp.add_url_rule("/<int:usuario_id>", view_func=_view, methods=["GET", "PUT", "DELETE"])
