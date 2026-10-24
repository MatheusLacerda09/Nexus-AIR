import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from database.wamp_autostart import garantir_mysql_ativo
from database.migracao import garantir_esquema
from controllers.auth_controller import auth_bp
from controllers.usuario_controller import usuario_bp
from controllers.alerta_controller import alerta_bp
from controllers.sistema_controller import sistema_bp
from controllers.automation_controller import automation_bp
from controllers.tarefa_controller import tarefa_bp
from controllers.agendamento_controller import agendamento_bp
from controllers.zabbix_controller import zabbix_bp
from controllers.maquina_controller import maquina_bp
from services import zabbix_sync, coletor_embutido

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.secret_key = Config.SECRET_KEY
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

    if not Config.FLASK_DEBUG or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        garantir_mysql_ativo()

        garantir_esquema()

        zabbix_sync.iniciar_thread()

        coletor_embutido.iniciar_thread()

    app.run(host="0.0.0.0", port=Config.FLASK_PORT, debug=Config.FLASK_DEBUG)
