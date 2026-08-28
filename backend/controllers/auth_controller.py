from flask import Blueprint, request, jsonify, session

from services.usuario_service import UsuarioService
from erros import ErroDeValidacao, NaoAutenticado, NaoEncontrado

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


class AuthController:

    def __init__(self):
        self.service = UsuarioService()

    def cadastro(self):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.cadastrar(dados)
            session["usuario_id"] = usuario.id
            return jsonify({
                "status": "success",
                "message": "Cadastro realizado com sucesso.",
                "usuario": usuario.to_dict(),
            }), 201
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def login(self):
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.autenticar(dados.get("email"), dados.get("senha"))
            session["usuario_id"] = usuario.id
            return jsonify({
                "status": "success",
                "message": "Login realizado com sucesso.",
                "usuario": usuario.to_dict(),
            }), 200
        except NaoAutenticado as erro:
            return jsonify({"status": "error", "message": str(erro)}), 401
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def logout(self):
        session.pop("usuario_id", None)
        return jsonify({"status": "success", "message": "Logout realizado com sucesso."}), 200

    def usuario_logado(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Nao autenticado."}), 401

        try:
            # Passa pelo Service (que por sua vez fala com o Model), mantendo
            # a cadeia Controller -> Service -> Model -> Repository -> BD.
            usuario = self.service.obter(usuario_id)
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Nao autenticado."}), 401

        return jsonify({"status": "success", "usuario": usuario.to_dict()}), 200


_controller = AuthController()
auth_bp.add_url_rule("/cadastro", view_func=_controller.cadastro, methods=["POST"])
auth_bp.add_url_rule("/login", view_func=_controller.login, methods=["POST"])
auth_bp.add_url_rule("/logout", view_func=_controller.logout, methods=["POST"])
auth_bp.add_url_rule("/me", view_func=_controller.usuario_logado, methods=["GET"])
