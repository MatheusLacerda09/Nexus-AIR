function corTrilhaGrafico() {
  return obterTemaAtual() === 'dark' ? 'rgba(255,255,255,0.12)' : '#e9e3ff';
}

function corAcentoGrafico() {
  return getComputedStyle(document.documentElement).getPropertyValue('--purple').trim() || '#5b2ee0';
}

function redesenharGraficosTema() {
  const cpuUsoEl = document.getElementById('cpuUsoPct');
  const usoAtual = cpuUsoEl ? parseFloat(cpuUsoEl.textContent) || 0 : 0;
  animarDonut('cpuChart', [
    { value: usoAtual, color: corAcentoGrafico() },
    { value: 100 - usoAtual, color: corTrilhaGrafico() }
  ]);
  animarDonut('tarefasChart', [
    { value: 82, color: corAcentoGrafico() },
    { value: 18, color: corTrilhaGrafico() }
  ]);
}

document.addEventListener('temaAlterado', e => {
  if (e.detail && e.detail.persistir) redesenharGraficosTema();
});

function drawDonut(canvasId, segments, progresso) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2,
    cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 6;
  const innerRadius = radius * 0.62;
  let startAngle = -Math.PI / 2;

  segments.forEach(seg => {
    const angle = (seg.value / 100) * Math.PI * 2 * progresso;
    const endAngle = startAngle + angle;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill('evenodd');
    startAngle += angle;
  });
}

const animacoesDonut = {};

function animarDonut(canvasId, segments) {
  const anterior = animacoesDonut[canvasId];
  if (anterior?.frame) cancelAnimationFrame(anterior.frame);
  const destino = segments.map(seg => ({ ...seg, value: Number(seg.value) || 0 }));
  const origem = (anterior?.segments || destino.map(seg => ({ ...seg, value: 0 }))).map((seg, i) => ({
    value: Number(seg.value) || 0,
    color: destino[i]?.color || seg.color
  }));
  const duracao = 760;
  const inicio = performance.now();

  function passo(agora) {
    const t = Math.min((agora - inicio) / duracao, 1);
    const facilitado = 1 - Math.pow(1 - t, 3);
    const atual = destino.map((seg, i) => ({
      color: seg.color,
      value: origem[i].value + (seg.value - origem[i].value) * facilitado
    }));
    drawDonut(canvasId, atual, 1);
    if (t < 1) {
      animacoesDonut[canvasId] = { frame: requestAnimationFrame(passo), segments: destino };
    } else {
      animacoesDonut[canvasId] = { frame: 0, segments: destino };
    }
  }
  animacoesDonut[canvasId] = { frame: requestAnimationFrame(passo), segments: destino };
}

function atualizarTextoChart(elemento, valor) {
  if (!elemento) return;
  const texto = String(valor);
  if (elemento.textContent === texto) return;
  elemento.classList.remove('chart-value-updated');
  void elemento.offsetWidth;
  elemento.textContent = texto;
  elemento.classList.add('chart-value-updated');
}
