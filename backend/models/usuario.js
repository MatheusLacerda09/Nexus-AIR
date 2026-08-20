const db = require('../database/connection');

class Usuario {
  constructor(data = {}) {
    this.id = data.id || null;
    this.nome = data.nome || null;
    this.cargo = data.cargo || null;
    this.departamento = data.departamento || null;
    this.custo_hora = data.custo_hora || 0;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM usuario WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return new Usuario(rows[0]);
  }

  async create() {
    const query = 'INSERT INTO usuario (nome, cargo, departamento, custo_hora) VALUES (?, ?, ?, ?)';
    const [result] = await db.execute(query, [this.nome, this.cargo, this.departamento, this.custo_hora]);
    this.id = result.insertId;
    return this;
  }

  async update() {
    const query = 'UPDATE usuario SET nome = ?, cargo = ?, departamento = ?, custo_hora = ? WHERE id = ?';
    await db.execute(query, [this.nome, this.cargo, this.departamento, this.custo_hora, this.id]);
    return this;
  }

  async delete() {
    const query = 'DELETE FROM usuario WHERE id = ?';
    await db.execute(query, [this.id]);
    return true;
  }
}

module.exports = Usuario;
