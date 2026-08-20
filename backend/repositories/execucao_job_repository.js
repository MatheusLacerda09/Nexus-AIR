const db = require('../database/connection');

class ExecucaoJobRepository {
  static async buscarHistoricoComVMsEUsuarios(filtros = {}) {
    let query = `
      SELECT 
        e.id AS execucao_id,
        e.timestamp,
        e.status,
        e.log_erro,
        v.hostname AS vm_hostname,
        v.ip AS vm_ip,
        u.nome AS usuario_nome
      FROM execucao_job e
      INNER JOIN maquina_virtual v ON e.vm_id = v.id
      INNER JOIN usuario u ON e.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.status) {
      query += ' AND e.status = ?';
      params.push(filtros.status);
    }

    if (filtros.vm_id) {
      query += ' AND e.vm_id = ?';
      params.push(filtros.vm_id);
    }

    query += ' ORDER BY e.timestamp DESC';

    const [rows] = await db.execute(query, params);
    return rows;
  }
}

module.exports = ExecucaoJobRepository;
