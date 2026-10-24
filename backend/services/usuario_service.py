import re
import unicodedata
from difflib import SequenceMatcher

from models.usuario_model import UsuarioModel
from models.empresa_model import EmpresaModel
from services.empresa_service import _normalizar_nome
from models.local_trabalho_model import LocalTrabalhoModel
from erros import ErroDeValidacao, NaoAutenticado, NaoEncontrado
from cargos import cargo_oficial, cargo_publico_valido, cargo_valido

REGEX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

LIMIAR_SEMELHANCA_NOME = 0.84

def _normalizar_nome(nome):
    """Minúsculas, sem acento e sem espaços duplicados — para comparar
    'José da Silva' com 'jose da silva' como o mesmo nome."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sem_acento).strip().lower()

class UsuarioService:

    CAMPOS_ATUALIZAVEIS = (
        "nome", "cargo", "departamento", "setor", "telefone", "cpf",
        "data_nascimento", "sexo", "tipo_acesso", "horario_trabalho",
        "curriculo", "data_ferias", "faltas",
    )

    @staticmethod
    def _formatar_telefone(valor):
        """Guarda só dígitos com "+" na frente (ex: +5531999367000). Não
        valida se o número é real, só padroniza o que foi digitado."""
        digitos = "".join(ch for ch in (valor or "") if ch.isdigit())
        return f"+{digitos}"[:20] if digitos else None

    def cadastrar(self, dados, permitir_tipo_acesso=False, cliente=None):
        """permitir_tipo_acesso só é True quando quem cadastra já é um
        gerente/admin logado (tela de Usuários). No cadastro público
        (/api/auth/cadastro) o tipo de acesso é sempre "padrao", para
        ninguém se promover a administrador mandando o campo na mão."""
        nome = (dados.get("nome") or "").strip()
        email = (dados.get("email") or "").strip().lower()
        cpf = (dados.get("cpf") or "").strip() or None
        senha = dados.get("senha") or ""
        cargo = cargo_oficial(dados.get("cargo"))

        if not nome:
            raise ErroDeValidacao("O nome é obrigatório.")
        if not email or not REGEX_EMAIL.match(email):
            raise ErroDeValidacao("Informe um e-mail válido.")
        if len(senha) < 6:
            raise ErroDeValidacao("A senha deve ter pelo menos 6 caracteres.")
        if not cargo:
            raise ErroDeValidacao("Selecione um cargo oficial.")
        if permitir_tipo_acesso and not cargo_valido(cargo):
            raise ErroDeValidacao("Selecione um cargo oficial da empresa.")
        if not permitir_tipo_acesso and not cargo_publico_valido(cargo):
            raise ErroDeValidacao("No cadastro de conta, escolha um cargo até Desenvolvedor Sênior.")
        if UsuarioModel.buscar_por_email(email) or EmpresaModel.buscar_por_email(email):
            raise ErroDeValidacao("Já existe um cadastro com este e-mail.")
        if cpf and UsuarioModel.buscar_por_cpf(cpf):
            raise ErroDeValidacao("Já existe um usuário cadastrado com este CPF.")

        nome_departamento = (dados.get("departamento") or "").strip() or None

        if nome_departamento and not permitir_tipo_acesso and not cliente:
            alvo = _normalizar_nome(nome_departamento)
            for nome_empresa in EmpresaModel.listar_nomes():
                if nome_empresa and _normalizar_nome(nome_empresa) == alvo:
                    raise ErroDeValidacao(
                        "Esta empresa já está cadastrada. Peça para a empresa criar a sua conta."
                    )
        local_trabalho = LocalTrabalhoModel.obter_ou_criar(nome_departamento) if nome_departamento else None

        cliente_usuario = (
            cliente
            or (local_trabalho.nome if local_trabalho else None)
            or "Nexus Air"
        ).strip() or "Nexus Air"
        tipo_acesso = (dados.get("tipo_acesso") or ("admin" if cargo == "Administrador" else "padrao"))
        tipo_acesso = str(tipo_acesso).strip().lower()
        if tipo_acesso not in {"padrao", "admin"}:
            raise ErroDeValidacao("Escolha um tipo de acesso válido.")
        if not permitir_tipo_acesso:
            tipo_acesso = "padrao"

        usuario = UsuarioModel(
            cliente=cliente_usuario,
            nome=nome,
            email=email,
            cargo=cargo,
            departamento=nome_departamento,
            setor=(dados.get("setor") or "").strip() or None,
            telefone=self._formatar_telefone(dados.get("telefone")),
            cpf=cpf,
            tipo_acesso=tipo_acesso,
            local_trabalho_id=local_trabalho.id if local_trabalho else None,
        )
        usuario.definir_senha(senha)
        usuario.salvar()
        return usuario

    def email_disponivel(self, email):
        """Usado pela tela de cadastro para checar, em tempo real, se o
        e-mail digitado já pertence a outro usuário."""
        email = (email or "").strip().lower()
        if not email or not REGEX_EMAIL.match(email):
            raise ErroDeValidacao("Informe um e-mail válido.")
        return UsuarioModel.buscar_por_email(email) is None and EmpresaModel.buscar_por_email(email) is None

    def nome_semelhante(self, nome):
        """Checa se já existe alguém cadastrado com um nome igual ou muito
        parecido. É só um aviso (não impede o cadastro): a mesma pessoa
        pode ter nome parecido com outra, ou existirem dois usuários com
        o mesmo nome de fato — quem decide é quem está cadastrando."""
        nome = (nome or "").strip()
        if len(nome) < 3:
            return None

        alvo = _normalizar_nome(nome)
        for nome_existente in UsuarioModel.listar_nomes():
            if not nome_existente:
                continue
            comparado = _normalizar_nome(nome_existente)
            if comparado == alvo or SequenceMatcher(None, alvo, comparado).ratio() >= LIMIAR_SEMELHANCA_NOME:
                return nome_existente
        return None

    def autenticar(self, email, senha):
        email = (email or "").strip().lower()
        usuario = UsuarioModel.buscar_por_email(email)

        if not usuario:
            raise NaoAutenticado("Usuário incorreto.")
        if not usuario.verificar_senha(senha):
            raise NaoAutenticado("Senha incorreta.")

        return usuario

    def listar(self, cliente=None):
        if cliente:
            return UsuarioModel.listar_por_cliente(cliente)
        return UsuarioModel.listar_todos()

    def obter(self, usuario_id, cliente=None):
        usuario = UsuarioModel.buscar_por_id(usuario_id)
        pertence_ao_cliente = (
            not cliente
            or usuario.cliente == cliente
            or usuario.departamento == cliente
        ) if usuario else False
        if not usuario or not pertence_ao_cliente:
            raise NaoEncontrado("Usuário não encontrado.")
        return usuario

    def obter_foto(self, usuario_id):
        self.obter(usuario_id)
        return UsuarioModel.buscar_foto(usuario_id)

    def salvar_foto(self, usuario_id, conteudo, mime):
        usuario = self.obter(usuario_id)
        UsuarioModel.atualizar_foto(usuario.id, conteudo, mime)
        usuario.foto_mime = mime
        return usuario

    def atualizar(self, usuario_id, dados, cliente=None):
        usuario = self.obter(usuario_id, cliente=cliente)

        if "cargo" in dados:
            cargo = cargo_oficial(dados.get("cargo"))
            if not cargo:
                raise ErroDeValidacao("Selecione um cargo oficial da empresa.")
            usuario.cargo = cargo

        novo_email = dados.get("email")
        if novo_email:
            novo_email = novo_email.strip().lower()
            if not REGEX_EMAIL.match(novo_email):
                raise ErroDeValidacao("Informe um e-mail válido.")
            existente = UsuarioModel.buscar_por_email(novo_email)
            if existente and existente.id != usuario.id:
                raise ErroDeValidacao("Já existe um usuário cadastrado com este e-mail.")
            usuario.email = novo_email

        novo_cpf = dados.get("cpf")
        if novo_cpf:
            novo_cpf = novo_cpf.strip()
            existente = UsuarioModel.buscar_por_cpf(novo_cpf)
            if existente and existente.id != usuario.id:
                raise ErroDeValidacao("Já existe um usuário cadastrado com este CPF.")

        for campo in self.CAMPOS_ATUALIZAVEIS:
            if campo in {"cargo", "tipo_acesso"}:
                continue
            if campo in dados and dados[campo] not in (None, ""):
                setattr(usuario, campo, dados[campo])

        tipo_acesso = dados.get("tipo_acesso")
        if tipo_acesso is not None:
            tipo_acesso = str(tipo_acesso).strip().lower()
            if tipo_acesso not in {"padrao", "admin"}:
                raise ErroDeValidacao("Escolha um tipo de acesso válido.")
            usuario.tipo_acesso = tipo_acesso

        if "departamento" in dados and (dados["departamento"] or "").strip():
            local_trabalho = LocalTrabalhoModel.obter_ou_criar(usuario.departamento)
            usuario.local_trabalho_id = local_trabalho.id if local_trabalho else None

        nova_senha = dados.get("senha")
        if nova_senha:
            if len(nova_senha) < 6:
                raise ErroDeValidacao("A senha deve ter pelo menos 6 caracteres.")
            usuario.definir_senha(nova_senha)

        usuario.salvar()
        return usuario

    def remover(self, usuario_id, cliente=None):
        usuario = self.obter(usuario_id, cliente=cliente)
        usuario.excluir()
        return True
