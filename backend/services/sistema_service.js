const os = require('os');

function medirTemposCPU(){
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  cpus.forEach(cpu=>{
    for(const tipo in cpu.times){
      total += cpu.times[tipo];
    }
    idle += cpu.times.idle;
  });
  return { idle, total };
}

function obterStatusSistema(){
  return new Promise(resolve=>{
    const inicio = medirTemposCPU();

    setTimeout(()=>{
      const fim = medirTemposCPU();
      const deltaIdle = fim.idle - inicio.idle;
      const deltaTotal = fim.total - inicio.total;
      const usoPercentual = deltaTotal > 0 ? Math.round(100 - (deltaIdle / deltaTotal) * 100) : 0;
      const livrePercentual = 100 - usoPercentual;

      const cpus = os.cpus();
      const velocidadeGHz = (cpus[0].speed / 1000).toFixed(2);
      const nucleos = cpus.length;
      const tempoAtividadeSegundos = Math.floor(os.uptime());

      resolve({
        velocidadeGHz,
        nucleos,
        usoPercentual,
        livrePercentual,
        tempoAtividadeSegundos
      });
    }, 250);
  });
}

module.exports = { obterStatusSistema };
