from flask import Blueprint, request, jsonify, session
from flask.views import MethodView

from services.usuario_service import UsuarioService
from erros import ErroDeValidacao, NaoEncontrado
from seguranca import login_obrigatorio

usuario_bp = Blueprint("usuarios", __name__, url_prefix="/api/usuarios")


class UsuarioController(MethodView):

    decorators = [login_obrigatorio]

    def __init__(self):
        self.service = UsuarioService()

    def get(self, usuario_id=None):
        try:
            if usuario_id is None:
                usuarios = self.service.listar()
                return jsonify({
                    "status": "success",
                    "data": [usuario.to_dict() for usuario in usuarios],
                }), 200

            usuario = self.service.obter(usuario_id)
            return jsonify({"status": "success", "data": usuario.to_dict()}), 200
        except NaoEncontrado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 404
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def post(self):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.cadastrar(dados)
            return jsonify({
                "status": "success",
                "message": "Usuario criado com sucesso.",
                "data": usuario.to_dict(),
            }), 201
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def put(self, usuario_id):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.atualizar(usuario_id, dados)

            # Se o usuario editou o proprio cadastro, mantem a sessao coerente.
            if session.get("usuario_id") == usuario.id:
                session["usuario_id"] = usuario.id

            return jsonify({
                "status": "success",
                "message": "Usuario atualizado com sucesso.",
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
            self.service.remover(usuario_id)

            if session.get("usuario_id") == usuario_id:
                session.pop("usuario_id", None)

            return jsonify({"status": "success", "message": "Usuario removido com sucesso."}), 200
        except NaoEncontrado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 404
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500


_view = UsuarioController.as_view("usuario_controller")
usuario_bp.add_url_rule("", view_func=_view, methods=["GET", "POST"])
usuario_bp.add_url_rule("/<int:usuario_id>", view_func=_view, methods=["GET", "PUT", "DELETE"])
