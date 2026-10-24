let uptimeBaseSegundos = 0;

let uptimeReferenciaMs = 0;

let backendDisponivel = false;

function formatarTempo(totalSegundos) {
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = Math.floor(totalSegundos % 60);
  const base = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  return dias > 0 ? `${dias}d ${base}` : base;
}

async function buscarStatusCPU() {
  if (document.hidden) return;
  try {
    const resposta = await fetch('/api/sistema/status', { cache: 'no-store', credentials: 'same-origin' });
    if (!resposta.ok) throw new Error('offline');
    const corpo = await resposta.json();
    const dados = corpo.data;

    backendDisponivel = true;
    const inicioProjeto = Number(dados.inicioProjetoEpoch);
    uptimeBaseSegundos = Number.isFinite(inicioProjeto)
      ? Math.max(0, Math.floor(Date.now() / 1000 - inicioProjeto))
      : Math.max(0, Number(dados.tempoAtividadeSegundos) || 0);
    uptimeReferenciaMs = Date.now();

    atualizarTextoChart(document.getElementById('cpuVelocidade'), `${dados.velocidadeGHz} GHz`);
    atualizarTextoChart(document.getElementById('cpuUsoPct'), `${dados.usoPercentual}%`);
    atualizarTextoChart(document.getElementById('cpuLivrePct'), `${dados.livrePercentual}%`);
    const ramUso = document.getElementById('ramUsoPct');
    const ramTotal = document.getElementById('ramTotal');
    const ramLivre = document.getElementById('ramLivre');
    atualizarTextoChart(ramUso, `${dados.ramUsoPercentual ?? '--'}%`);
    atualizarTextoChart(ramTotal, formatarMemoria(dados.ramTotalBytes));
    atualizarTextoChart(ramLivre, formatarMemoria(dados.ramLivreBytes));
    registrarAmostraRAM(dados.ramUsoPercentual);

    animarDonut('cpuChart', [
      { value: dados.usoPercentual, color: corAcentoGrafico() },
      { value: dados.livrePercentual, color: corTrilhaGrafico() }
    ]);
  } catch (erro) {
    if (!backendDisponivel) {
      document.getElementById('cpuVelocidade').textContent = 'Conecte o backend';
      const nucleos = navigator.hardwareConcurrency || '--';
      document.getElementById('cpuUsoPct').textContent = `${nucleos} núcleos`;
      document.getElementById('cpuLivrePct').textContent = '--';
    }
  }
}

function iniciarRelogioUptime() {
  setInterval(() => {
    if (document.hidden) return;
    if (backendDisponivel) {
      const decorridoMs = Date.now() - uptimeReferenciaMs;
      const totalSegundos = uptimeBaseSegundos + Math.floor(decorridoMs / 1000);
      document.getElementById('cpuUptime').textContent = formatarTempo(totalSegundos);
    } else {
      document.getElementById('cpuUptime').textContent = '--:--:--';
    }
  }, 1000);
}

function formatarMemoria(bytes) {
  if (!Number.isFinite(bytes)) return '--';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let valor = bytes,
    indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  return `${valor.toFixed(indice > 1 ? 1 : 0)} ${unidades[indice]}`;
}
