import mysql.connector

class AlertaRepository:
    def __init__(self, db_connection):
        self.db = db_connection

    def buscar_alertas_detalhados(self, tipo_alerta=None):
        cursor = self.db.cursor(dictionary=True)
        # Executa a Procedure via CALL
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
