from database import get_db_connection

class UsuarioRepository:

    COLUNAS = (
        "id, cliente, nome, senha, email, cargo, departamento, setor, "
        "telefone, cpf, data_nascimento, sexo, tipo_acesso, "
        "horario_trabalho, curriculo, data_ferias, faltas, criado_em, "
        "local_trabalho_id, volume_musica, foto_mime, idioma"
    )

    def inserir(self, usuario):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            query = """
                INSERT INTO usuario
                    (cliente, nome, senha, email, cargo, departamento, setor,
                     telefone, cpf, data_nascimento, sexo, tipo_acesso,
                     horario_trabalho, curriculo, data_ferias, faltas,
                     local_trabalho_id, volume_musica, foto_mime, idioma)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            valores = (
                usuario.cliente, usuario.nome, usuario.senha, usuario.email,
                usuario.cargo, usuario.departamento, usuario.setor,
                usuario.telefone, usuario.cpf, usuario.data_nascimento,
                usuario.sexo, usuario.tipo_acesso, usuario.horario_trabalho,
                usuario.curriculo, usuario.data_ferias, usuario.faltas,
                usuario.local_trabalho_id, usuario.volume_musica, usuario.foto_mime, usuario.idioma,
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
                    faltas = %s, local_trabalho_id = %s, volume_musica = %s,
                    foto_mime = %s, idioma = %s
                WHERE id = %s
            """
            valores = (
                usuario.cliente, usuario.nome, usuario.senha, usuario.email,
                usuario.cargo, usuario.departamento, usuario.setor,
                usuario.telefone, usuario.cpf, usuario.data_nascimento,
                usuario.sexo, usuario.tipo_acesso, usuario.horario_trabalho,
                usuario.curriculo, usuario.data_ferias, usuario.faltas,
                usuario.local_trabalho_id, usuario.volume_musica, usuario.foto_mime, usuario.idioma,
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
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario WHERE id = %s LIMIT 1", (usuario_id,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_email(self, email):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario WHERE email = %s LIMIT 1", (email,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def buscar_por_cpf(self, cpf):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(f"SELECT {self.COLUNAS} FROM usuario WHERE cpf = %s LIMIT 1", (cpf,))
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def listar_nomes(self):
        """Só os nomes já cadastrados — usado para o aviso de nome
        semelhante na tela de cadastro (mais leve que listar_todos)."""
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(buffered=True)
            cursor.execute("SELECT nome FROM usuario")
            linhas = cursor.fetchall()
            cursor.close()
            return [linha[0] for linha in linhas]
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

    def listar_por_cliente(self, cliente):
        """Lista usuários do cliente, incluindo registros legados que
        guardavam o nome da empresa no campo departamento."""
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True)
            cursor.execute(
                f"SELECT {self.COLUNAS} FROM usuario "
                "WHERE cliente = %s OR departamento = %s ORDER BY nome",
                (cliente, cliente),
            )
            linhas = cursor.fetchall()
            cursor.close()
            return linhas
        finally:
            conexao.close()

    def buscar_foto(self, usuario_id):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor(dictionary=True, buffered=True)
            cursor.execute(
                "SELECT foto_perfil, foto_mime FROM usuario WHERE id = %s LIMIT 1",
                (usuario_id,),
            )
            linha = cursor.fetchone()
            cursor.close()
            return linha
        finally:
            conexao.close()

    def atualizar_foto(self, usuario_id, conteudo, mime):
        conexao = get_db_connection()
        try:
            cursor = conexao.cursor()
            cursor.execute(
                "UPDATE usuario SET foto_perfil = %s, foto_mime = %s WHERE id = %s",
                (conteudo, mime, usuario_id),
            )
            conexao.commit()
            cursor.close()
        finally:
            conexao.close()
