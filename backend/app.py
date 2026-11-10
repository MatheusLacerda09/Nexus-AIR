import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from controllers.auth_controller import auth_bp
from controllers.usuario_controller import usuario_bp
from controllers.alerta_controller import alerta_bp
from controllers.sistema_controller import sistema_bp
from controllers.automation_controller import automation_bp
from controllers.tarefa_controller import tarefa_bp
from controllers.agendamento_controller import agendamento_bp
from controllers.zabbix_controller import zabbix_bp
from controllers.maquina_controller import maquina_bp

FRONTEND_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.secret_key = getattr(Config, "SECRET_KEY", "nexus-air-secret-key")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=6 * 1024 * 1024,
)

CORS(app, supports_credentials=True)

app.register_blueprint(auth_bp)
app.register_blueprint(usuario_bp)
app.register_blueprint(alerta_bp)
app.register_blueprint(sistema_bp)
app.register_blueprint(automation_bp)
app.register_blueprint(tarefa_bp)
app.register_blueprint(agendamento_bp)
app.register_blueprint(zabbix_bp)
app.register_blueprint(maquina_bp)

@app.route("/api")
def api_status():
    return {"status": "online", "servico": "Nexus Air API"}

@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/login")
@app.route("/entrar")
def pagina_login():
    return send_from_directory(app.static_folder, "login.html")

@app.route("/cadastro")
@app.route("/criar-conta")
def pagina_cadastro():
    return send_from_directory(app.static_folder, "cadastro.html")

if __name__ == "__main__":
    try:
        from database.wamp_autostart import garantir_mysql_ativo
        from database.migracao import garantir_esquema
        from services import zabbix_sync, coletor_embutido

        if not Config.FLASK_DEBUG or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
            garantir_mysql_ativo()
            garantir_esquema()
            zabbix_sync.iniciar_thread()
            coletor_embutido.iniciar_thread()
    except Exception as e:
        print(f"Aviso ao inicializar servicos locais: {e}")

    app.run(host="0.0.0.0", port=getattr(Config, "FLASK_PORT", 5000), debug=getattr(Config, "FLASK_DEBUG", True))
