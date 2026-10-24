from database import get_db_connection

class LocalTrabalhoRepository:
    """
    Acesso a dados da tabela "local_trabalho".

    Diferente da EmpresaRepository (empresa-cliente, com CNPJ validado de
    verdade), aqui o registro so serve para nomear onde uma pessoa comum
    diz que trabalha. Por isso o unico metodo de escrita e um
    "find or create" por nome: nunca duplicamos o mesmo local de trabalho,
    mas tambem nunca exigimos CNPJ real (nem que exista CNPJ nenhum).
    """

    COLUNAS = "id, nome, cnpj"

    def buscar_por_id(self, local_trabalho_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM local_trabalho WHERE id = %s LIMIT 1", (local_trabalho_id,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_nome(self, nome):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM local_trabalho WHERE nome = %s LIMIT 1", (nome,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def inserir(self, nome, cnpj=None):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            cursor.execute(
                "INSERT INTO local_trabalho (nome, cnpj) VALUES (%s, %s)",
                (nome, cnpj),
            )
            conexao.commit()
            novo_id = cursor.lastrowid
            cursor.close()
            return novo_id
        finally:
            conexao.close()

    def listar_todos(self):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM local_trabalho ORDER BY nome")
            linhas = cursor.fetchall()
            cursor.close()
            return linhas
        finally:
            conexao.close()
