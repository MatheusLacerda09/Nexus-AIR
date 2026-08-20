class EmpresaModel:
    def __init__(self, id=None, nome=None, cnpjs=None, endereco=None, telefone=None, email=None, ceos=None, setores=None, departamentos=None):
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
            "cnpjs": self.cnpjs,
            "endereco": self.endereco,
            "telefone": self.telefone,
            "email": self.email,
            "ceos": self.ceos,
            "setores": self.setores,
            "departamentos": self.departamentos
        }