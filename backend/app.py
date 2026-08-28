import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from controllers.auth_controller import auth_bp
from controllers.usuario_controller import usuario_bp
from controllers.alerta_controller import alerta_bp
from controllers.sistema_controller import sistema_bp

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.secret_key = Config.SECRET_KEY

# Cookie de sessao (login) via mesma origem: o proprio Flask agora serve
# o frontend, entao nao ha mais necessidade de dois servidores/portas.
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)

CORS(app, supports_credentials=True)

# --- API (Blueprints / Controllers) ---
app.register_blueprint(auth_bp)
app.register_blueprint(usuario_bp)
app.register_blueprint(alerta_bp)
app.register_blueprint(sistema_bp)


@app.route("/api")
def api_status():
    return {"status": "online", "servico": "Nexus Air API"}


# --- Frontend (paginas estaticas) ---
@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/login")
def pagina_login():
    return send_from_directory(app.static_folder, "login.html")


@app.route("/cadastro")
def pagina_cadastro():
    return send_from_directory(app.static_folder, "cadastro.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.FLASK_PORT, debug=Config.FLASK_DEBUG)
