let tarefas = [
  {id:'REL-00450', tarefa:'Exportação API', origem:'Oracle', tempo:'4:43/5:00', status:'Em Execução'},
  {id:'REL-00451', tarefa:'Relatório', origem:'Oracle', tempo:'4:43/5:00', status:'Concluído'},
  {id:'REL-00452', tarefa:'Fechamento Mensal', origem:'Oracle', tempo:'4:43/5:00', status:'Concluído'},
  {id:'REL-00453', tarefa:'Exportação API', origem:'Oracle', tempo:'4:43/5:00', status:'Concluído'},
  {id:'REL-00454', tarefa:'Fechamento Mensal', origem:'Oracle', tempo:'4:43/5:00', status:'Concluído'},
  {id:'REL-00455', tarefa:'Relatório', origem:'Oracle', tempo:'4:43/5:00', status:'Concluído'},
];

let notificacoes = [
  "Falha de CPU em VM3 (09:12)",
  "Relatório REL-00450 Falhou em VM2 (08:45)"
];

const timersAtivos = {};

function statusClassFor(status){
  if(status === 'Em Execução') return 'status-Execucao';
  if(status === 'Parado') return 'status-Parado';
  return 'status-Concluido';
}

function renderTabela(){
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  tarefas.forEach(t=>{
    const row = document.createElement('tr');
    row.dataset.id = t.id;

    let botaoAcao;
    if(t.status === 'Em Execução'){
      botaoAcao = `<button class="action-icon spin" title="Parar processo" data-action="stop">🔄</button>`;
    } else if(t.status === 'Parado'){
      botaoAcao = `<button class="action-icon" title="Retomar processo" data-action="start">▶️</button>`;
    } else {
      botaoAcao = `<button class="action-icon" title="Excluir" data-action="delete">🗑️</button>`;
    }

    row.innerHTML = `
      <td class="id-cell">${t.id}</td>
      <td class="tarefa-cell">${t.tarefa}</td>
      <td>${t.origem}</td>
      <td><span class="progress-pill">${t.tempo}</span></td>
      <td><span class="status-badge ${statusClassFor(t.status)}">${t.status}</span></td>
      <td>${botaoAcao}</td>
    `;
    tbody.appendChild(row);
  });
}

function iniciarProcesso(id){
  const tarefa = tarefas.find(t=>t.id === id);
  if(!tarefa) return;

  tarefa.status = 'Em Execução';
  renderTabela();
  mostrarToast(`Processando ${id}...`);

  timersAtivos[id] = setTimeout(()=>{
    const t = tarefas.find(t=>t.id === id);
    if(t && t.status === 'Em Execução'){
      t.status = 'Concluído';
      renderTabela();
      mostrarToast(`${id} concluído com sucesso!`);
      adicionarNotificacao(`Relatório ${id} concluído com sucesso.`);
    }
    delete timersAtivos[id];
  }, 4000);
}

function pararProcesso(id){
  clearTimeout(timersAtivos[id]);
  delete timersAtivos[id];

  const tarefa = tarefas.find(t=>t.id === id);
  if(tarefa){
    tarefa.status = 'Parado';
    renderTabela();
    mostrarToast(`Processo ${id} interrompido.`);
    adicionarNotificacao(`Processo ${id} foi interrompido manualmente.`);
  }
}

function initTabelaEventos(){
  const tbody = document.getElementById('tableBody');
  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('.action-icon');
    if(!btn) return;

    const row = btn.closest('tr');
    const id = row.dataset.id;
    const acao = btn.dataset.action;

    if(acao === 'delete'){
      tarefas = tarefas.filter(t=>t.id !== id);
      renderTabela();
      mostrarToast(`Relatório ${id} removido.`);
    }

    if(acao === 'stop'){
      pararProcesso(id);
    }

    if(acao === 'start'){
      iniciarProcesso(id);
    }
  });
}

function renderAlertas(){
  const alertsList = document.getElementById('alertsList');
  alertsList.innerHTML = '';

  if(notificacoes.length === 0){
    alertsList.innerHTML = `<div class="alert-text" style="color:var(--text-muted);font-weight:500;">Nenhum alerta no momento.</div>`;
    return;
  }

  notificacoes.forEach(a=>{
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `<div class="alert-icon">!</div><div class="alert-text">${a}</div>`;
    alertsList.appendChild(div);
  });
}

function renderNotificacoes(destacar){
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');

  badge.textContent = notificacoes.length;
  badge.classList.toggle('empty', notificacoes.length === 0);
  if(destacar){
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }

  list.innerHTML = '';
  if(notificacoes.length === 0){
    list.innerHTML = `<div class="notif-empty">Nenhuma notificação no momento.</div>`;
    return;
  }
  notificacoes.forEach(a=>{
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `<div class="alert-icon">!</div><div class="alert-text">${a}</div>`;
    list.appendChild(div);
  });
}

function adicionarNotificacao(texto){
  notificacoes.unshift(texto);
  renderAlertas();
  renderNotificacoes(true);
}

function initNotificacoes(){
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  notifBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    notifDropdown.classList.toggle('show');
  });

  document.addEventListener('click', (e)=>{
    if(!notifDropdown.contains(e.target) && e.target !== notifBtn){
      notifDropdown.classList.remove('show');
    }
  });
}

function mostrarToast(msg){
  let toast = document.getElementById('toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=> toast.classList.remove('show'), 2500);
}

function initSidebarToggle(){
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('burgerBtn');

  burger.addEventListener('click', ()=>{
    sidebar.classList.toggle('collapsed');
    burger.classList.toggle('open');
    setTimeout(posicionarHighlight, 400);
  });
}

function posicionarHighlight(){
  const ativo = document.querySelector('.nav-item.active');
  const highlight = document.getElementById('navHighlight');
  if(!ativo || !highlight) return;
  highlight.style.top = ativo.offsetTop + 'px';
  highlight.style.height = ativo.offsetHeight + 'px';
}

function initNavegacao(){
  const itens = document.querySelectorAll('.nav-item');
  const DURACAO = 260;

  itens.forEach(item=>{
    item.addEventListener('click', ()=>{
      const alvo = item.dataset.view;
      const viewAlvo = document.getElementById(`view-${alvo}`);
      if(!viewAlvo || viewAlvo.classList.contains('active')) return;

      itens.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      posicionarHighlight();

      const viewAtual = document.querySelector('.view.active');

      if(viewAtual){
        viewAtual.classList.remove('show');
        setTimeout(()=>{
          viewAtual.classList.remove('active');
          mostrarView(viewAlvo);
        }, DURACAO);
      } else {
        mostrarView(viewAlvo);
      }
    });
  });

  function mostrarView(view){
    view.classList.add('active');
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=> view.classList.add('show'));
    });
  }

  const inicial = document.querySelector('.view.active');
  if(inicial) requestAnimationFrame(()=> inicial.classList.add('show'));

  posicionarHighlight();
  window.addEventListener('resize', posicionarHighlight);
}

function drawDonut(canvasId, segments, progresso){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const cx = canvas.width/2, cy = canvas.height/2;
  const radius = Math.min(cx,cy) - 6;
  const innerRadius = radius * 0.6;
  let startAngle = -Math.PI/2;

  segments.forEach(seg=>{
    const angle = (seg.value/100) * Math.PI * 2 * progresso;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,radius,startAngle,startAngle+angle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += angle;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx,cy,innerRadius,0,Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

const animacoesDonut = {};

function animarDonut(canvasId, segments){
  cancelAnimationFrame(animacoesDonut[canvasId]);
  const duracao = 700;
  const inicio = performance.now();

  function passo(agora){
    const t = Math.min((agora - inicio) / duracao, 1);
    const facilitado = 1 - Math.pow(1 - t, 3);
    drawDonut(canvasId, segments, facilitado);
    if(t < 1){
      animacoesDonut[canvasId] = requestAnimationFrame(passo);
    }
  }
  animacoesDonut[canvasId] = requestAnimationFrame(passo);
}

function drawAreaChart(canvasId, fase){
  const canvas = document.getElementById(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const parentWidth = canvas.parentElement.clientWidth - 36;
  canvas.width = parentWidth * dpr;
  canvas.height = 120 * dpr;
  canvas.style.width = parentWidth + 'px';
  canvas.style.height = '120px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr,dpr);
  const w = parentWidth, h = 120;
  ctx.clearRect(0,0,w,h);

  const points = [];
  const n = 16;
  for(let i=0;i<=n;i++){
    const y = 0.55 + Math.sin(i*0.7 + fase)*0.09 + Math.sin(i*1.3 - fase*1.4)*0.03;
    points.push(y);
  }

  function pathFor(scale){
    ctx.beginPath();
    ctx.moveTo(0,h);
    points.forEach((p,i)=>{
      const x = (i/n)*w;
      const y = h - (p*scale)*h;
      ctx.lineTo(x,y);
    });
    ctx.lineTo(w,h);
    ctx.closePath();
  }

  pathFor(1.35);
  ctx.fillStyle = '#a8e6a1';
  ctx.fill();

  pathFor(1.0);
  ctx.fillStyle = '#8f6fff';
  ctx.fill();
}

function iniciarAnimacaoRAM(){
  let fase = 0;
  function loop(){
    fase += 0.02;
    drawAreaChart('ramChart', fase);
    requestAnimationFrame(loop);
  }
  loop();
}

function initDateRange(){
  const dateRange = document.getElementById('dateRange');
  dateRange.addEventListener('click', ()=>{
    const inicio = prompt('Data inicial (AAAA-MM-DD):', '2026-01-01');
    if(inicio === null) return;
    const fim = prompt('Data final (AAAA-MM-DD):', '2026-12-31');
    if(fim === null) return;
    dateRange.innerHTML = `📅 ${inicio} &nbsp;~&nbsp; ${fim}`;
    mostrarToast('Período atualizado.');
  });
}

let uptimeBaseSegundos = 0;
let uptimeReferenciaMs = 0;
let backendDisponivel = false;

function formatarTempo(totalSegundos){
  const dias = Math.floor(totalSegundos/86400);
  const horas = Math.floor((totalSegundos%86400)/3600);
  const minutos = Math.floor((totalSegundos%3600)/60);
  const segundos = Math.floor(totalSegundos%60);
  const base = `${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
  return dias > 0 ? `${dias}d ${base}` : base;
}

async function buscarStatusCPU(){
  try{
    const resposta = await fetch('/api/sistema/status', { cache:'no-store' });
    if(!resposta.ok) throw new Error('offline');
    const corpo = await resposta.json();
    const dados = corpo.data;

    backendDisponivel = true;
    uptimeBaseSegundos = dados.tempoAtividadeSegundos;
    uptimeReferenciaMs = Date.now();

    document.getElementById('cpuVelocidade').textContent = `${dados.velocidadeGHz} GHz`;
    document.getElementById('cpuUsoPct').textContent = `${dados.usoPercentual}%`;
    document.getElementById('cpuLivrePct').textContent = `${dados.livrePercentual}%`;

    animarDonut('cpuChart', [
      {value:dados.usoPercentual, color:'#5b2ee0'},
      {value:dados.livrePercentual, color:'#e9e3ff'}
    ]);
  }catch(erro){
    if(!backendDisponivel){
      document.getElementById('cpuVelocidade').textContent = 'Conecte o backend';
      const nucleos = navigator.hardwareConcurrency || '--';
      document.getElementById('cpuUsoPct').textContent = `${nucleos} núcleos`;
      document.getElementById('cpuLivrePct').textContent = '--';
    }
  }
}

function iniciarRelogioUptime(){
  setInterval(()=>{
    if(backendDisponivel){
      const decorridoMs = Date.now() - uptimeReferenciaMs;
      const totalSegundos = uptimeBaseSegundos + Math.floor(decorridoMs/1000);
      document.getElementById('cpuUptime').textContent = formatarTempo(totalSegundos);
    } else {
      const totalSegundos = Math.floor((Date.now() - uptimeReferenciaMs)/1000);
      document.getElementById('cpuUptime').textContent = formatarTempo(totalSegundos) + ' (sessão)';
    }
  }, 1000);
}

window.addEventListener('DOMContentLoaded', ()=>{
  renderTabela();
  renderAlertas();
  renderNotificacoes(false);
  initTabelaEventos();
  initNotificacoes();
  initSidebarToggle();
  initNavegacao();
  initDateRange();

  animarDonut('cpuChart', [
    {value:0, color:'#5b2ee0'},
    {value:0, color:'#e9e3ff'}
  ]);

  animarDonut('tarefasChart', [
    {value:82, color:'#5b2ee0'},
    {value:18, color:'#e9e3ff'}
  ]);

  iniciarAnimacaoRAM();

  uptimeReferenciaMs = Date.now();
  buscarStatusCPU();
  setInterval(buscarStatusCPU, 4000);
  iniciarRelogioUptime();
});
