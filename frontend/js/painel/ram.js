const RAM_JANELA_PONTOS = 30;
const RAM_DURACAO_TRANSICAO = 800;
const RAM_DURACAO_ENTRADA = 1100;
const RAM_DURACAO_ABERTURA_DETALHE = 900;
const RAM_ATRASO_ABERTURA_DETALHE = 220;
const RAM_MAX_AMOSTRAS = 60;

const ramHistoricoPercentual = [];
let ramTransicao = { inicio: 0, de: 0, para: 0 };
let ramEntradaInicio = 0;
let ramLoopId = null;
let ramProgressoDetalhe = 1;
let ramFrameDetalhe = 0;

const limitarFaixa = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));
const facilitarSaida = t => 1 - Math.pow(1 - t, 3);

function corComAlfa(cor, alfa) {
  const texto = String(cor).trim();
  let canais = [91, 46, 224];
  const hex = texto.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const valor = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    canais = [0, 2, 4].map(i => parseInt(valor.slice(i, i + 2), 16));
  } else {
    const rgb = texto.match(/rgba?\(([^)]+)\)/);
    if (rgb) canais = rgb[1].split(',').slice(0, 3).map(Number);
  }
  return `rgba(${canais.join(',')},${alfa})`;
}

function corVariavel(nome, reserva) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva;
}

function prepararCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;
  if (!largura || !altura) return null;
  if (canvas._larguraCss !== largura || canvas._alturaCss !== altura || canvas._dpr !== dpr) {
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas._larguraCss = largura;
    canvas._alturaCss = altura;
    canvas._dpr = dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  return { ctx, largura, altura };
}

function tracarCurvaSuave(ctx, pontos, yMin, yMax) {
  ctx.moveTo(pontos[0].x, pontos[0].y);
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] || pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      limitarFaixa(p1.y + (p2.y - p0.y) / 6, yMin, yMax),
      p2.x - (p3.x - p1.x) / 6,
      limitarFaixa(p2.y - (p3.y - p1.y) / 6, yMin, yMax),
      p2.x,
      p2.y
    );
  }
}

function desenharMarcadorFinal(ctx, x, y, acento, pulso) {
  ctx.beginPath();
  ctx.arc(x, y, 5 + 7 * pulso, 0, Math.PI * 2);
  ctx.fillStyle = corComAlfa(acento, 0.28 * (1 - pulso));
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = acento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.stroke();
}

function desenharAreaComLinha(ctx, pontos, base, topo, acento, acentoClaro) {
  const gradiente = ctx.createLinearGradient(0, topo, 0, base);
  gradiente.addColorStop(0, corComAlfa(acento, 0.36));
  gradiente.addColorStop(1, corComAlfa(acento, 0.02));
  ctx.beginPath();
  tracarCurvaSuave(ctx, pontos, topo, base);
  ctx.lineTo(pontos[pontos.length - 1].x, base);
  ctx.lineTo(pontos[0].x, base);
  ctx.closePath();
  ctx.fillStyle = gradiente;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  tracarCurvaSuave(ctx, pontos, topo, base);
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = acentoClaro;
  ctx.shadowColor = corComAlfa(acento, 0.45);
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function serieVisivelRAM(usoAtual) {
  const base = ramHistoricoPercentual.length ? ramHistoricoPercentual : [Number(usoAtual) || 0];
  const valores = base.slice(-RAM_JANELA_PONTOS);
  if (ramTransicao.inicio && valores.length) {
    const progresso = limitarFaixa((performance.now() - ramTransicao.inicio) / RAM_DURACAO_TRANSICAO, 0, 1);
    valores[valores.length - 1] =
      ramTransicao.de + (ramTransicao.para - ramTransicao.de) * facilitarSaida(progresso);
  }
  while (valores.length < RAM_JANELA_PONTOS + 1) valores.unshift(valores[0]);
  return valores;
}

function desenharGraficoRAM(canvasId, usoAtual = 0) {
  const canvas = document.getElementById(canvasId);
  const area = canvas && prepararCanvas(canvas);
  if (!area) return;
  const { ctx, largura, altura } = area;
  const agora = performance.now();
  const acento = corVariavel('--purple', '#5b2ee0');
  const acentoClaro = corVariavel('--purple-light', '#7a4dff');

  const topo = 14;
  const base = altura - 8;
  const direita = largura - 10;

  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = corTrilhaGrafico();
  [0.25, 0.5, 0.75].forEach(fracao => {
    const y = Math.round(base - (base - topo) * fracao) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(largura, y);
    ctx.stroke();
  });
  ctx.restore();

  if (!ramHistoricoPercentual.length) return;
  if (!ramEntradaInicio) ramEntradaInicio = agora;

  const entrada = facilitarSaida(limitarFaixa((agora - ramEntradaInicio) / RAM_DURACAO_ENTRADA, 0, 1));
  const progressoSlide = ramTransicao.inicio
    ? limitarFaixa((agora - ramTransicao.inicio) / RAM_DURACAO_TRANSICAO, 0, 1)
    : 1;
  const passo = direita / (RAM_JANELA_PONTOS - 1);
  const deslocamento = (1 - facilitarSaida(progressoSlide)) * passo;
  const valores = serieVisivelRAM(usoAtual);

  const pontos = valores.map((valor, i) => ({
    x: direita - (valores.length - 1 - i) * passo + deslocamento,
    y: base - (limitarFaixa(valor, 0, 100) / 100) * (base - topo) * entrada
  }));

  ctx.save();
  ctx.globalAlpha = Math.min(1, entrada * 1.4);
  desenharAreaComLinha(ctx, pontos, base, topo, acento, acentoClaro);
  const ultimo = pontos[pontos.length - 1];
  desenharMarcadorFinal(ctx, Math.min(ultimo.x, direita), ultimo.y, acento, (agora % 1800) / 1800);
  ctx.restore();
}

function registrarAmostraRAM(percentual) {
  const atual = limitarFaixa(Number(percentual) || 0, 0, 100);
  ramTransicao = {
    inicio: performance.now(),
    de: ramHistoricoPercentual.at(-1) ?? atual,
    para: atual
  };
  ramHistoricoPercentual.push(atual);
  if (ramHistoricoPercentual.length > RAM_MAX_AMOSTRAS) ramHistoricoPercentual.shift();
  desenharGraficoRAM('ramChart', atual);
  desenharHistoricoRAMDetalhado();
}

function desenharHistoricoRAMDetalhado(progresso = ramProgressoDetalhe) {
  const canvas = document.getElementById('ramHistoryDetailChart');
  if (!canvas) return;
  const area = prepararCanvas(canvas);
  if (!area) return;
  const { ctx, largura, altura } = area;
  const acento = corVariavel('--purple', '#5b2ee0');
  const acentoClaro = corVariavel('--purple-light', '#7a4dff');
  const margem = { topo: 12, direita: 40, base: 18, esquerda: 12 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;
  const valores = ramHistoricoPercentual.length ? ramHistoricoPercentual : [0];
  const revelado = facilitarSaida(limitarFaixa(progresso, 0, 1));

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(148,132,190,.22)';
  [0, 0.5, 1].forEach(fracao => {
    const y = Math.round(margem.topo + h * fracao) + 0.5;
    ctx.beginPath();
    ctx.moveTo(margem.esquerda, y);
    ctx.lineTo(margem.esquerda + w, y);
    ctx.stroke();
  });

  const serie = valores.length > 1 ? valores : [valores[0], valores[0]];
  const n = serie.length - 1;
  const pontos = serie.map((valor, i) => ({
    x: margem.esquerda + (i / n) * w,
    y: margem.topo + h - (limitarFaixa(valor, 0, 100) / 100) * h * revelado
  }));

  if (revelado > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, margem.esquerda + w * revelado + 6, altura);
    ctx.clip();
    desenharAreaComLinha(ctx, pontos, margem.topo + h, margem.topo, acento, acentoClaro);
    ctx.restore();
    if (revelado >= 1) {
      const ultimo = pontos[pontos.length - 1];
      desenharMarcadorFinal(ctx, ultimo.x, ultimo.y, acento, (performance.now() % 1800) / 1800);
    }
  }

  atualizarTextoChart(document.getElementById('ramHistoryCurrent'), `${Math.round(valores.at(-1) || 0)}%`);
  atualizarTextoChart(document.getElementById('ramHistoryPeak'), `${Math.round(Math.max(...valores))}%`);
  atualizarTextoChart(document.getElementById('ramHistorySamples'), valores.length);
}

function animarAberturaHistoricoRAM() {
  cancelAnimationFrame(ramFrameDetalhe);
  ramProgressoDetalhe = 0;
  desenharHistoricoRAMDetalhado();
  const inicio = performance.now() + RAM_ATRASO_ABERTURA_DETALHE;
  const passo = agora => {
    ramProgressoDetalhe = limitarFaixa((agora - inicio) / RAM_DURACAO_ABERTURA_DETALHE, 0, 1);
    desenharHistoricoRAMDetalhado();
    if (ramProgressoDetalhe < 1) ramFrameDetalhe = requestAnimationFrame(passo);
  };
  ramFrameDetalhe = requestAnimationFrame(passo);
}

function abrirHistoricoRAM() {
  const overlay = document.getElementById('ramHistoryOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  animarAberturaHistoricoRAM();
  document.getElementById('ramHistoryClose')?.focus({ preventScroll: true });
}

function fecharHistoricoRAM() {
  const overlay = document.getElementById('ramHistoryOverlay');
  if (!overlay || !overlay.classList.contains('show')) return;
  cancelAnimationFrame(ramFrameDetalhe);
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
}

function historicoRAMAberto() {
  return Boolean(document.getElementById('ramHistoryOverlay')?.classList.contains('show'));
}

function iniciarHistoricoRAM() {
  const card = document.querySelector('.ram-card-interactive');
  card?.addEventListener('click', abrirHistoricoRAM);
  card?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirHistoricoRAM();
    }
  });
  document.getElementById('ramHistoryClose')?.addEventListener('click', fecharHistoricoRAM);
  document.getElementById('ramHistoryOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'ramHistoryOverlay') fecharHistoricoRAM();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharHistoricoRAM();
  });
  window.addEventListener('resize', () => {
    if (historicoRAMAberto()) desenharHistoricoRAMDetalhado();
  });
  ['paletaAlterada', 'temaAlterado'].forEach(evento =>
    document.addEventListener(evento, () => {
      if (historicoRAMAberto()) desenharHistoricoRAMDetalhado();
    })
  );
}

function iniciarAnimacaoRAM() {
  if (ramLoopId !== null) return;
  let ultimoQuadro = 0;
  const loop = agora => {
    if (document.hidden || !document.getElementById('ramChart')?.isConnected) {
      ramLoopId = null;
      return;
    }
    ramLoopId = requestAnimationFrame(loop);
    if (agora - ultimoQuadro < 24) return;
    ultimoQuadro = agora;
    if (!document.getElementById('view-dashboard')?.classList.contains('active')) return;
    desenharGraficoRAM('ramChart', ramHistoricoPercentual.at(-1) || 0);
  };
  const iniciar = () => {
    if (!document.hidden && ramLoopId === null) ramLoopId = requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', iniciar, { passive: true });
  iniciar();
}
