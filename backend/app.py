import os
from flask import Flask
from flask_cors import CORS
from controllers.alerta_controller import alerta_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(alerta_bp)


@app.route("/")
def index():
    return {"status": "online", "servico": "Nexus Air API"}


if __name__ == "__main__":
    porta = int(os.getenv("FLASK_PORT", 5000))
    app.run(host="0.0.0.0", port=porta, debug=True)
