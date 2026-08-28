from database import get_db_connection


class UsuarioRepository:
    """
    Unica camada responsavel por falar SQL com a tabela `usuario`.

    Nem o Model nem o Service conhecem colunas ou instrucoes SQL: eles
    apenas chamam estes metodos e recebem/entregam dicionarios simples.
    """

    COLUNAS = (
        "id, cliente, nome, senha, email, cargo, departamento, setor, "
        "telefone, cpf, data_nascimento, sexo, tipo_acesso, "
        "horario_trabalho, curriculo, data_ferias, faltas, criado_em"
    )

    def inserir(self, usuario):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            query = """
                INSERT INTO usuario
                    (cliente, nome, senha, email, cargo, departamento, setor,
                     telefone, cpf, data_nascimento, sexo, tipo_acesso,
                     horario_trabalho, curriculo, data_ferias, faltas)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            valores = (
                usuario.cliente, usuario.nome, usuario.senha, usuario.email,
                usuario.cargo, usuario.departamento, usuario.setor,
                usuario.telefone, usuario.cpf, usuario.data_nascimento,
                usuario.sexo, usuario.tipo_acesso, usuario.horario_trabalho,
                usuario.curriculo, usuario.data_ferias, usuario.faltas,
            )
            cursor.execute(query, valores)
            conexao.commit()
            novo_id = cursor.lastrowid
            cursor.close()
            return novo_id
        finally:
            conexao.close()

    def atualizar(self, usuario):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            query = """
                UPDATE usuario SET
                    cliente = %s, nome = %s, senha = %s, email = %s,
                    cargo = %s, departamento = %s, setor = %s, telefone = %s,
                    cpf = %s, data_nascimento = %s, sexo = %s, tipo_acesso = %s,
                    horario_trabalho = %s, curriculo = %s, data_ferias = %s,
                    faltas = %s
                WHERE id = %s
            """
            valores = (
                usuario.cliente, usuario.nome, usuario.senha, usuario.email,
                usuario.cargo, usuario.departamento, usuario.setor,
                usuario.telefone, usuario.cpf, usuario.data_nascimento,
                usuario.sexo, usuario.tipo_acesso, usuario.horario_trabalho,
                usuario.curriculo, usuario.data_ferias, usuario.faltas,
                usuario.id,
            )
            cursor.execute(query, valores)
            conexao.commit()
            cursor.close()
        finally:
            conexao.close()

    def excluir(self, usuario_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            cursor.execute("DELETE FROM usuario WHERE id = %s", (usuario_id,))
            conexao.commit()
            cursor.close()
        finally:
            conexao.close()

    def buscar_por_id(self, usuario_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario WHERE id = %s", (usuario_id,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_email(self, email):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario WHERE email = %s", (email,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def listar_todos(self):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario ORDER BY nome")
            linhas = cursor.fetchall()
            cursor.close()
            return linhas
        finally:
            conexao.close()
