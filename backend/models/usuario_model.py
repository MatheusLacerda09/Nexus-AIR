from werkzeug.security import generate_password_hash, check_password_hash
from repositories.usuario_repository import UsuarioRepository


class UsuarioModel:
    """
    Entidade Usuario.

    Alem de representar os dados de um usuario, expoe os metodos de CRUD
    (salvar, excluir, buscar_por_id, buscar_por_email, listar_todos).
    Toda a comunicacao com o banco, porem, e delegada ao UsuarioRepository:
    o Model nunca escreve SQL, apenas orquestra o que deve ser persistido.
    """

    def __init__(self, id=None, cliente="Nexus Air", nome=None, senha=None,
                 email=None, cargo=None, departamento=None, setor=None,
                 telefone=None, cpf=None, data_nascimento=None, sexo=None,
                 tipo_acesso="padrao", horario_trabalho=None, curriculo=None,
                 data_ferias=None, faltas=0, criado_em=None):
        self.id = id
        self.cliente = cliente
        self.nome = nome
        self.senha = senha
        self.email = email
        self.cargo = cargo
        self.departamento = departamento
        self.setor = setor
        self.telefone = telefone
        self.cpf = cpf
        self.data_nascimento = data_nascimento
        self.sexo = sexo
        self.tipo_acesso = tipo_acesso or "padrao"
        self.horario_trabalho = horario_trabalho
        self.curriculo = curriculo
        self.data_ferias = data_ferias
        self.faltas = faltas or 0
        self.criado_em = criado_em

    # ---------------------------------------------------------------
    # Representacao / seguranca
    # ---------------------------------------------------------------
    def to_dict(self):
        """Nunca inclui o hash da senha na resposta da API."""
        return {
            "id": self.id,
            "cliente": self.cliente,
            "nome": self.nome,
            "email": self.email,
            "cargo": self.cargo,
            "departamento": self.departamento,
            "setor": self.setor,
            "telefone": self.telefone,
            "cpf": self.cpf,
            "data_nascimento": str(self.data_nascimento) if self.data_nascimento else None,
            "sexo": self.sexo,
            "tipo_acesso": self.tipo_acesso,
            "data_ferias": str(self.data_ferias) if self.data_ferias else None,
            "faltas": self.faltas,
            "criado_em": str(self.criado_em) if self.criado_em else None,
        }

    def definir_senha(self, senha_texto_puro):
        """Gera e armazena o hash da senha (nunca guardamos texto puro)."""
        self.senha = generate_password_hash(senha_texto_puro)

    def verificar_senha(self, senha_texto_puro):
        if not self.senha or not senha_texto_puro:
            return False
        return check_password_hash(self.senha, senha_texto_puro)

    # ---------------------------------------------------------------
    # CRUD (delega ao Repository)
    # ---------------------------------------------------------------
    def salvar(self):
        """Cria um novo registro se nao houver id, ou atualiza se ja existir."""
        repositorio = UsuarioRepository()
        if self.id is None:
            self.id = repositorio.inserir(self)
        else:
            repositorio.atualizar(self)
        return self

    def excluir(self):
        if self.id is None:
            raise ValueError("Nao e possivel excluir um usuario sem id.")
        UsuarioRepository().excluir(self.id)
        return True

    @classmethod
    def buscar_por_id(cls, usuario_id):
        linha = UsuarioRepository().buscar_por_id(usuario_id)
        return cls._a_partir_da_linha(linha) if linha else None

    @classmethod
    def buscar_por_email(cls, email):
        if not email:
            return None
        linha = UsuarioRepository().buscar_por_email(email)
        return cls._a_partir_da_linha(linha) if linha else None

    @classmethod
    def listar_todos(cls):
        linhas = UsuarioRepository().listar_todos()
        return [cls._a_partir_da_linha(linha) for linha in linhas]

    @staticmethod
    def _a_partir_da_linha(linha):
        """Converte uma linha (dict) vinda do Repository em um UsuarioModel."""
        return UsuarioModel(**linha)
