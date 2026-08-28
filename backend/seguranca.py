from functools import wraps

from flask import session, jsonify


def login_obrigatorio(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        if not session.get("usuario_id"):
            return jsonify({"status": "error", "message": "Sessao expirada. Faca login novamente."}), 401
        return funcao(*args, **kwargs)
    return wrapper
