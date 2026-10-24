"""Cargos oficiais e regras de acesso do Nexus Air."""

import unicodedata

CARGOS = (
    "Estagiário",
    "Auxiliar",
    "Desenvolvedor Júnior",
    "Desenvolvedor Pleno",
    "Desenvolvedor Sênior",
    "Coordenador",
    "Gerente",
    "Diretor",
    "Administrador",
    "Sócio",
)

CARGOS_PUBLICOS = CARGOS[:5]
CARGOS_GESTAO = CARGOS[5:]

def normalizar_cargo(cargo):
    """Normaliza acentos e caixa para comparar entradas com segurança."""
    texto = unicodedata.normalize("NFKD", cargo or "")
    texto = texto.encode("ascii", "ignore").decode("ascii")
    return " ".join(texto.lower().split())

_CARGOS_NORMALIZADOS = {normalizar_cargo(cargo): cargo for cargo in CARGOS}

def cargo_oficial(cargo):
    """Retorna o rótulo oficial ou None se o cargo não existir na lista."""
    return _CARGOS_NORMALIZADOS.get(normalizar_cargo(cargo))

def cargo_valido(cargo):
    return cargo_oficial(cargo) is not None

def cargo_publico_valido(cargo):
    oficial = cargo_oficial(cargo)
    return oficial in CARGOS_PUBLICOS

def cargo_e_gerente_ou_superior(cargo):
    """Coordenador e todos os cargos acima podem abrir a gestão de usuários."""
    oficial = cargo_oficial(cargo)
    return oficial in CARGOS_GESTAO

def pode_gerenciar_usuarios(cargo, tipo_acesso=None):
    """A permissão é determinada pelo cargo, não por um campo manipulável."""
    return cargo_e_gerente_ou_superior(cargo)
