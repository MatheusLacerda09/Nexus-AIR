"""
Migração automática do esquema, executada toda vez que o backend sobe.

Motivo: "CREATE TABLE IF NOT EXISTS" (banco.sql) não altera tabelas que já
existem. Bancos criados em versões antigas ficavam sem a tabela "empresa",
sem a tabela "local_trabalho" e sem a coluna "usuario.local_trabalho_id",
gerando erros como "Unknown column 'local_trabalho_id'". Aqui cada passo
só é aplicado se ainda não existir, então é seguro rodar quantas vezes
for preciso.
"""

import mysql.connector
from mysql.connector import errorcode

from config import Config

TABELAS = {
    "empresa": """
        CREATE TABLE IF NOT EXISTS empresa (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            cnpjs VARCHAR(14) NOT NULL UNIQUE,
            endereco VARCHAR(200) NOT NULL,
            telefone VARCHAR(20) NOT NULL,
            email VARCHAR(200) NOT NULL UNIQUE,
            ceos VARCHAR(200),
            setores VARCHAR(200),
            departamentos VARCHAR(200)
        )
    """,
    "local_trabalho": """
        CREATE TABLE IF NOT EXISTS local_trabalho (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(150) NOT NULL UNIQUE,
            cnpj VARCHAR(20)
        )
    """,

    "tarefa": """
        CREATE TABLE IF NOT EXISTS tarefa (
            cliente VARCHAR(100) NOT NULL,
            id VARCHAR(50) NOT NULL,
            tarefa VARCHAR(150) NOT NULL,
            origem VARCHAR(100) NOT NULL,
            tempo VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL,
            quando DATETIME NOT NULL,
            excluida TINYINT(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (cliente, id)
        )
    """,

    "alerta_tarefa": """
        CREATE TABLE IF NOT EXISTS alerta_tarefa (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cliente VARCHAR(100) NOT NULL,
            tipo_alerta VARCHAR(100) NOT NULL,
            status_alerta VARCHAR(200) NOT NULL,
            contexto VARCHAR(100),
            horario DATETIME NOT NULL,
            severidade VARCHAR(20) NOT NULL DEFAULT 'media',
            descricao VARCHAR(500),
            recomendacao VARCHAR(500),
            criado_por VARCHAR(100),
            verificado TINYINT(1) NOT NULL DEFAULT 0,
            verificado_por VARCHAR(100),
            verificado_em DATETIME,
            observacao_verificacao VARCHAR(500),
            tarefa_id VARCHAR(50),
            tarefa_nome VARCHAR(150),
            tarefa_origem VARCHAR(100),
            tarefa_tempo VARCHAR(30),
            tarefa_status VARCHAR(30),
            INDEX idx_alerta_tarefa_cliente (cliente, verificado)
        )
    """,
}

COLUNAS_ALERTA = {
    "cliente": "VARCHAR(100) NOT NULL DEFAULT 'Nexus Air'",
    "severidade": "VARCHAR(20) NOT NULL DEFAULT 'media'",
    "descricao": "VARCHAR(500)",
    "recomendacao": "VARCHAR(500)",
    "criado_por": "VARCHAR(100)",
    "verificado": "TINYINT(1) NOT NULL DEFAULT 0",
    "verificado_por": "VARCHAR(100)",
    "verificado_em": "DATETIME",
    "observacao_verificacao": "VARCHAR(500)",
    "zabbix_eventid": "VARCHAR(50)",
    "zabbix_estado": "VARCHAR(20)",
    "zabbix_host": "VARCHAR(150)",
    "zabbix_pendente": "TINYINT(1) NOT NULL DEFAULT 0",
}

def _coluna_existe(cursor, tabela, coluna):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
        (Config.DB_NAME, tabela, coluna),
    )
    return cursor.fetchone()[0] > 0

def _constraint_existe(cursor, tabela, nome):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s",
        (Config.DB_NAME, tabela, nome),
    )
    return cursor.fetchone()[0] > 0

def _tabela_existe(cursor, tabela):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
        (Config.DB_NAME, tabela),
    )
    return cursor.fetchone()[0] > 0

def garantir_esquema():
    """Cria o que estiver faltando e corrige o acesso de quem cadastrou empresa
    antes da correção (tipo_acesso "empresa" -> "admin", cargo "Administrador").
    Nunca apaga dados."""
    try:
        conexao = mysql.connector.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            port=Config.DB_PORT,
        )
    except mysql.connector.Error as erro:
        if erro.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            print(
                "\n[Nexus Air] O MySQL recusou o acesso (erro 1045).\n"
                f"  Usuário usado: '{Config.DB_USER}' em {Config.DB_HOST}:{Config.DB_PORT}\n"
                "  Confira DB_USER e DB_PASSWORD no arquivo backend/.env — a senha\n"
                "  precisa ser a mesma do seu MySQL (no WampServer o padrão do 'root'\n"
                "  é senha vazia: deixe 'DB_PASSWORD=' sem nada).\n"
            )
        else:
            print(f"\n[Nexus Air] Não foi possível conectar ao MySQL: {erro}\n")
        raise

    try:
        cursor = conexao.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{Config.DB_NAME}`")
        cursor.execute(f"USE `{Config.DB_NAME}`")

        for ddl in TABELAS.values():
            cursor.execute(ddl)

        if _tabela_existe(cursor, "usuario"):
            if not _coluna_existe(cursor, "usuario", "local_trabalho_id"):
                cursor.execute("ALTER TABLE usuario ADD COLUMN local_trabalho_id INT")
                print("[Nexus Air] Coluna usuario.local_trabalho_id criada.")
            if not _coluna_existe(cursor, "usuario", "volume_musica"):
                cursor.execute(
                    "ALTER TABLE usuario ADD COLUMN volume_musica "
                    "DECIMAL(4,3) NOT NULL DEFAULT 0.140"
                )
                print("[Nexus Air] Coluna usuario.volume_musica criada.")
            if not _coluna_existe(cursor, "usuario", "foto_perfil"):
                cursor.execute("ALTER TABLE usuario ADD COLUMN foto_perfil MEDIUMBLOB")
                print("[Nexus Air] Coluna usuario.foto_perfil criada.")
            if not _coluna_existe(cursor, "usuario", "foto_mime"):
                cursor.execute("ALTER TABLE usuario ADD COLUMN foto_mime VARCHAR(50)")
                print("[Nexus Air] Coluna usuario.foto_mime criada.")
            if not _coluna_existe(cursor, "usuario", "idioma"):
                cursor.execute("ALTER TABLE usuario ADD COLUMN idioma VARCHAR(10) NOT NULL DEFAULT 'pt-BR'")
                print("[Nexus Air] Coluna usuario.idioma criada.")
            if not _constraint_existe(cursor, "usuario", "fk_usuario_local_trabalho"):
                cursor.execute(
                    "ALTER TABLE usuario ADD CONSTRAINT fk_usuario_local_trabalho "
                    "FOREIGN KEY (local_trabalho_id) REFERENCES local_trabalho(id) "
                    "ON DELETE SET NULL"
                )

            cursor.execute(
                "UPDATE usuario SET tipo_acesso = 'admin', "
                "cargo = IF(cargo IS NULL OR cargo = '', 'Administrador', cargo) "
                "WHERE tipo_acesso = 'empresa'"
            )
            if cursor.rowcount:
                print(f"[Nexus Air] {cursor.rowcount} conta(s) de empresa atualizada(s) para administrador.")

        if _tabela_existe(cursor, "alerta"):
            for coluna, definicao in COLUNAS_ALERTA.items():
                if not _coluna_existe(cursor, "alerta", coluna):
                    cursor.execute(f"ALTER TABLE alerta ADD COLUMN {coluna} {definicao}")
                    print(f"[Nexus Air] Coluna alerta.{coluna} criada.")
            for ip in ("ip_maquina", "ip_banco"):
                cursor.execute(
                    "SELECT IS_NULLABLE FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'alerta' AND COLUMN_NAME = %s",
                    (Config.DB_NAME, ip),
                )
                linha = cursor.fetchone()
                if linha and linha[0] == "NO":
                    cursor.execute(f"ALTER TABLE alerta MODIFY {ip} VARCHAR(15) NULL")
                    print(f"[Nexus Air] alerta.{ip} agora aceita vazio.")
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.STATISTICS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'alerta' AND INDEX_NAME = 'idx_alerta_cliente'",
                (Config.DB_NAME,),
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("CREATE INDEX idx_alerta_cliente ON alerta (cliente, verificado)")

        conexao.commit()
        cursor.close()
    finally:
        conexao.close()
