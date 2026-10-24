"""Coletor de relatórios agendados rodando dentro do próprio Flask.

Sem isso, o Nexus Air só *agenda*: quem busca os relatórios devidos, coleta no
servidor do banco e envia o e-mail é o `coletor/coletor.py` (ou o n8n). Se ele
não estiver rodando em separado, o agendamento fica parado e o e-mail nunca sai.

Esta thread reaproveita o mesmo código do coletor. Para desligar (por exemplo,
se você prefere rodar o coletor como serviço próprio ou usar o n8n), ponha
COLETOR_EMBUTIDO=false no .env.
"""
import importlib.util
import os
import threading
import time

from config import Config

_CAMINHO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "coletor", "coletor.py"))

def _carregar():
    spec = importlib.util.spec_from_file_location("nexus_coletor", _CAMINHO)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo

def iniciar_thread():
    if os.getenv("COLETOR_EMBUTIDO", "true").strip().lower() in ("false", "0", "nao", "não"):
        print("[Coletor] Embutido desligado (COLETOR_EMBUTIDO=false). Rode coletor/coletor.py ou o n8n.")
        return
    if not Config.N8N_API_KEY:
        print("[Coletor] Desligado: defina N8N_API_KEY no .env para enviar relatórios agendados.")
        return
    try:
        coletor = _carregar()
    except ImportError as erro:
        print(f"[Coletor] Não iniciou: falta um pacote ({erro}). Rode: pip install -r requirements.txt")
        return
    except Exception as erro:
        print(f"[Coletor] Não iniciou: {type(erro).__name__}: {erro}")
        return

    if not os.getenv("COLETOR_BASE_URL", "").strip():
        coletor.Cfg.BASE_URL = f"http://127.0.0.1:{Config.FLASK_PORT}"

    def _laco():
        time.sleep(5)
        while True:
            try:
                coletor.ciclo()
            except Exception as erro:
                print(f"[Coletor] erro no ciclo: {type(erro).__name__}: {erro}")
            time.sleep(coletor.Cfg.INTERVALO)

    threading.Thread(target=_laco, name="coletor-relatorios", daemon=True).start()
    print(f"[Coletor] Relatórios agendados ativos (verifica a cada {coletor.Cfg.INTERVALO}s; "
          f"e-mail via {coletor.Cfg.SMTP_HOST}:{coletor.Cfg.SMTP_PORT} como {coletor.Cfg.SMTP_USER or '(SMTP_USER vazio)'}).")
