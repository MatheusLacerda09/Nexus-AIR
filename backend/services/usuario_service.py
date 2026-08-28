import re

from models.usuario_model import UsuarioModel
from erros import ErroDeValidacao, NaoAutenticado, NaoEncontrado

REGEX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UsuarioService:

    CAMPOS_ATUALIZAVEIS = (
        "nome", "cargo", "departamento", "setor", "telefone", "cpf",
        "data_nascimento", "sexo", "tipo_acesso", "horario_trabalho",
        "curriculo", "data_ferias", "faltas",
    )

    def cadastrar(self, dados):
        nome = (dados.get("nome") or "").strip()
        email = (dados.get("email") or "").strip().lower()
        senha = dados.get("senha") or ""

        if not nome:
            raise ErroDeValidacao("O nome e obrigatorio.")
        if not email or not REGEX_EMAIL.match(email):
            raise ErroDeValidacao("Informe um e-mail valido.")
        if len(senha) < 6:
            raise ErroDeValidacao("A senha deve ter pelo menos 6 caracteres.")
        if UsuarioModel.buscar_por_email(email):
            raise ErroDeValidacao("Ja existe um usuario cadastrado com este e-mail.")

        usuario = UsuarioModel(
            nome=nome,
            email=email,
            cargo=(dados.get("cargo") or "").strip() or None,
            departamento=(dados.get("departamento") or "").strip() or None,
            setor=(dados.get("setor") or "").strip() or None,
            telefone=(dados.get("telefone") or "").strip() or None,
            tipo_acesso=dados.get("tipo_acesso") or "padrao",
        )
        usuario.definir_senha(senha)
        usuario.salvar()
        return usuario

    def autenticar(self, email, senha):
        email = (email or "").strip().lower()
        usuario = UsuarioModel.buscar_por_email(email)

        if not usuario:
            raise NaoAutenticado("Usuario incorreto.")
        if not usuario.verificar_senha(senha):
            raise NaoAutenticado("Senha incorreta.")

        return usuario

    def listar(self):
        return UsuarioModel.listar_todos()

    def obter(self, usuario_id):
        usuario = UsuarioModel.buscar_por_id(usuario_id)
        if not usuario:
            raise NaoEncontrado("Usuario nao encontrado.")
        return usuario

    def atualizar(self, usuario_id, dados):
        usuario = self.obter(usuario_id)

        novo_email = dados.get("email")
        if novo_email:
            novo_email = novo_email.strip().lower()
            if not REGEX_EMAIL.match(novo_email):
                raise ErroDeValidacao("Informe um e-mail valido.")
            existente = UsuarioModel.buscar_por_email(novo_email)
            if existente and existente.id != usuario.id:
                raise ErroDeValidacao("Ja existe um usuario cadastrado com este e-mail.")
            usuario.email = novo_email

        for campo in self.CAMPOS_ATUALIZAVEIS:
            if campo in dados and dados[campo] not in (None, ""):
                setattr(usuario, campo, dados[campo])

        nova_senha = dados.get("senha")
        if nova_senha:
            if len(nova_senha) < 6:
                raise ErroDeValidacao("A senha deve ter pelo menos 6 caracteres.")
            usuario.definir_senha(nova_senha)

        usuario.salvar()
        return usuario

    def remover(self, usuario_id):
        usuario = self.obter(usuario_id)
        usuario.excluir()
        return True
