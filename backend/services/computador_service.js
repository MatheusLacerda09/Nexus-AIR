const Computador = require('../models/computador');
const ComputadorRepository = require('../repositories/computador_repository');

class ComputadorService {
  async cadastrarComputador(dados) {
    if (!dados.hostname || !dados.ip_address) {
      throw new Error('Hostname e IP são obrigatórios.');
    }

    const novoComputador = new Computador(dados);
    return await novoComputador.create();
  }

  async atualizarComputador(id, dados) {
    const computador = await Computador.findById(id);
    if (!computador) {
      throw new Error('Computador não encontrado.');
    }

    computador.hostname = dados.hostname || computador.hostname;
    computador.ip_address = dados.ip_address || computador.ip_address;
    computador.status = dados.status || computador.status;

    return await computador.update();
  }

  async listarComDetalhes(filtros) {
    return await ComputadorRepository.buscarComDetalhesESetor(filtros);
  }
}

module.exports = new ComputadorService();
