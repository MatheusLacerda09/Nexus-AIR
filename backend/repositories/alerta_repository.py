import mysql.connector

class AlertaRepository:
    def __init__(self, db_connection):
        self.db = db_connection

    def buscar_alertas_detalhados(self, tipo_alerta=None):
        cursor = self.db.cursor(dictionary=True)
        cursor.callproc('sp_obter_alertas_detalhados', [tipo_alerta])
        
        resultados = []
        for result in cursor.stored_results():
            resultados.extend(result.fetchall())
            
        cursor.close()
        return resultados

    def relatorio_resolucao_suporte(self, id_suporte=None):
        cursor = self.db.cursor(dictionary=True)
        cursor.callproc('sp_relatorio_resolucao_suporte', [id_suporte])
        
        resultados = []
        for result in cursor.stored_results():
            resultados.extend(result.fetchall())
            
        cursor.close()
        return resultados

    def listar_maquinas_criticas(self, cpu_limite=80.0):
        cursor = self.db.cursor(dictionary=True)
        cursor.callproc('sp_maquinas_alto_consumo', [cpu_limite])
        
        resultados = []
        for result in cursor.stored_results():
            resultados.extend(result.fetchall())
            
        cursor.close()
        return resultados

_CAMPOS_ALERTA = """
    a.id, a.tipo_alerta, a.status_alerta, a.contexto, a.horario, a.origem,
    a.severidade, a.descricao, a.recomendacao, a.criado_por,
    a.verificado, a.verificado_por, a.verificado_em, a.observacao_verificacao,
    a.zabbix_eventid, a.zabbix_estado, a.zabbix_host, a.zabbix_pendente,
    a.ip_maquina, mv.hostname AS maquina_hostname,
    mv.status_olvm AS maquina_status_olvm, mv.status_zabbix AS maquina_status_zabbix,
    mv.consumo_cpu AS maquina_cpu, mv.consumo_ram AS maquina_ram,
    a.ip_banco, b.status_olvm AS banco_status_olvm, b.status_zabbix AS banco_status_zabbix,
    b.consumo_memoria AS banco_memoria, b.log_erro AS banco_log_erro
"""
_JOINS_ALERTA = """
    FROM alerta a
    LEFT JOIN maquinas_virtuais mv ON mv.ip = a.ip_maquina
    LEFT JOIN banco b ON b.ip = a.ip_banco
"""

_CAMPOS_ALERTA_TAREFA = """
    id, tipo_alerta, status_alerta, contexto, horario, severidade, descricao,
    recomendacao, criado_por, verificado, verificado_por, verificado_em,
    observacao_verificacao, tarefa_id, tarefa_nome, tarefa_origem, tarefa_tempo, tarefa_status
"""

def _alerta_tarefa_para_dict(linha):
    """Normaliza uma linha de alerta_tarefa para o mesmo formato dos demais."""
    if linha is None:
        return None
    saida = {k: v for k, v in linha.items() if not k.startswith("tarefa_")}
    saida["id"] = f"t-{linha['id']}"
    saida["origem"] = "tarefa"
    saida["tarefa"] = {
        "id": linha["tarefa_id"], "nome": linha["tarefa_nome"], "origem": linha["tarefa_origem"],
        "tempo": linha["tarefa_tempo"], "status": linha["tarefa_status"],
    }
    return saida

class CentralAlertasRepository:
    def __init__(self, db_connection):
        self.db = db_connection

    def listar(self, verificado, cliente):
        """verificado: False (pendentes), True (verificados) ou None (todos)."""
        sql = f"SELECT {_CAMPOS_ALERTA} {_JOINS_ALERTA} WHERE a.cliente = %s"
        params = [cliente]
        if verificado is not None:
            sql += " AND a.verificado = %s"
            params.append(1 if verificado else 0)
        sql += " ORDER BY a.horario DESC, a.id DESC"
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(sql, params)
        linhas = cursor.fetchall()
        cursor.close()
        return linhas

    def contar_pendentes(self, cliente):
        cursor = self.db.cursor()
        cursor.execute("SELECT COUNT(*) FROM alerta WHERE verificado = 0 AND cliente = %s", [cliente])
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM alerta_tarefa WHERE verificado = 0 AND cliente = %s", [cliente])
        total += cursor.fetchone()[0]
        cursor.close()
        return total

    def buscar(self, alerta_id, cliente):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(
            f"SELECT {_CAMPOS_ALERTA} {_JOINS_ALERTA} WHERE a.id = %s AND a.cliente = %s",
            [alerta_id, cliente],
        )
        linha = cursor.fetchone()
        cursor.close()
        return linha

    def opcoes(self):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute("SELECT hostname, ip FROM maquinas_virtuais ORDER BY hostname")
        maquinas = cursor.fetchall()
        cursor.execute("SELECT ip FROM banco ORDER BY ip")
        bancos = cursor.fetchall()
        cursor.close()
        return maquinas, bancos

    def garantir_maquina(self, hostname, ip, status_zabbix):
        """Máquina cadastrada na tela de Máquinas ainda não existe na tabela SQL
        (que a chave estrangeira do alerta exige): cria a linha se faltar."""
        cursor = self.db.cursor()
        cursor.execute("SELECT COUNT(*) FROM maquinas_virtuais WHERE ip = %s", [ip])
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO maquinas_virtuais (hostname, ip, status_olvm, consumo_cpu, consumo_ram, status_zabbix) "
                "VALUES (%s, %s, 'desconhecido', 0, 0, %s)",
                [hostname[:100], ip, (status_zabbix or "desconhecido")[:50]],
            )
            self.db.commit()
        cursor.close()

    def garantir_banco(self, ip, status_zabbix):
        cursor = self.db.cursor()
        cursor.execute("SELECT COUNT(*) FROM banco WHERE ip = %s", [ip])
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO banco (ip, status_zabbix, status_olvm, log_erro, consumo_memoria) "
                "VALUES (%s, %s, 'desconhecido', NULL, 0)",
                [ip, (status_zabbix or "desconhecido")[:50]],
            )
            self.db.commit()
        cursor.close()

    def existe_ip(self, tabela, ip):

        cursor = self.db.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {tabela} WHERE ip = %s", [ip])
        achou = cursor.fetchone()[0] > 0
        cursor.close()
        return achou

    def criar(self, dados):
        cursor = self.db.cursor()
        cursor.execute(
            "INSERT INTO alerta (cliente, ip_maquina, ip_banco, tipo_alerta, status_alerta, contexto, "
            "horario, origem, severidade, descricao, recomendacao, criado_por, verificado) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)",
            [dados["cliente"], dados["ip_maquina"], dados["ip_banco"], dados["tipo_alerta"],
             dados["status_alerta"], dados["contexto"], dados["horario"], dados["origem"],
             dados["severidade"], dados["descricao"], dados["recomendacao"], dados["criado_por"]],
        )
        novo_id = cursor.lastrowid
        self.db.commit()
        cursor.close()
        return novo_id

    def marcar_verificado(self, alerta_id, cliente, por, observacao, quando):
        """Só altera se ainda estiver pendente. Retorna True se verificou agora."""
        cursor = self.db.cursor()
        cursor.execute(
            "UPDATE alerta SET verificado = 1, verificado_por = %s, verificado_em = %s, "
            "observacao_verificacao = %s WHERE id = %s AND cliente = %s AND verificado = 0",
            [por, quando, observacao, alerta_id, cliente],
        )
        alterou = cursor.rowcount > 0
        self.db.commit()
        cursor.close()
        return alterou

    def marcar_zabbix_pendente(self, alerta_id, cliente, pendente=True):
        """Pede ao sincronizador para avisar o Zabbix da verificação feita aqui."""
        cursor = self.db.cursor()
        cursor.execute("UPDATE alerta SET zabbix_pendente = %s WHERE id = %s AND cliente = %s",
                       [1 if pendente else 0, alerta_id, cliente])
        self.db.commit()
        cursor.close()

    def listar_tarefa(self, verificado, cliente):
        sql = f"SELECT {_CAMPOS_ALERTA_TAREFA} FROM alerta_tarefa WHERE cliente = %s"
        params = [cliente]
        if verificado is not None:
            sql += " AND verificado = %s"
            params.append(1 if verificado else 0)
        sql += " ORDER BY horario DESC, id DESC"
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(sql, params)
        linhas = [_alerta_tarefa_para_dict(l) for l in cursor.fetchall()]
        cursor.close()
        return linhas

    def buscar_tarefa(self, alerta_id, cliente):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(
            f"SELECT {_CAMPOS_ALERTA_TAREFA} FROM alerta_tarefa WHERE id = %s AND cliente = %s",
            [alerta_id, cliente],
        )
        linha = _alerta_tarefa_para_dict(cursor.fetchone())
        cursor.close()
        return linha

    def criar_tarefa(self, dados):
        cursor = self.db.cursor()
        cursor.execute(
            "INSERT INTO alerta_tarefa (cliente, tipo_alerta, status_alerta, severidade, contexto, horario, "
            "criado_por, descricao, recomendacao, tarefa_id, tarefa_nome, tarefa_origem, tarefa_tempo, "
            "tarefa_status, verificado) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)",
            [dados["cliente"], dados["tipo_alerta"], dados["status_alerta"], dados["severidade"],
             dados["contexto"], dados["horario"], dados["criado_por"], dados["descricao"],
             dados["recomendacao"], dados["tarefa_id"], dados["tarefa_nome"], dados["tarefa_origem"],
             dados["tarefa_tempo"], dados["tarefa_status"]],
        )
        novo_id = cursor.lastrowid
        self.db.commit()
        cursor.close()
        return novo_id

    def marcar_verificado_tarefa(self, alerta_id, cliente, por, observacao, quando):
        cursor = self.db.cursor()
        cursor.execute(
            "UPDATE alerta_tarefa SET verificado = 1, verificado_por = %s, verificado_em = %s, "
            "observacao_verificacao = %s WHERE id = %s AND cliente = %s AND verificado = 0",
            [por, quando, observacao, alerta_id, cliente],
        )
        alterou = cursor.rowcount > 0
        self.db.commit()
        cursor.close()
        return alterou

class TarefaRepository:
    """Tarefas do painel, separadas por empresa (cliente)."""

    def __init__(self, db_connection):
        self.db = db_connection

    def contar(self, cliente):
        cursor = self.db.cursor()
        cursor.execute("SELECT COUNT(*) FROM tarefa WHERE cliente = %s", [cliente])
        total = cursor.fetchone()[0]
        cursor.close()
        return total

    def inserir_varias(self, cliente, tarefas):
        cursor = self.db.cursor()
        cursor.executemany(
            "INSERT INTO tarefa (cliente, id, tarefa, origem, tempo, status, quando) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            [(cliente, t["id"], t["tarefa"], t["origem"], t["tempo"], t["status"], t["quando"]) for t in tarefas],
        )
        self.db.commit()
        cursor.close()

    def listar(self, cliente):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, tarefa, origem, tempo, status, quando FROM tarefa "
            "WHERE cliente = %s AND excluida = 0 ORDER BY id",
            [cliente],
        )
        linhas = cursor.fetchall()
        cursor.close()
        return linhas

    def buscar(self, cliente, tarefa_id):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, tarefa, origem, tempo, status, quando FROM tarefa "
            "WHERE cliente = %s AND id = %s AND excluida = 0",
            [cliente, tarefa_id],
        )
        linha = cursor.fetchone()
        cursor.close()
        return linha

    def atualizar_status(self, cliente, tarefa_id, status):
        cursor = self.db.cursor()
        cursor.execute(
            "UPDATE tarefa SET status = %s WHERE cliente = %s AND id = %s AND excluida = 0",
            [status, cliente, tarefa_id],
        )
        self.db.commit()
        cursor.close()

    def excluir(self, cliente, tarefa_id):

        cursor = self.db.cursor()
        cursor.execute(
            "UPDATE tarefa SET excluida = 1 WHERE cliente = %s AND id = %s AND excluida = 0",
            [cliente, tarefa_id],
        )
        self.db.commit()
        cursor.close()
