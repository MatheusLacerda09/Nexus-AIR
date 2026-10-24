from repositories.local_trabalho_repository import LocalTrabalhoRepository

class LocalTrabalhoModel:
    """
    Entidade "local de trabalho": a empresa/local onde uma pessoa comum
    (aba "Pessoa" do cadastro, campo "Empresa / Depto.") diz que trabalha.

    NAO e a mesma entidade que EmpresaModel: aquela e a empresa-cliente
    que assina o Nexus Air e precisa de CNPJ valido de verdade; esta aqui
    e so informativa, criada automaticamente (find-or-create pelo nome) e
    o CNPJ, quando informado, nunca e validado.
    """

    def __init__(self, id=None, nome=None, cnpj=None):
        self.id = id
        self.nome = nome
        self.cnpj = cnpj

    def to_dict(self):
        return {"id": self.id, "nome": self.nome, "cnpj": self.cnpj}

    @classmethod
    def buscar_por_id(cls, local_trabalho_id):
        if not local_trabalho_id:
            return None
        linha = LocalTrabalhoRepository().buscar_por_id(local_trabalho_id)
        return cls(**linha) if linha else None

    @classmethod
    def buscar_por_nome(cls, nome):
        if not nome:
            return None
        linha = LocalTrabalhoRepository().buscar_por_nome(nome)
        return cls(**linha) if linha else None

    @classmethod
    def obter_ou_criar(cls, nome, cnpj=None):
        """Busca um local de trabalho pelo nome (case sensitive, mesmo
        nome digitado) e cria na hora se ainda nao existir. E assim que
        o cadastro de "Pessoa" transforma o texto livre do campo
        "Empresa / Depto." num registro real da tabela local_trabalho."""
        nome = (nome or "").strip()
        if not nome:
            return None

        existente = cls.buscar_por_nome(nome)
        if existente:
            return existente

        novo_id = LocalTrabalhoRepository().inserir(nome, cnpj or None)
        return cls(id=novo_id, nome=nome, cnpj=cnpj or None)

    @classmethod
    def listar_todos(cls):
        linhas = LocalTrabalhoRepository().listar_todos()
        return [cls(**linha) for linha in linhas]
