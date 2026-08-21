const sistemaService = require('../services/sistema_service');

async function status(req, res){
  try{
    const dados = await sistemaService.obterStatusSistema();
    res.status(200).json({ status:'success', data: dados });
  }catch(erro){
    res.status(500).json({ status:'error', message: erro.message });
  }
}

module.exports = { status };
