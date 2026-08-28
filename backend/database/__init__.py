"""
Camada de conexao com o banco de dados (MySQL).

Isolada aqui para que Repositories nunca precisem conhecer detalhes de
host/usuario/senha: eles apenas pedem `get_db_connection()`.
"""
import mysql.connector
from config import Config


def get_db_connection():
    """Abre uma nova conexao com o MySQL usando as credenciais do .env."""
    return mysql.connector.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        port=Config.DB_PORT,
    )
