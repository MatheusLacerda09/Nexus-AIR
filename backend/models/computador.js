const db = require('../database/connection');

class Computador {
  constructor(data = {}) {
    this.id = data.id || null;
    this.hostname = data.hostname || null;
    this.ip_address = data.ip_address || null;
    this.status = data.status || 'OFFLINE';
    this.setor_id = data.setor_id || null;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM computadores WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return new Computador(rows[0]);
  }

  async create() {
    const query = 'INSERT INTO computadores (hostname, ip_address, status, setor_id) VALUES (?, ?, ?, ?)';
    const [result] = await db.execute(query, [this.hostname, this.ip_address, this.status, this.setor_id]);
    this.id = result.insertId;
    return this;
  }

  async update() {
    const query = 'UPDATE computadores SET hostname = ?, ip_address = ?, status = ?, setor_id = ? WHERE id = ?';
    await db.execute(query, [this.hostname, this.ip_address, this.status, this.setor_id, this.id]);
    return this;
  }

  async delete() {
    const query = 'DELETE FROM computadores WHERE id = ?';
    await db.execute(query, [this.id]);
    return true;
  }
}

module.exports = Computador;
