import json
import os
import threading
import uuid
from datetime import datetime, timezone

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
STORE_PATH = os.path.join(BASE_DIR, "automation.json")
_LOCK = threading.RLock()

def _now():
    return datetime.now(timezone.utc).isoformat()

def _default():
    return {"connectors": [], "flows": [], "templates": [], "reports": [], "schedules": [], "logs": [], "maquinas": [], "bancos": []}

def _read():
    os.makedirs(BASE_DIR, exist_ok=True)
    if not os.path.exists(STORE_PATH):
        data = _default()
        _write(data)
        return data
    try:
        with open(STORE_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = _default()
    for key, value in _default().items():
        data.setdefault(key, value)
    return data

def _write(data):
    os.makedirs(BASE_DIR, exist_ok=True)
    tmp = STORE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STORE_PATH)

def all_items(kind):
    with _LOCK:
        return list(_read().get(kind, []))

def create(kind, payload):
    with _LOCK:
        data = _read()
        item = dict(payload)
        item.setdefault("id", uuid.uuid4().hex[:12])
        item.setdefault("criado_em", _now())
        item["atualizado_em"] = _now()
        data[kind].append(item)
        _write(data)
        return item

def get(kind, item_id):
    return next((x for x in all_items(kind) if x.get("id") == item_id), None)

def update(kind, item_id, patch):
    with _LOCK:
        data = _read()
        for item in data[kind]:
            if item.get("id") == item_id:
                item.update(patch)
                item["atualizado_em"] = _now()
                _write(data)
                return item
    return None

def remove(kind, item_id):
    with _LOCK:
        data = _read()
        before = len(data[kind])
        data[kind] = [x for x in data[kind] if x.get("id") != item_id]
        if len(data[kind]) != before:
            _write(data)
            return True
    return False

def _cliente_do_pedido():
    """Empresa de quem está logado, quando o log nasce dentro de uma requisição."""
    try:
        from flask import has_request_context, session
        if has_request_context() and session.get("usuario_id"):
            from seguranca import cliente_da_sessao
            return cliente_da_sessao()
    except Exception:
        pass
    return None

def add_log(evento, detalhe, status="sucesso", cliente=None):
    """O log guarda a empresa dona do evento; a tela de governança só mostra os da própria empresa."""
    return create("logs", {"evento": evento, "detalhe": detalhe, "status": status,
                           "cliente": cliente or _cliente_do_pedido() or "Nexus Air"})
