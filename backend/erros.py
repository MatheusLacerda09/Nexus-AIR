class ErroDeValidacao(Exception):
    """Dados de entrada inválidos ou que violam uma regra de negócio (HTTP 400)."""

class NaoAutenticado(Exception):
    """Usuário não está logado / credenciais inválidas (HTTP 401)."""

class NaoEncontrado(Exception):
    """Registro solicitado não existe (HTTP 404)."""