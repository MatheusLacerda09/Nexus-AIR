class ErroDeValidacao(Exception):
    """Dados de entrada invalidos ou que violam uma regra de negocio (HTTP 400)."""


class NaoAutenticado(Exception):
    """Usuario nao esta logado / credenciais invalidas (HTTP 401)."""


class NaoEncontrado(Exception):
    """Registro solicitado nao existe (HTTP 404)."""
