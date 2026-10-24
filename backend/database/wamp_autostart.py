"""
Sobe o MySQL do WampServer automaticamente, sem precisar abrir o
WampServer nem o MySQL manualmente.

Como funciona:
1. Verifica se já existe algo escutando em DB_HOST:DB_PORT.
   Se sim, não faz nada (o banco já está de pé).
2. Se não, localiza o executável mysqld.exe dentro da instalação do
   Wamp (WAMP_PATH) e o inicia diretamente, em segundo plano, sem
   abrir a janela/ícone do WampServer.
3. Aguarda a porta responder antes de liberar o Flask para subir.

Só faz sentido no Windows (onde o WampServer roda). Em qualquer outro
sistema operacional a função simplesmente não faz nada.
"""

import glob
import os
import socket
import subprocess
import time

from config import Config

def _mysql_esta_ativo(host: str, port: int, timeout: float = 1.0) -> bool:
    """Tenta abrir uma conexão TCP rápida para ver se o MySQL já está de pé."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def _localizar_mysqld(wamp_path: str):
    """
    Procura o mysqld.exe dentro de C:\\wampXX\\bin\\mysql\\mysqlX.X.X\\bin\\.
    O Wamp guarda cada versão do MySQL numa subpasta própria, então
    usamos glob para não depender do número exato da versão.
    """
    padrao = os.path.join(wamp_path, "bin", "mysql", "mysql*", "bin", "mysqld.exe")
    candidatos = sorted(glob.glob(padrao))
    if not candidatos:
        return None, None

    mysqld_path = candidatos[-1]
    pasta_versao = os.path.dirname(os.path.dirname(mysqld_path))
    ini_path = os.path.join(pasta_versao, "my.ini")
    return mysqld_path, (ini_path if os.path.isfile(ini_path) else None)

def garantir_mysql_ativo(timeout_segundos: int = 30) -> bool:
    """
    Garante que o MySQL do Wamp esteja rodando antes do Flask subir.
    Retorna True se o banco está (ou ficou) ativo, False caso não tenha
    sido possível confirmar dentro do tempo limite.
    """
    host, port = Config.DB_HOST, Config.DB_PORT

    if _mysql_esta_ativo(host, port):
        print(f"[DB] MySQL já está ativo em {host}:{port}.")
        return True

    if os.name != "nt":
        print("[DB] Autostart do Wamp só é suportado no Windows. "
              "Suba o MySQL manualmente.")
        return False

    wamp_path = Config.WAMP_PATH
    mysqld_path, ini_path = _localizar_mysqld(wamp_path)

    if not mysqld_path:
        print(f"[DB] Não encontrei o mysqld.exe dentro de '{wamp_path}'. "
              f"Confira o caminho na variável WAMP_PATH do seu .env.")
        return False

    print(f"[DB] MySQL parado. Iniciando automaticamente: {mysqld_path}")

    comando = [mysqld_path]
    if ini_path:
        comando.append(f"--defaults-file={ini_path}")

    flags = 0x00000008 | 0x08000000
    subprocess.Popen(
        comando,
        cwd=os.path.dirname(mysqld_path),
        creationflags=flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    inicio = time.time()
    while time.time() - inicio < timeout_segundos:
        if _mysql_esta_ativo(host, port):
            print(f"[DB] MySQL subiu com sucesso em {host}:{port}.")
            return True
        time.sleep(0.5)

    print(f"[DB] MySQL não respondeu em {host}:{port} após "
          f"{timeout_segundos}s. Verifique o WAMP_PATH ou suba manualmente.")
    return False
