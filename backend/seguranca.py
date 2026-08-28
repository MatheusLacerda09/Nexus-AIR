"""
Controle de acesso simples baseado na sessao (cookie) do Flask.

Login e feito via backend/controllers/auth_controller.py, que grava o id
do usuario em `session['usuario_id']`. As rotas que exigem autenticacao
usam o decorator `login_obrigatorio` abaixo.
"""
from functools import wraps

from flask import session, jsonify


def login_obrigatorio(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        if not session.get("usuario_id"):
            return jsonify({"status": "error", "message": "Sessao expirada. Faca login novamente."}), 401
        return funcao(*args, **kwargs)
    return wrapper
