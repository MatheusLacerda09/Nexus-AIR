from datetime import date
from flask import Blueprint, jsonify, request, session, Response

from services.usuario_service import UsuarioService
from services.empresa_service import EmpresaService
from erros import ErroDeValidacao, NaoAutenticado, NaoEncontrado

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

class AuthController:

    FOTO_MAX_BYTES = 5 * 1024 * 1024
    FOTOS_PERMITIDAS = {"image/jpeg", "image/png", "image/webp"}

    def __init__(self):
        self.service = UsuarioService()
        self.service_empresa = EmpresaService()

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

    def cadastro_empresa(self):
        try:
            dados = request.get_json(silent=True) or {}
            empresa, usuario = self.service_empresa.cadastrar(dados)
            session["usuario_id"] = usuario.id
            return jsonify({
                "status": "success",
                "message": "Empresa cadastrada com sucesso.",
                "empresa": empresa.to_dict(),
                "usuario": usuario.to_dict(),
            }), 201
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def verificar_cnpj(self):
        cnpj = (request.args.get("cnpj") or "").strip()
        try:
            disponivel = self.service_empresa.cnpj_disponivel(cnpj)
            return jsonify({
                "status": "success",
                "disponivel": disponivel,
                "message": "CNPJ disponível." if disponivel else "Já existe uma empresa cadastrada com este CNPJ.",
            }), 200
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def verificar_email_empresa(self):
        email = (request.args.get("email") or "").strip()
        try:
            disponivel = self.service_empresa.email_disponivel(email)
            return jsonify({
                "status": "success",
                "disponivel": disponivel,
                "message": "E-mail disponível." if disponivel else "Já existe um cadastro com este e-mail.",
            }), 200
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def verificar_email(self):
        email = (request.args.get("email") or "").strip()
        try:
            disponivel = self.service.email_disponivel(email)
            return jsonify({
                "status": "success",
                "disponivel": disponivel,
                "message": "E-mail disponível." if disponivel else "Já existe um usuário cadastrado com este e-mail.",
            }), 200
        except ErroDeValidacao as erro:
            return jsonify({"status": "error", "message": str(erro)}), 400
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def verificar_nome(self):
        nome = (request.args.get("nome") or "").strip()
        try:
            nome_existente = self.service.nome_semelhante(nome)
            return jsonify({
                "status": "success",
                "semelhante": nome_existente is not None,
                "nome_existente": nome_existente,
                "message": (
                    f"Já existe um usuário cadastrado com um nome parecido ({nome_existente})."
                    if nome_existente else ""
                ),
            }), 200
        except Exception as erro:
            return jsonify({"status": "error", "message": str(erro)}), 500

    def verificar_nome_empresa(self):
        nome = (request.args.get("nome") or "").strip()
        try:
            nome_existente = self.service_empresa.nome_semelhante(nome)
            return jsonify({
                "status": "success",
                "semelhante": nome_existente is not None,
                "nome_existente": nome_existente,
                "message": (
                    f"Já existe uma empresa cadastrada com um nome parecido ({nome_existente})."
                    if nome_existente else ""
                ),
            }), 200
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
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

        try:

            usuario = self.service.obter(usuario_id)
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

        return jsonify({"status": "success", "usuario": usuario.to_dict()}), 200

    def preferencias(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            usuario = self.service.obter(usuario_id)
            return jsonify({
                "status": "success",
                "preferencias": {"volume_musica": usuario.volume_musica},
            }), 200
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def salvar_preferencias(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            dados = request.get_json(silent=True) or {}
            volume = float(dados.get("volume_musica"))
            if not 0 <= volume <= 1:
                raise ValueError
            usuario = self.service.obter(usuario_id)
            usuario.volume_musica = round(volume, 3)
            usuario.salvar()
            return jsonify({
                "status": "success",
                "preferencias": {"volume_musica": usuario.volume_musica},
            }), 200
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "Volume inválido."}), 400
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def redefinir_minha_senha(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            dados = request.get_json(silent=True) or {}
            senha_atual = dados.get("senha_atual") or ""
            nova_senha = dados.get("nova_senha") or ""
            confirmacao = dados.get("confirmacao") or ""
            usuario = self.service.obter(usuario_id)
            if not usuario.verificar_senha(senha_atual):
                return jsonify({"status": "error", "message": "A senha atual não confere."}), 400
            if len(nova_senha) < 6:
                return jsonify({"status": "error", "message": "A nova senha deve ter pelo menos 6 caracteres."}), 400
            if nova_senha != confirmacao:
                return jsonify({"status": "error", "message": "A confirmação da nova senha não confere."}), 400
            usuario.definir_senha(nova_senha)
            usuario.salvar()
            return jsonify({"status": "success", "message": "Senha redefinida com sucesso."}), 200
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def atualizar_meu_perfil(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            dados = request.get_json(silent=True) or {}
            usuario = self.service.obter(usuario_id)
            nome = dados.get("nome")
            if nome is not None:
                nome = str(nome).strip()
                if len(nome) < 3:
                    return jsonify({"status": "error", "message": "Informe um nome com pelo menos 3 caracteres."}), 400
                usuario.nome = nome[:100]
            if "data_nascimento" in dados:
                aniversario = (dados.get("data_nascimento") or "").strip()
                if aniversario:
                    try:
                        usuario.data_nascimento = date.fromisoformat(aniversario)
                    except ValueError:
                        return jsonify({"status": "error", "message": "Informe uma data de aniversário válida."}), 400
                else:
                    usuario.data_nascimento = None
            if nome is None and "data_nascimento" not in dados:
                return jsonify({"status": "error", "message": "Nenhuma alteração foi informada."}), 400
            usuario.salvar()
            mensagem = "Nome e data de aniversário atualizados." if nome is not None and "data_nascimento" in dados else ("Nome atualizado com sucesso." if nome is not None else "Data de aniversário atualizada.")
            return jsonify({"status": "success", "message": mensagem, "usuario": usuario.to_dict()}), 200
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def atualizar_idioma(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            idioma = (request.get_json(silent=True) or {}).get("idioma")
            if idioma not in ("pt-BR", "en"):
                return jsonify({"status": "error", "message": "Idioma inválido."}), 400
            usuario = self.service.obter(usuario_id)
            usuario.idioma = idioma
            usuario.salvar()
            return jsonify({"status": "success", "idioma": idioma, "usuario": usuario.to_dict()}), 200
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def minha_foto(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        try:
            foto = self.service.obter_foto(usuario_id)
            if not foto or not foto.get("foto_perfil") or not foto.get("foto_mime"):
                return jsonify({"status": "error", "message": "Este usuário ainda não possui foto."}), 404
            resposta = Response(foto["foto_perfil"], mimetype=foto["foto_mime"])
            resposta.headers["Cache-Control"] = "private, max-age=0, no-cache"
            return resposta
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

    def atualizar_minha_foto(self):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Não autenticado."}), 401
        arquivo = request.files.get("foto")
        if not arquivo or not arquivo.filename:
            return jsonify({"status": "error", "message": "Selecione uma imagem."}), 400
        mime = (arquivo.mimetype or "").lower()
        if mime not in self.FOTOS_PERMITIDAS:
            return jsonify({"status": "error", "message": "Use uma imagem JPG, PNG ou WEBP."}), 400
        conteudo = arquivo.read(self.FOTO_MAX_BYTES + 1)
        if len(conteudo) > self.FOTO_MAX_BYTES:
            return jsonify({"status": "error", "message": "A foto deve ter no máximo 5 MB."}), 400
        assinaturas = {
            "image/jpeg": conteudo.startswith(b"\xff\xd8\xff"),
            "image/png": conteudo.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": conteudo.startswith(b"RIFF") and conteudo[8:12] == b"WEBP",
        }
        if not assinaturas.get(mime, False):
            return jsonify({"status": "error", "message": "O arquivo de imagem não é válido."}), 400
        try:
            usuario = self.service.salvar_foto(usuario_id, conteudo, mime)
            return jsonify({"status": "success", "message": "Foto de perfil atualizada.", "usuario": usuario.to_dict()}), 200
        except NaoEncontrado:
            session.pop("usuario_id", None)
            return jsonify({"status": "error", "message": "Não autenticado."}), 401

_controller = AuthController()
auth_bp.add_url_rule("/cadastro", view_func=_controller.cadastro, methods=["POST"])
auth_bp.add_url_rule("/cadastro-empresa", view_func=_controller.cadastro_empresa, methods=["POST"])
auth_bp.add_url_rule("/verificar-email", view_func=_controller.verificar_email, methods=["GET"])
auth_bp.add_url_rule("/verificar-email-empresa", view_func=_controller.verificar_email_empresa, methods=["GET"])
auth_bp.add_url_rule("/verificar-cnpj", view_func=_controller.verificar_cnpj, methods=["GET"])
auth_bp.add_url_rule("/verificar-nome", view_func=_controller.verificar_nome, methods=["GET"])
auth_bp.add_url_rule("/verificar-nome-empresa", view_func=_controller.verificar_nome_empresa, methods=["GET"])
auth_bp.add_url_rule("/login", view_func=_controller.login, methods=["POST"])
auth_bp.add_url_rule("/logout", view_func=_controller.logout, methods=["POST"])
auth_bp.add_url_rule("/me", view_func=_controller.usuario_logado, methods=["GET"])
auth_bp.add_url_rule("/preferencias", view_func=_controller.preferencias, methods=["GET"])
auth_bp.add_url_rule("/preferencias", view_func=_controller.salvar_preferencias, methods=["PATCH"])
auth_bp.add_url_rule("/minha-senha", view_func=_controller.redefinir_minha_senha, methods=["PATCH"])
auth_bp.add_url_rule("/meu-perfil", view_func=_controller.atualizar_meu_perfil, methods=["PATCH"])
auth_bp.add_url_rule("/idioma", view_func=_controller.atualizar_idioma, methods=["PATCH"])
auth_bp.add_url_rule("/minha-foto", view_func=_controller.minha_foto, methods=["GET"])
auth_bp.add_url_rule("/minha-foto", view_func=_controller.atualizar_minha_foto, methods=["POST"])
