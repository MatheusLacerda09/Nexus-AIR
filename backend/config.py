"""
Configuracao central da aplicacao.

Concentra a leitura das variaveis de ambiente (.env) em um unico lugar,
para que app.py, database/__init__.py e demais modulos nao precisem
lidar diretamente com os.getenv espalhados pelo codigo.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Banco de dados
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "nexus_air")
    DB_PORT = int(os.getenv("DB_PORT", 3306))

    # Flask / sessao (login)
    FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "chave-de-desenvolvimento-nao-use-em-producao")
