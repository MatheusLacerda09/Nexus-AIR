(function(){
  'use strict';

  const TEXTOS = {
    pt: {
      modos: { dia:'Dia', semana:'Semana', mes:'Mês', intervalo:'Intervalo' },
      meses: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
      dias: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
      anterior: 'Mês anterior', proximo: 'Próximo mês', mes: 'Mês', ano: 'Ano',
      horario: 'Horário', das: 'Das', as: 'às', aplicar: 'Aplicar', restaurar: 'Restaurar',
      dicaHorario: 'A faixa vale para cada dia do período.',
      erroHorario: 'O horário final deve ser igual ou depois do inicial.',
      escolhaFim: 'Agora escolha a data final (ou aplique para usar só este dia).',
      escolhaInicio: 'Clique na data inicial e depois na final.',
      titulo: 'Selecionar período', locale: 'pt-BR'
    },
    en: {
      modos: { dia:'Day', semana:'Week', mes:'Month', intervalo:'Range' },
      meses: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      dias: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      anterior: 'Previous month', proximo: 'Next month', mes: 'Month', ano: 'Year',
      horario: 'Time', das: 'From', as: 'to', aplicar: 'Apply', restaurar: 'Reset',
      dicaHorario: 'The time window applies to each day in the period.',
      erroHorario: 'The end time must be the same as or after the start time.',
      escolhaFim: 'Now pick the end date (or apply to use just this day).',
      escolhaInicio: 'Click the start date, then the end date.',
      titulo: 'Select period', locale: 'en-US'
    }
  };
  const lang = () => String(document.documentElement.lang || document.documentElement.dataset?.lang || '').toLowerCase().startsWith('en') ? 'en' : 'pt';
  const tx = () => TEXTOS[lang()];

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = v => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
  const somarDias = (v, n) => { const d = deIso(v); d.setDate(d.getDate() + n); return iso(d); };
  const minutos = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

  function intervaloDoModo(modo, ref){
    const d = deIso(ref);
    if(modo === 'dia') return [ref, ref];
    if(modo === 'semana'){
      const inicio = somarDias(ref, -d.getDay());
      return [inicio, somarDias(inicio, 6)];
    }
    if(modo === 'mes'){
      return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    }
    return [ref, ref];
  }

  const padrao = () => {
    const ano = new Date().getFullYear();
    return { modo:'intervalo', inicio:`${ano}-01-01`, fim:`${ano}-12-31`, horaInicio:'00:00', horaFim:'23:59' };
  };

  // aplicado = o que filtra a tabela; rascunho = o que está sendo editado no popover.
  let aplicado = padrao();
  let rascunho = null;
  let inicioPendente = null;   // 1º clique do modo Intervalo, esperando o 2º
  let hoverIso = null;
  let ui = null;               // referências do DOM atual (o roteador troca o <body>)

  function contem(ms){
    if(ms === undefined || ms === null || ms === '') return true;
    const d = new Date(ms);
    if(isNaN(d.getTime())) return true;
    const dia = iso(d);
    if(dia < aplicado.inicio || dia > aplicado.fim) return false;
    const min = d.getHours() * 60 + d.getMinutes();
    return min >= minutos(aplicado.horaInicio) && min <= minutos(aplicado.horaFim);
  }

  function fmtData(v, comAno = true){
    return new Intl.DateTimeFormat(tx().locale, { day:'2-digit', month:'2-digit', ...(comAno ? { year:'numeric' } : {}) }).format(deIso(v));
  }
  // Data "bonita": 05 jan 2026 (mês abreviado, sem ponto).
  function fmtDataBonita(v){
    const d = deIso(v);
    const mes = new Intl.DateTimeFormat(tx().locale, { month:'short' }).format(d).replace('.', '');
    return `${pad(d.getDate())} ${mes} ${d.getFullYear()}`;
  }
  // Versão em texto puro (resumo do popover e dica do botão).
  function rotulo(p){
    const t = tx();
    const datas = p.inicio === p.fim ? fmtDataBonita(p.inicio) : `${fmtDataBonita(p.inicio)} → ${fmtDataBonita(p.fim)}`;
    const prefixo = p.modo === 'intervalo' ? '' : `${t.modos[p.modo]} · `;
    const horarioCheio = p.horaInicio === '00:00' && p.horaFim === '23:59';
    return `${prefixo}${datas}${horarioCheio ? '' : ` · ${p.horaInicio}–${p.horaFim}`}`;
  }
  // Versão em HTML do botão: datas em "chips" separados por uma seta.
  function rotuloHtml(p){
    const t = tx();
    const seta = '<svg class="ic dr-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const datas = p.inicio === p.fim
      ? `<span class="dr-date">${fmtDataBonita(p.inicio)}</span>`
      : `<span class="dr-date">${fmtDataBonita(p.inicio)}</span>${seta}<span class="dr-date">${fmtDataBonita(p.fim)}</span>`;
    const modo = p.modo === 'intervalo' ? '' : `<span class="dr-tag">${t.modos[p.modo]}</span>`;
    const horarioCheio = p.horaInicio === '00:00' && p.horaFim === '23:59';
    const hora = horarioCheio ? '' : `<span class="dr-tag dr-tag--time">${p.horaInicio}–${p.horaFim}</span>`;
    return `${modo}<span class="dr-dates">${datas}</span>${hora}`;
  }
  function atualizarRotulo(){
    if(!ui) return;
    ui.label.innerHTML = rotuloHtml(aplicado);
    ui.trigger.setAttribute('title', rotulo(aplicado));
  }

  let visao = new Date();   // mês exibido
  let vista = 'dias';       // dias | meses | anos
  const anoAtual = new Date().getFullYear();
  const anoMin = anoAtual - 10, anoMax = anoAtual + 2;

  function intervaloPrevisto(){
    // O que seria selecionado se o usuário clicasse no dia sob o mouse.
    if(!hoverIso) return null;
    if(rascunho.modo === 'intervalo'){
      if(!inicioPendente) return null;
      return hoverIso < inicioPendente ? [hoverIso, inicioPendente] : [inicioPendente, hoverIso];
    }
    return intervaloDoModo(rascunho.modo, hoverIso);
  }

  function pintarDias(){
    const previsto = intervaloPrevisto();
    ui.grade.querySelectorAll('[data-period-date]').forEach(btn => {
      const v = btn.dataset.periodDate;
      const noInicio = v === rascunho.inicio, noFim = v === rascunho.fim;
      const dentro = v >= rascunho.inicio && v <= rascunho.fim;
      btn.classList.toggle('is-selected', noInicio || noFim);
      btn.classList.toggle('is-range-start', noInicio && rascunho.inicio !== rascunho.fim);
      btn.classList.toggle('is-range-end', noFim && rascunho.inicio !== rascunho.fim);
      btn.classList.toggle('is-in-range', dentro && !noInicio && !noFim);
      btn.classList.toggle('is-preview', Boolean(previsto) && v >= previsto[0] && v <= previsto[1] && !(noInicio || noFim));
      btn.setAttribute('aria-pressed', String(noInicio || noFim));
    });
  }

  function renderizar(){
    const t = tx();
    const y = visao.getFullYear(), m = visao.getMonth();
    ui.mesRotulo.textContent = t.meses[m];
    ui.anoRotulo.textContent = String(y);
    ui.btnMes.setAttribute('aria-label', `${t.mes}: ${t.meses[m]}`);
    ui.btnAno.setAttribute('aria-label', `${t.ano}: ${y}`);
    ui.anterior.setAttribute('aria-label', t.anterior);
    ui.proximo.setAttribute('aria-label', t.proximo);
    ui.semana.innerHTML = t.dias.map(d => `<span>${d}</span>`).join('');

    const primeiro = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const hojeIso = iso(new Date());
    const celulas = [];
    for(let i = 0; i < primeiro; i++) celulas.push('<span class="birthday-date-empty" aria-hidden="true"></span>');
    for(let dia = 1; dia <= total; dia++){
      const v = `${y}-${pad(m + 1)}-${pad(dia)}`;
      celulas.push(`<button type="button" class="birthday-date-day${v === hojeIso ? ' is-today' : ''}" data-period-date="${v}" aria-label="${fmtData(v)}">${dia}</button>`);
    }
    ui.grade.innerHTML = celulas.join('');

    ui.meses.innerHTML = t.meses.map((nome, i) =>
      `<button type="button" role="option" class="birthday-date-chip${i === m ? ' is-current' : ''}" data-period-month="${i}" aria-selected="${i === m}">${nome.slice(0, 3)}</button>`).join('');
    const anos = [];
    for(let a = anoMax; a >= anoMin; a--) anos.push(`<button type="button" role="option" class="birthday-date-chip${a === y ? ' is-current' : ''}" data-period-year="${a}" aria-selected="${a === y}">${a}</button>`);
    ui.anos.innerHTML = anos.join('');

    ui.modos.forEach(b => {
      const ativo = b.dataset.periodMode === rascunho.modo;
      b.classList.toggle('is-active', ativo);
      b.setAttribute('aria-selected', String(ativo));
      b.textContent = t.modos[b.dataset.periodMode];
    });
    ui.rotuloHorario.textContent = t.horario;
    ui.rotuloDas.textContent = t.das;
    ui.rotuloAs.textContent = t.as;
    ui.dicaHorario.textContent = t.dicaHorario;
    ui.btnAplicar.textContent = t.aplicar;
    ui.btnRestaurar.textContent = t.restaurar;
    ui.popover.setAttribute('aria-label', t.titulo);

    pintarDias();
    atualizarNavegacao();
    atualizarResumo();
  }

  function atualizarNavegacao(){
    const y = visao.getFullYear(), m = visao.getMonth();
    if(vista === 'dias'){
      ui.anterior.disabled = new Date(y, m - 1, 1).getFullYear() < anoMin;
      ui.proximo.disabled = new Date(y, m + 1, 1).getFullYear() > anoMax;
    }else{
      ui.anterior.disabled = y - 1 < anoMin;
      ui.proximo.disabled = y + 1 > anoMax;
    }
  }

  function atualizarResumo(){
    const t = tx();
    const horarioOk = minutos(ui.horaFim.value || '00:00') >= minutos(ui.horaInicio.value || '00:00');
    ui.erroHorario.textContent = horarioOk ? '' : t.erroHorario;
    ui.erroHorario.hidden = horarioOk;
    ui.btnAplicar.disabled = !horarioOk;
    if(inicioPendente) ui.resumo.textContent = t.escolhaFim;
    else if(rascunho.modo === 'intervalo' && rascunho.inicio === rascunho.fim) ui.resumo.textContent = `${rotulo({ ...rascunho, modo:'intervalo' })} — ${t.escolhaInicio}`;
    else ui.resumo.textContent = rotulo({ ...rascunho, horaInicio: ui.horaInicio.value || '00:00', horaFim: ui.horaFim.value || '23:59' });
  }

  function definirVista(proxima, focar){
    vista = proxima;
    [['dias', ui.vistaDias], ['meses', ui.vistaMeses], ['anos', ui.vistaAnos]].forEach(([nome, el]) => el.classList.toggle('is-active', nome === proxima));
    ui.btnMes.classList.toggle('is-open', proxima === 'meses');
    ui.btnAno.classList.toggle('is-open', proxima === 'anos');
    ui.btnMes.setAttribute('aria-expanded', String(proxima === 'meses'));
    ui.btnAno.setAttribute('aria-expanded', String(proxima === 'anos'));
    if(proxima === 'anos'){
      const ativo = ui.anos.querySelector('.is-current');
      if(ativo) ui.anos.scrollTop = Math.max(0, ativo.offsetTop - ui.anos.clientHeight / 2 + ativo.offsetHeight / 2);
      if(focar) ativo?.focus({ preventScroll:true });
    }else if(proxima === 'meses' && focar){
      ui.meses.querySelector('.is-current')?.focus({ preventScroll:true });
    }
    atualizarNavegacao();
  }

  function irPara(ano, mes){
    let alvo = new Date(ano, mes, 1);
    if(alvo.getFullYear() < anoMin) alvo = new Date(anoMin, 0, 1);
    if(alvo.getFullYear() > anoMax) alvo = new Date(anoMax, 11, 1);
    visao = alvo;
    renderizar();
  }

  function selecionarDia(v){
    if(rascunho.modo === 'intervalo'){
      if(!inicioPendente){
        inicioPendente = v;
        rascunho.inicio = rascunho.fim = v;
      }else{
        const [a, b] = v < inicioPendente ? [v, inicioPendente] : [inicioPendente, v];
        rascunho.inicio = a; rascunho.fim = b;
        inicioPendente = null;
      }
    }else{
      [rascunho.inicio, rascunho.fim] = intervaloDoModo(rascunho.modo, v);
      inicioPendente = null;
    }
    pintarDias();
    atualizarResumo();
  }

  function trocarModo(modo){
    inicioPendente = null;
    const hojeIso = iso(new Date());
    // âncora: hoje, se estiver dentro do período atual; senão o início dele
    const ancora = (hojeIso >= rascunho.inicio && hojeIso <= rascunho.fim) ? hojeIso : rascunho.inicio;
    rascunho.modo = modo;
    if(modo !== 'intervalo') [rascunho.inicio, rascunho.fim] = intervaloDoModo(modo, ancora);
    const d = deIso(rascunho.inicio);
    visao = new Date(d.getFullYear(), d.getMonth(), 1);
    renderizar();
  }

  const aberto = () => Boolean(ui && !ui.popover.hidden);

  function posicionar(){
    if(!aberto()) return;
    const r = ui.trigger.getBoundingClientRect();
    const pop = ui.popover;
    const margem = 12;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(margem, Math.min(r.right - w, window.innerWidth - w - margem));
    let top = r.bottom + 10;
    if(top + h > window.innerHeight - margem){
      const acima = r.top - 10 - h;
      top = acima >= margem ? acima : Math.max(margem, window.innerHeight - h - margem);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function abrir(){
    if(!ui || aberto()) return;
    rascunho = { ...aplicado };
    inicioPendente = null;
    hoverIso = null;
    ui.horaInicio.value = rascunho.horaInicio;
    ui.horaFim.value = rascunho.horaFim;
    window.NexusPicker?.sync(ui.popover);
    const d = deIso(rascunho.inicio);
    visao = new Date(d.getFullYear(), d.getMonth(), 1);
    // .table-card tem overflow e cortaria o popover: ele vai para o <body>.
    if(ui.popover.parentElement !== document.body) document.body.appendChild(ui.popover);
    ui.popover.hidden = false;
    ui.trigger.setAttribute('aria-expanded', 'true');
    ui.wrapper.classList.add('is-open');
    renderizar();
    definirVista('dias');
    posicionar();
    ui.modos.find(b => b.classList.contains('is-active'))?.focus({ preventScroll:true });
  }

  function fechar(devolverFoco){
    if(!ui) return;
    ui.popover.hidden = true;
    ui.trigger.setAttribute('aria-expanded', 'false');
    ui.wrapper.classList.remove('is-open');
    inicioPendente = null;
    if(devolverFoco) ui.trigger.focus();
  }

  function emitir(origem){
    document.dispatchEvent(new CustomEvent('nexusPeriodoAlterado', { detail:{ origem, periodo:{ ...aplicado } } }));
  }

  function aplicar(){
    const horaInicio = ui.horaInicio.value || '00:00';
    const horaFim = ui.horaFim.value || '23:59';
    if(minutos(horaFim) < minutos(horaInicio)){ atualizarResumo(); return; }
    aplicado = { ...rascunho, horaInicio, horaFim };
    atualizarRotulo();
    fechar(true);
    emitir('aplicar');
  }

  function restaurar(){
    aplicado = padrao();
    atualizarRotulo();
    fechar(true);
    emitir('restaurar');
  }

  function ligar(){
    const wrapper = document.querySelector('[data-period-picker]');
    if(!wrapper) return;
    if(ui && ui.wrapper === wrapper){ atualizarRotulo(); return; }
    // popover pode ter sido levado ao <body> por uma ligação anterior do mesmo DOM
    const popover = wrapper.querySelector('[data-period-popover]') || document.querySelector('[data-period-popover]');
    if(!popover) return;
    const q = (seletor) => popover.querySelector(seletor);
    ui = {
      wrapper, popover,
      trigger: wrapper.querySelector('[data-period-trigger]'),
      label: wrapper.querySelector('[data-period-label]'),
      modos: [...popover.querySelectorAll('[data-period-mode]')],
      anterior: q('[data-period-prev]'), proximo: q('[data-period-next]'),
      btnMes: q('[data-period-month-btn]'), btnAno: q('[data-period-year-btn]'),
      mesRotulo: q('[data-period-month-label]'), anoRotulo: q('[data-period-year-label]'),
      vistaDias: q('[data-period-view="days"]'), vistaMeses: q('[data-period-view="months"]'), vistaAnos: q('[data-period-view="years"]'),
      semana: q('[data-period-weekdays]'), grade: q('[data-period-grid]'),
      meses: q('[data-period-view="months"]'), anos: q('[data-period-view="years"]'),
      horaInicio: q('[data-period-time-start]'), horaFim: q('[data-period-time-end]'),
      rotuloHorario: q('[data-period-time-title]'), rotuloDas: q('[data-period-from]'), rotuloAs: q('[data-period-to]'),
      dicaHorario: q('[data-period-time-hint]'), erroHorario: q('[data-period-time-error]'),
      resumo: q('[data-period-summary]'),
      btnAplicar: q('[data-period-apply]'), btnRestaurar: q('[data-period-reset]')
    };
    if(Object.values(ui).some(v => !v || (Array.isArray(v) && v.length === 0))){ ui = null; return; }

    ui.trigger.addEventListener('click', () => (aberto() ? fechar(false) : abrir()));
    ui.modos.forEach(b => b.addEventListener('click', () => trocarModo(b.dataset.periodMode)));
    ui.grade.addEventListener('click', e => {
      const btn = e.target.closest('[data-period-date]');
      if(btn) selecionarDia(btn.dataset.periodDate);
    });
    ui.grade.addEventListener('mouseover', e => {
      const btn = e.target.closest('[data-period-date]');
      const v = btn ? btn.dataset.periodDate : null;
      if(v === hoverIso) return;
      hoverIso = v;
      pintarDias();
    });
    ui.grade.addEventListener('mouseleave', () => { hoverIso = null; pintarDias(); });
    ui.anterior.addEventListener('click', () => (vista === 'dias' ? irPara(visao.getFullYear(), visao.getMonth() - 1) : irPara(visao.getFullYear() - 1, visao.getMonth())));
    ui.proximo.addEventListener('click', () => (vista === 'dias' ? irPara(visao.getFullYear(), visao.getMonth() + 1) : irPara(visao.getFullYear() + 1, visao.getMonth())));
    ui.btnMes.addEventListener('click', () => definirVista(vista === 'meses' ? 'dias' : 'meses', true));
    ui.btnAno.addEventListener('click', () => definirVista(vista === 'anos' ? 'dias' : 'anos', true));
    ui.meses.addEventListener('click', e => {
      const btn = e.target.closest('[data-period-month]');
      if(!btn) return;
      const mes = Number(btn.dataset.periodMonth);
      if(rascunho.modo === 'mes'){
        // no modo Mês, escolher o mês já seleciona o mês inteiro
        [rascunho.inicio, rascunho.fim] = intervaloDoModo('mes', `${visao.getFullYear()}-${pad(mes + 1)}-01`);
      }
      irPara(visao.getFullYear(), mes);
      definirVista('dias');
    });
    ui.anos.addEventListener('click', e => {
      const btn = e.target.closest('[data-period-year]');
      if(!btn) return;
      irPara(Number(btn.dataset.periodYear), visao.getMonth());
      definirVista('dias');
    });
    ui.horaInicio.addEventListener('input', atualizarResumo);
    ui.horaFim.addEventListener('input', atualizarResumo);
    ui.btnAplicar.addEventListener('click', aplicar);
    ui.btnRestaurar.addEventListener('click', restaurar);
    popover.addEventListener('keydown', e => {
      if(e.key !== 'Escape') return;
      // Com o seletor de horário aberto, o Esc fecha só ele (quem trata é o seletor).
      if(document.querySelector('[data-nx-picker].is-open')) return;
      e.stopPropagation();
      if(vista !== 'dias'){ definirVista('dias'); ui.btnAno.focus(); }
      else fechar(true);
    });

    atualizarRotulo();
  }

  // Listeners de document: uma única vez (o <body> é trocado pelo roteador, o document não).
  if(!window.__nexusPeriodoBound){
    window.__nexusPeriodoBound = true;
    // composedPath: o botão clicado pode ter sido recriado por renderizar() antes deste handler.
    document.addEventListener('click', e => {
      if(!aberto()) return;
      const caminho = e.composedPath();
      if(caminho.includes(ui.popover) || caminho.includes(ui.trigger)) return;
      // O seletor de horário abre ao lado, fora do calendário: clicar nele não fecha o calendário.
      if(caminho.some(n => n.classList && n.classList.contains('nx-popover'))) return;
      fechar(false);
    });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && aberto()){ if(document.querySelector('[data-nx-picker].is-open')) return; fechar(true); } });
    window.addEventListener('resize', posicionar);
    document.addEventListener('scroll', posicionar, true);
    document.addEventListener('nexusIdiomaAlterado', () => { if(ui){ atualizarRotulo(); if(aberto()) renderizar(); } });
  }

  window.NexusInitPeriodo = ligar;
  window.NexusPeriodo = {
    get: () => ({ ...aplicado }),
    contem,
    // exposto para testes
    _intervaloDoModo: intervaloDoModo
  };
})();

