"""
Excecoes de dominio da aplicacao.

Os Services levantam essas excecoes quando uma regra de negocio e violada
(ex.: e-mail duplicado, credenciais invalidas, registro nao encontrado).
Os Controllers capturam essas excecoes e traduzem para a resposta HTTP
correta, evitando "try/except Exception" genericos espalhados pelo codigo.
"""


class ErroDeValidacao(Exception):
    """Dados de entrada invalidos ou que violam uma regra de negocio (HTTP 400)."""


class NaoAutenticado(Exception):
    """Usuario nao esta logado / credenciais invalidas (HTTP 401)."""


class NaoEncontrado(Exception):
    """Registro solicitado nao existe (HTTP 404)."""
