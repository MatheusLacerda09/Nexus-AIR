class UsuarioModel:
    def __init__(self, id=None, cliente=None, nome=None, senha=None, data_nascimento=None, cpf=None, telefone=None, email=None, cargo=None, horario_trabalho=None, curriculo=None, departamento=None, setor=None, sexo=None, tipo_acesso=None, data_ferias=None, faltas=0):
        self.id = id
        self.cliente = cliente
        self.nome = nome
        self.senha = senha
        self.data_nascimento = data_nascimento
        self.cpf = cpf
        self.telefone = telefone
        self.email = email
        self.cargo = cargo
        self.horario_trabalho = horario_trabalho
        self.curriculo = curriculo
        self.departamento = departamento
        self.setor = setor
        self.sexo = sexo
        self.tipo_acesso = tipo_acesso
        self.data_ferias = data_ferias
        self.faltas = faltas

    def to_dict(self):
        return {
            "id": self.id,
            "cliente": self.cliente,
            "nome": self.nome,
            "email": self.email,
            "cargo": self.cargo,
            "departamento": self.departamento,
            "setor": self.setor,
            "tipo_acesso": self.tipo_acesso,
            "faltas": self.faltas
        }