from repositories.empresa_repository import EmpresaRepository

class EmpresaModel:
    """
    Entidade Empresa.

    Mesma logica do UsuarioModel: o Model orquestra o que deve ser
    persistido, mas quem fala SQL de fato e o EmpresaRepository.
    """

    def __init__(self, id=None, nome=None, cnpjs=None, endereco=None, telefone=None,
                 email=None, ceos=None, setores=None, departamentos=None):
        self.id = id
        self.nome = nome
        self.cnpjs = cnpjs
        self.endereco = endereco
        self.telefone = telefone
        self.email = email
        self.ceos = ceos
        self.setores = setores
        self.departamentos = departamentos

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "cnpj": self.cnpjs,
            "endereco": self.endereco,
            "telefone": self.telefone,
            "email": self.email,
            "responsavel": self.ceos,
            "setores": self.setores,
            "departamentos": self.departamentos,
        }

    def salvar(self):
        """Cria um novo registro se nao houver id, ou atualiza se ja existir."""
        repositorio = EmpresaRepository()
        if self.id is None:
            self.id = repositorio.inserir(self)
        else:
            repositorio.atualizar(self)
        return self

    def excluir(self):
        if self.id is None:
            raise ValueError("Nao e possivel excluir uma empresa sem id.")
        EmpresaRepository().excluir(self.id)
        return True

    @classmethod
    def buscar_por_id(cls, empresa_id):
        linha = EmpresaRepository().buscar_por_id(empresa_id)
        return cls._a_partir_da_linha(linha) if linha else None

    @classmethod
    def buscar_por_cnpj(cls, cnpj):
        if not cnpj:
            return None
        linha = EmpresaRepository().buscar_por_cnpj(cnpj)
        return cls._a_partir_da_linha(linha) if linha else None

    @classmethod
    def buscar_por_email(cls, email):
        if not email:
            return None
        linha = EmpresaRepository().buscar_por_email(email)
        return cls._a_partir_da_linha(linha) if linha else None

    @classmethod
    def listar_todos(cls):
        linhas = EmpresaRepository().listar_todos()
        return [cls._a_partir_da_linha(linha) for linha in linhas]

    @classmethod
    def listar_nomes(cls):
        return EmpresaRepository().listar_nomes()

    @staticmethod
    def _a_partir_da_linha(linha):
        """Converte uma linha (dict) vinda do Repository em um EmpresaModel."""
        return EmpresaModel(**linha)
