const ComputadorService = require('../services/computador_service');

class ComputadorController {
  async criar(req, res) {
    try {
      const resultado = await computadorService.cadastrarComputador(req.body);
      return res.status(201).json({ status: 'success', data: resultado });
    } catch (error) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const resultado = await computadorService.atualizarComputador(id, req.body);
      return res.status(200).json({ status: 'success', data: resultado });
    } catch (error) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async listarDetalhes(req, res) {
    try {
      const relatorio = await computadorService.listarComDetalhes(req.query);
      return res.status(200).json({ status: 'success', data: relatorio });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new ComputadorController();
