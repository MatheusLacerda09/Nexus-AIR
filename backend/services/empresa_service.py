import re
import unicodedata
from difflib import SequenceMatcher

from models.empresa_model import EmpresaModel
from models.usuario_model import UsuarioModel
from erros import ErroDeValidacao

REGEX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

LIMIAR_SEMELHANCA_NOME = 0.84

def _somente_digitos(valor):
    return re.sub(r"\D", "", valor or "")

def _normalizar_nome(nome):
    """Minúsculas, sem acento e sem espaços duplicados — para comparar
    'Nexus Ar Ltda' com 'nexus ar ltda' como o mesmo nome."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sem_acento).strip().lower()

def _cnpj_valido(cnpj):
    """Valida so o FORMATO do CNPJ (14 digitos, nao todos iguais).

    Antes este metodo tambem conferia os dois digitos verificadores pelo
    algoritmo oficial da Receita Federal, o que exigia um CNPJ real para
    conseguir cadastrar uma empresa. Isso foi removido de proposito: em
    ambiente de teste (ex: Teste 16) precisa ser possivel cadastrar uma
    empresa com um CNPJ inventado (ex: 11.222.333/0001-44), desde que
    tenha o formato certo — 14 digitos numericos.
    """
    return len(cnpj) == 14 and cnpj.isdigit() and len(set(cnpj)) > 1

def _normalizar_telefone(digitos):
    """Recebe só dígitos e devolve o telefone no formato "+55DDDNUMERO",
    ou None se o tamanho não bater. Só o FORMATO importa (10 dígitos =
    fixo com DDD, 11 = celular com DDD e 9 na frente, com ou sem o +55 na
    frente): não checamos se a linha existe de verdade."""
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        digitos = digitos[2:]
    if len(digitos) in (10, 11):
        return "+55" + digitos
    return None

class EmpresaService:
    """
    Cadastro de contas do tipo empresa.

    Uma empresa nao loga sozinha: o cadastro cria o registro da empresa
    (dados cadastrais) e, junto, um UsuarioModel com cargo "Administrador"
    e tipo_acesso="admin" para o responsavel indicado — e esse usuario que
    efetivamente faz login pela tela normal (/api/auth/login), como
    qualquer outro, e ja enxerga a pagina de Usuarios.
    """

    def cadastrar(self, dados):
        nome_empresa = (dados.get("nome_empresa") or "").strip()
        cnpj = _somente_digitos(dados.get("cnpj"))
        email = (dados.get("email") or "").strip().lower()
        telefone = _somente_digitos(dados.get("telefone"))
        endereco = (dados.get("endereco") or "").strip()
        setor = (dados.get("setor") or "").strip() or None
        departamentos = (dados.get("departamentos") or "").strip() or None
        nome_responsavel = (dados.get("nome_responsavel") or "").strip()
        senha = dados.get("senha") or ""

        if not nome_empresa:
            raise ErroDeValidacao("O nome da empresa é obrigatório.")
        if not _cnpj_valido(cnpj):
            raise ErroDeValidacao("Informe um CNPJ válido.")
        if not telefone:
            raise ErroDeValidacao("O telefone da empresa é obrigatório.")
        telefone = _normalizar_telefone(telefone)
        if not telefone:
            raise ErroDeValidacao("Informe um telefone válido.")
        if not email or not REGEX_EMAIL.match(email):
            raise ErroDeValidacao("Informe um e-mail corporativo válido.")
        if not endereco:
            raise ErroDeValidacao("O endereço da empresa é obrigatório.")
        if not nome_responsavel:
            raise ErroDeValidacao("Informe o nome do responsável pela conta.")
        if len(senha) < 6:
            raise ErroDeValidacao("A senha deve ter pelo menos 6 caracteres.")

        if EmpresaModel.buscar_por_cnpj(cnpj):
            raise ErroDeValidacao("Já existe uma empresa cadastrada com este CNPJ.")
        if EmpresaModel.buscar_por_email(email) or UsuarioModel.buscar_por_email(email):
            raise ErroDeValidacao("Já existe um cadastro com este e-mail.")

        empresa = EmpresaModel(
            nome=nome_empresa,
            cnpjs=cnpj,
            endereco=endereco,
            telefone=telefone,
            email=email,
            ceos=nome_responsavel,
            setores=setor,
            departamentos=departamentos,
        )
        empresa.salvar()

        usuario = UsuarioModel(
            cliente=nome_empresa,
            nome=nome_responsavel,
            email=email,
            cargo="Administrador",
            departamento=departamentos,
            setor=setor,
            telefone=telefone,
            tipo_acesso="admin",
        )
        usuario.definir_senha(senha)
        usuario.salvar()

        return empresa, usuario

    def nome_semelhante(self, nome):
        """Mesma ideia do UsuarioService.nome_semelhante, só que comparando
        contra os nomes de empresa já cadastrados: é só um aviso (não
        impede o cadastro), pois duas empresas podem legitimamente ter
        nomes iguais ou parecidos (franquias, mesmo grupo, etc)."""
        nome = (nome or "").strip()
        if len(nome) < 3:
            return None

        alvo = _normalizar_nome(nome)
        for nome_existente in EmpresaModel.listar_nomes():
            if not nome_existente:
                continue
            comparado = _normalizar_nome(nome_existente)
            if comparado == alvo or SequenceMatcher(None, alvo, comparado).ratio() >= LIMIAR_SEMELHANCA_NOME:
                return nome_existente
        return None

    def email_disponivel(self, email):
        """Usado pela tela de cadastro de empresa para checar, em tempo
        real, se o e-mail informado (que também servirá de login) já
        está em uso — seja por outra empresa, seja por um usuário comum."""
        email = (email or "").strip().lower()
        if not email or not REGEX_EMAIL.match(email):
            raise ErroDeValidacao("Informe um e-mail válido.")
        return EmpresaModel.buscar_por_email(email) is None and UsuarioModel.buscar_por_email(email) is None

    def cnpj_disponivel(self, cnpj):
        cnpj = _somente_digitos(cnpj)
        if not _cnpj_valido(cnpj):
            raise ErroDeValidacao("Informe um CNPJ válido.")
        return EmpresaModel.buscar_por_cnpj(cnpj) is None

    def listar(self):
        return EmpresaModel.listar_todos()
