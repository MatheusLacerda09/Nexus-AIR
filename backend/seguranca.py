from functools import wraps

from flask import session, jsonify

from cargos import pode_gerenciar_usuarios

def login_obrigatorio(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        if not session.get("usuario_id"):
            return jsonify({"status": "error", "message": "Sessão expirada. Faça login novamente."}), 401
        return funcao(*args, **kwargs)
    return wrapper

def gerente_ou_superior_obrigatorio(funcao):
    """Além de estar logado, exige tipo_acesso admin ou cargo de gerente ou maior (ver cargos.py).
    O cargo é lido do banco a cada chamada, então mudar o cargo de alguém
    vale na hora, sem precisar de novo login."""
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        usuario_id = session.get("usuario_id")
        if not usuario_id:
            return jsonify({"status": "error", "message": "Sessão expirada. Faça login novamente."}), 401

        from models.usuario_model import UsuarioModel
        usuario = UsuarioModel.buscar_por_id(usuario_id)
        if not usuario or not pode_gerenciar_usuarios(usuario.cargo, usuario.tipo_acesso):
            return jsonify({
                "status": "error",
                "message": "Você não tem permissão para acessar a página de usuários. É necessário ser administrador ou ter cargo de gerente ou superior.",
            }), 403
        return funcao(*args, **kwargs)
    return wrapper

def usuario_da_sessao():
    """Usuário logado (ou None). Import tardio evita ciclo."""
    from models.usuario_model import UsuarioModel
    usuario_id = session.get("usuario_id")
    return UsuarioModel.buscar_por_id(usuario_id) if usuario_id else None

def cliente_da_sessao():
    """Empresa (cliente) do usuário logado. Tudo que é específico de empresa
    (alertas, tarefas) é filtrado por este valor."""
    usuario = usuario_da_sessao()
    return ((usuario.cliente if usuario else None) or "Nexus Air").strip() or "Nexus Air"
