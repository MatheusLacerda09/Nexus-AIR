const db = require('../database/connection');

class ComputadorRepository {
  static async buscarComDetalhesESetor(filtros = {}) {
    let query = `
      SELECT 
        c.id, c.hostname, c.ip_address, c.status,
        s.nome AS setor_nome,
        COUNT(m.id) AS total_metricas_coletadas
      FROM computadores c
      LEFT JOIN setores s ON c.setor_id = s.id
      LEFT JOIN metricas m ON c.id = m.computador_id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.status) {
      query += ' AND c.status = ?';
      params.push(filtros.status);
    }

    if (filtros.setor_id) {
      query += ' AND c.setor_id = ?';
      params.push(filtros.setor_id);
    }

    query += ' GROUP BY c.id, s.nome';

    const [rows] = await db.execute(query, params);
    return rows;
  }
}

module.exports = ComputadorRepository;
