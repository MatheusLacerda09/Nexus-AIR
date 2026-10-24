import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "nexus_air")
    DB_PORT = int(os.getenv("DB_PORT", 3306))

    DB_SSL = os.getenv("DB_SSL", "false").lower() == "true"
    DB_SSL_CA = os.getenv("DB_SSL_CA", "").strip() or None
    DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", 10))

    @classmethod
    def db_e_local(cls):
        return cls.DB_HOST.strip().lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0")

    @classmethod
    def db_kwargs(cls, com_database=True):
        """Argumentos de conexão compartilhados (app e migração)."""
        args = dict(
            host=cls.DB_HOST, user=cls.DB_USER, password=cls.DB_PASSWORD,
            port=cls.DB_PORT, connection_timeout=cls.DB_CONNECT_TIMEOUT,
            charset="utf8mb4",
        )
        if com_database:
            args["database"] = cls.DB_NAME
        if cls.DB_SSL:
            args["ssl_disabled"] = False
            if cls.DB_SSL_CA:
                args["ssl_ca"] = cls.DB_SSL_CA
        return args

    WAMP_PATH = os.getenv("WAMP_PATH", r"C:\wamp64")

    FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "chave-de-desenvolvimento-nao-use-em-producao")

    N8N_API_KEY = (os.getenv("N8N_API_KEY") or os.getenv("COLETOR_API_KEY") or "").strip()

    REPORT_TZ = os.getenv("REPORT_TZ", "America/Sao_Paulo")

    ORACLE_SCRIPT_PATH = os.getenv("ORACLE_SCRIPT_PATH", "/opt/nexus/relatorio/relatorio_oracle.sh")
    ORACLE_USE_SUDO = os.getenv("ORACLE_USE_SUDO", "true").lower() == "true"

    ZABBIX_URL = os.getenv("ZABBIX_URL", "").strip()
    ZABBIX_TOKEN = os.getenv("ZABBIX_TOKEN", "").strip()
    ZABBIX_USER = os.getenv("ZABBIX_USER", "").strip()
    ZABBIX_PASSWORD = os.getenv("ZABBIX_PASSWORD", "")

    ZABBIX_CLIENTE = os.getenv("ZABBIX_CLIENTE", "Nexus Air").strip() or "Nexus Air"
    ZABBIX_INTERVALO = max(5, int(os.getenv("ZABBIX_INTERVALO", 30)))
    ZABBIX_TIMEOUT = int(os.getenv("ZABBIX_TIMEOUT", 15))
    ZABBIX_VERIFY_SSL = os.getenv("ZABBIX_VERIFY_SSL", "true").lower() == "true"
    ZABBIX_LIMITE = int(os.getenv("ZABBIX_LIMITE", 500))

    @classmethod
    def zabbix_ativo(cls):
        return bool(cls.ZABBIX_URL and (cls.ZABBIX_TOKEN or (cls.ZABBIX_USER and cls.ZABBIX_PASSWORD)))
