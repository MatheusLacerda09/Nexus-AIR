from database import get_db_connection

class EmpresaRepository:
    """
    Acesso a dados da tabela "empresa".

    Segue o mesmo padrao do UsuarioRepository: so fala SQL, nao conhece
    regra de negocio (isso fica no EmpresaService/EmpresaModel).
    """

    COLUNAS = "id, nome, cnpjs, endereco, telefone, email, ceos, setores, departamentos"

    def inserir(self, empresa):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            query = """
                INSERT INTO empresa
                    (nome, cnpjs, endereco, telefone, email, ceos, setores, departamentos)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            valores = (
                empresa.nome, empresa.cnpjs, empresa.endereco, empresa.telefone,
                empresa.email, empresa.ceos, empresa.setores, empresa.departamentos,
            )
            cursor.execute(query, valores)
            conexao.commit()
            novo_id = cursor.lastrowid
            cursor.close()
            return novo_id
        finally:
            conexao.close()

    def atualizar(self, empresa):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            query = """
                UPDATE empresa SET
                    nome = %s, cnpjs = %s, endereco = %s, telefone = %s,
                    email = %s, ceos = %s, setores = %s, departamentos = %s
                WHERE id = %s
            """
            valores = (
                empresa.nome, empresa.cnpjs, empresa.endereco, empresa.telefone,
                empresa.email, empresa.ceos, empresa.setores, empresa.departamentos,
                empresa.id,
            )
            cursor.execute(query, valores)
            conexao.commit()
            cursor.close()
        finally:
            conexao.close()

    def excluir(self, empresa_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            cursor.execute("DELETE FROM empresa WHERE id = %s", (empresa_id,))
            conexao.commit()
            cursor.close()
        finally:
            conexao.close()

    def buscar_por_id(self, empresa_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM empresa WHERE id = %s LIMIT 1", (empresa_id,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_cnpj(self, cnpj):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM empresa WHERE cnpjs = %s LIMIT 1", (cnpj,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_email(self, email):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM empresa WHERE email = %s LIMIT 1", (email,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def listar_todos(self):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM empresa ORDER BY nome")
            linhas = cursor.fetchall()
            cursor.close()
            return linhas
        finally:
            conexao.close()

    def listar_nomes(self):
        """Só os nomes já cadastrados — usado para o aviso de nome de
        empresa parecido na tela de cadastro (mais leve que listar_todos)."""
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(buffered=True)
            cursor.execute("SELECT nome FROM empresa")
            linhas = cursor.fetchall()
            cursor.close()
            return [linha[0] for linha in linhas]
        finally:
            conexao.close()
