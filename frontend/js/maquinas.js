(function(){
  'use strict';

  const CHAVE = 'nexus.maquinaAtiva';
  const TIPOS_MAQUINA = ['linux','windows','banco','outro'];
  const ROTULO_TIPO = { linux:'Servidor Linux', windows:'Servidor Windows', banco:'Banco de dados', outro:'Host', api:'API', sql:'SQL', planilha:'Planilha' };
  const ICONES = {
    linux:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path d="M7 7.25h.01M7 16.75h.01M11 7.25h6M11 16.75h6"/></svg>',
    windows:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="13" rx="2.4"/><path d="M12 3.5v13M3 10h18" opacity=".55"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>',
    banco:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    outro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>',
    api:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    sql:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/></svg>',
    planilha:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 13h8M8 17h8M11 10v10"/></svg>'
  };

  let maquinas = [];
  let fontes = [];
  let zabbixAtivo = false;
  let selecionado = null;          // 'maquina:ID' | 'fonte:ID'
  let ativa = 'local';
  try{ ativa = localStorage.getItem(CHAVE) || 'local'; }catch(e){}

  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(url, opcoes={}){
    const r = await fetch(url, { credentials:'same-origin', cache:'no-store',
      headers:{'Content-Type':'application/json'}, ...opcoes });
    const corpo = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(corpo.message || (corpo.errors && corpo.errors[0]) || 'Não foi possível concluir a ação.');
    return corpo;
  }

  window.NexusMaquinaId = () => (ativa && ativa !== 'local') ? ativa : null;
  window.NexusUrlStatusCPU = () => window.NexusMaquinaId() ? `/api/maquinas/${encodeURIComponent(ativa)}/status` : '/api/sistema/status';
  // Aviso do dashboard: aparece uma vez por máquina/mensagem, some sozinho e pode ser fechado.
  const TEMPO_AVISO = 9000;
  const NOMES_ITENS = { 'sem item de uptime':'tempo de atividade (uptime)', 'sem item de CPU':'uso de CPU', 'sem item de memória':'uso de memória' };
  let avisoChave = '', avisoTimer = 0, avisoSaida = 0;
  const vistos = (() => { try{ return new Set(JSON.parse(sessionStorage.getItem('nexus.avisosVistos') || '[]')); }catch(e){ return new Set(); } })();
  function marcarVisto(chave){ vistos.add(chave); try{ sessionStorage.setItem('nexus.avisosVistos', JSON.stringify([...vistos])); }catch(e){} }
  function esconderAviso(marcar){
    const el = $('#maquinaAviso');
    clearTimeout(avisoTimer);
    if(marcar && avisoChave) marcarVisto(avisoChave);
    if(!el || el.hidden) return;
    el.classList.add('is-saindo');
    clearTimeout(avisoSaida);
    avisoSaida = setTimeout(() => { el.hidden = true; el.classList.remove('is-saindo'); el.innerHTML = ''; }, 260);
  }
  window.NexusMaquinaAviso = texto => {
    const el = $('#maquinaAviso');
    if(!el) return;
    if(!texto){ avisoChave = ''; if(!el.hidden) esconderAviso(false); return; }
    const chave = (ativa || 'local') + '|' + texto;
    if(chave === avisoChave || vistos.has(chave)) return;   // já mostrado: não reaparece a cada leitura
    avisoChave = chave;
    let titulo = 'Aviso da máquina', detalhe = texto;
    const m = /^Zabbix não entrega:\s*(.+?)\.?$/.exec(texto);
    if(m){
      const itens = m[1].split(',').map(x => NOMES_ITENS[x.trim()] || x.trim());
      titulo = 'Alguns dados não chegaram do Zabbix';
      detalhe = 'Esta máquina não envia: ' + itens.join(', ') + '. Os demais indicadores continuam funcionando normalmente.';
    }
    el.innerHTML = '<span class="maquina-aviso-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg></span>' +
      '<span class="maquina-aviso-txt"><strong>' + esc(titulo) + '</strong><span>' + esc(detalhe) + '</span></span>' +
      '<button type="button" class="maquina-aviso-fechar" aria-label="Fechar aviso"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<i class="maquina-aviso-barra" style="animation-duration:' + TEMPO_AVISO + 'ms"></i>';
    clearTimeout(avisoSaida);
    el.hidden = false;
    el.classList.remove('is-saindo');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => esconderAviso(true), TEMPO_AVISO);
  };
  document.addEventListener('click', e => {
    const x = e.target.closest('.maquina-aviso-fechar');
    if(x && !x.closest('#exclusaoAviso')) esconderAviso(true);
  });

  const CHAVE_EXCLUSOES = 'nexus.exclusoesPendentes';
  let exclusoes = (() => { try{ const v = JSON.parse(sessionStorage.getItem(CHAVE_EXCLUSOES) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } })();
  let exclusaoTimer = 0, exclusaoSaida = 0;
  function salvarExclusoes(){ try{ sessionStorage.setItem(CHAVE_EXCLUSOES, JSON.stringify(exclusoes)); }catch(e){} }
  function esconderExclusao(limpar){
    const el = $('#exclusaoAviso');
    clearTimeout(exclusaoTimer);
    if(limpar){ exclusoes = []; salvarExclusoes(); }
    if(!el || el.hidden) return;
    el.classList.add('is-saindo');
    clearTimeout(exclusaoSaida);
    exclusaoSaida = setTimeout(() => { el.hidden = true; el.classList.remove('is-saindo'); el.innerHTML = ''; delete el.dataset.qtd; }, 260);
  }
  function mostrarExclusoes(){
    const el = $('#exclusaoAviso');
    if(!el || !exclusoes.length || !$('#view-dashboard.active')) return;
    if(!el.hidden && el.dataset.qtd === String(exclusoes.length)) return;
    const unico = exclusoes.length === 1;
    const titulo = unico ? 'Item excluído dos Conectores de Dados' : exclusoes.length + ' itens excluídos dos Conectores de Dados';
    const nomes = exclusoes.map(x => `"${x.nome}" (${x.tipo})`).join(', ');
    const detalhe = (unico ? nomes + ' foi excluído. ' : 'Excluídos: ' + nomes + '. ') + 'Verifique se a exclusão foi intencional.';
    el.innerHTML = '<span class="maquina-aviso-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg></span>' +
      '<span class="maquina-aviso-txt"><strong>' + esc(titulo) + '</strong><span>' + esc(detalhe) + '</span></span>' +
      '<button type="button" class="maquina-aviso-fechar" aria-label="Fechar aviso"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<i class="maquina-aviso-barra" style="animation-duration:' + TEMPO_AVISO + 'ms"></i>';
    el.dataset.qtd = String(exclusoes.length);
    clearTimeout(exclusaoSaida);
    el.hidden = false;
    el.classList.remove('is-saindo');
    clearTimeout(exclusaoTimer);
    exclusaoTimer = setTimeout(() => esconderExclusao(true), TEMPO_AVISO);
  }
  function registrarExclusao(item){
    exclusoes.push({ nome:item.nome, tipo:ROTULO_TIPO[item.tipo] || item.tipo });
    salvarExclusoes();
    mostrarExclusoes();   // se já estiver no dashboard; senão aparece quando o dashboard for aberto
  }
  document.addEventListener('click', e => { if(e.target.closest('#exclusaoAviso .maquina-aviso-fechar')) esconderExclusao(true); });

  function nomeAtiva(){
    if(!window.NexusMaquinaId()) return null;
    return maquinas.find(m => m.id === ativa)?.nome || null;
  }

  function atualizarTitulo(){
    const t = $('#dashMaquinaTitulo');
    if(!t) return;
    const nome = nomeAtiva();
    t.textContent = nome ? `Saúde da Máquina: ${nome}` : 'Saúde da Máquina Virtual (Oracle Linux VM):';
  }

  function montarSeletor(){
    const sel = $('#maquinaSelect');
    if(!sel) return;
    if(ativa !== 'local' && !maquinas.some(m => m.id === ativa)) ativa = 'local';
    sel.innerHTML = '<option value="local">Servidor Nexus (local)</option>' +
      maquinas.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('');
    sel.value = ativa;
    desenharMenuMaquinas();
    atualizarTitulo();
    sincronizarVisibilidade();
  }

  function opcoesMaquinas(){
    return [{ id:'local', nome:'Servidor Nexus (local)', tipo:'linux' }, ...maquinas.map(m => ({ id:m.id, nome:m.nome, tipo:m.tipo }))];
  }
  function desenharMenuMaquinas(){
    const menu = $('#maquinaMenu'), rotulo = $('#maquinaRotulo');
    if(!menu) return;
    const lista = opcoesMaquinas();
    const atual = lista.find(o => o.id === ativa) || lista[0];
    if(rotulo) rotulo.textContent = atual.nome;
    menu.innerHTML = lista.map(o => `
      <li role="option" class="maquina-opcao${o.id === atual.id ? ' is-ativa' : ''}" data-maquina="${esc(o.id)}" aria-selected="${o.id === atual.id}" tabindex="-1">
        <span class="maquina-opcao-ico">${ICONES[o.tipo] || ICONES.outro}</span>
        <span class="maquina-opcao-nome">${esc(o.nome)}</span>
        <svg class="maquina-opcao-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </li>`).join('');
  }
  function menuAberto(){ const m = $('#maquinaMenu'); return !!m && !m.hidden; }
  function abrirMenu(){
    const menu = $('#maquinaMenu'), gat = $('#maquinaTrigger');
    if(!menu || !gat) return;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-aberto'));
    gat.setAttribute('aria-expanded', 'true');
    $('#maquinaSwitch')?.classList.add('is-aberto');
    (menu.querySelector('.is-ativa') || menu.querySelector('.maquina-opcao'))?.focus({ preventScroll:true });
  }
  function fecharMenu(devolverFoco){
    const menu = $('#maquinaMenu'), gat = $('#maquinaTrigger');
    if(!menu || menu.hidden) return;
    menu.classList.remove('is-aberto');
    $('#maquinaSwitch')?.classList.remove('is-aberto');
    gat?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if(!menu.classList.contains('is-aberto')) menu.hidden = true; }, 160);
    if(devolverFoco) gat?.focus({ preventScroll:true });
  }
  function escolherMaquina(id){
    const sel = $('#maquinaSelect');
    if(sel) sel.value = id;
    fecharMenu(true);
    if(id !== ativa) trocarMaquina(id);
    desenharMenuMaquinas();
  }
  // Um clique só: abre/fecha no botão inteiro (não só no meio).
  document.addEventListener('click', e => {
    if(e.target.closest('#maquinaTrigger')){ menuAberto() ? fecharMenu(false) : abrirMenu(); return; }
    const op = e.target.closest('.maquina-opcao');
    if(op){ escolherMaquina(op.dataset.maquina); return; }
    if(menuAberto() && !e.target.closest('#maquinaSwitch')) fecharMenu(false);
  });
  document.addEventListener('keydown', e => {
    const gat = e.target.closest?.('#maquinaTrigger'), op = e.target.closest?.('.maquina-opcao');
    if(e.key === 'Escape' && menuAberto()){ e.preventDefault(); fecharMenu(true); return; }
    if(gat && ['ArrowDown','ArrowUp'].includes(e.key)){ e.preventDefault(); if(!menuAberto()) abrirMenu(); return; }
    if(!op) return;
    const itens = [...document.querySelectorAll('.maquina-opcao')];
    const i = itens.indexOf(op);
    if(e.key === 'ArrowDown'){ e.preventDefault(); itens[(i + 1) % itens.length].focus(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); itens[(i - 1 + itens.length) % itens.length].focus(); }
    else if(e.key === 'Home'){ e.preventDefault(); itens[0].focus(); }
    else if(e.key === 'End'){ e.preventDefault(); itens[itens.length - 1].focus(); }
    else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); escolherMaquina(op.dataset.maquina); }
    else if(e.key === 'Tab') fecharMenu(false);
  });

  function sincronizarVisibilidade(){
    mostrarExclusoes();
    const caixa = $('#maquinaSwitch');
    if(!caixa) return;
    const noDashboard = !!$('#view-dashboard.active');
    caixa.hidden = !(noDashboard && maquinas.length > 0);
    if(caixa.hidden) fecharMenu(false);
  }

  function trocarMaquina(id){
    ativa = id || 'local';
    try{ localStorage.setItem(CHAVE, ativa); }catch(e){}
    window.NexusMaquinaAviso('');
    desenharMenuMaquinas();
    atualizarTitulo();
    // Zera o histórico da RAM e os números para não misturar duas máquinas no mesmo gráfico.
    try{ ramHistoricoPercentual.length = 0; }catch(e){}
    ['cpuUsoPct','cpuLivrePct','ramUsoPct'].forEach(i => { const e = document.getElementById(i); if(e) e.textContent = '--%'; });
    ['ramTotal','ramLivre','cpuVelocidade'].forEach(i => { const e = document.getElementById(i); if(e) e.textContent = '--'; });
    try{ uptimeBaseSegundos = 0; uptimeReferenciaMs = Date.now(); }catch(e){}
    try{ buscarStatusCPU(); }catch(e){}
  }

  document.addEventListener('change', e => {
    if(e.target.id === 'maquinaSelect') trocarMaquina(e.target.value);
  });

  // Só mostra o seletor quando a tela ativa é o dashboard.
  new MutationObserver(sincronizarVisibilidade)
    .observe(document.documentElement, { subtree:true, attributes:true, attributeFilter:['class'] });

  async function carregarMaquinas(){
    try{
      const b = await api('/api/maquinas');
      maquinas = b.itens || [];
      zabbixAtivo = !!b.zabbix_ativo;
    }catch(e){ maquinas = []; }
    montarSeletor();
  }

  async function carregarFontes(){
    try{ fontes = (await api('/api/conectores')).itens || []; }catch(e){ fontes = []; }
  }

  async function carregarZabbix(){
    const el = $('#cxZabbix');
    if(!el) return;
    try{
      const s = await api('/api/zabbix/status');
      zabbixAtivo = !!s.ativo;
      if(!s.ativo){
        pintarZabbix('off', 'Zabbix desligado · configure ZABBIX_URL no .env');
      }else if(s.ultimo_erro){
        pintarZabbix('erro', 'Zabbix com erro · ' + s.ultimo_erro);
      }else{
        pintarZabbix('ok', 'Zabbix conectado' + (s.versao ? ' · v' + s.versao : ''));
      }
    }catch(e){ pintarZabbix('erro', 'Não foi possível consultar o Zabbix'); }
  }
  function pintarZabbix(estado, texto){
    const el = $('#cxZabbix');
    if(!el) return;
    const mudou = el.dataset.estado !== estado;
    el.dataset.estado = estado;
    el.querySelector('span').textContent = texto;
    el.title = texto;
    // Só anima quando o estado muda (carregando -> conectado etc.), não a cada leitura.
    if(mudou){ el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop'); }
  }

  async function carregarHostsZabbix(){
    const lista = $('#cxHostsLista');
    if(!lista || !zabbixAtivo) return;
    try{
      const b = await api('/api/maquinas/zabbix-hosts');
      lista._hosts = b.itens || [];
      $('#cxHostCombo')?.classList.toggle('is-livre', !lista._hosts.length);
      const dica = $('#cxHostDica');
      if(dica && lista._hosts.length) dica.textContent = `${lista._hosts.length} host(s) do Zabbix disponíveis: clique no campo para escolher ou digite para filtrar.`;
    }catch(e){  }
  }

  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let comboFiltrando = false, comboEscolhendo = false;
  const comboHosts = () => $('#cxHostsLista')?._hosts || [];
  function comboAberto(){ return !!$('#cxHostCombo')?.classList.contains('is-aberto'); }
  function desenharHosts(){
    const campo = $('#cxHost'), lista = $('#cxHostsLista');
    if(!campo || !lista) return;
    const q = comboFiltrando ? campo.value.trim().toLowerCase() : '';
    const itens = comboHosts().filter(h => !q || [h.host, h.nome, h.ip].some(v => String(v || '').toLowerCase().includes(q)));
    lista.innerHTML = itens.length ? itens.map((h, i) => {
      const ativa = h.host === campo.value;
      return `<li class="cx-sel-op tem-ico${ativa ? ' is-ativa' : ''}" role="option" tabindex="-1" style="--i:${Math.min(i, 10)}" data-host="${esc(h.host)}" aria-selected="${ativa}">` +
        `<i class="cx-sel-ico cx-sel-ico--linux">${ICONES.linux}</i>` +
        `<span class="cx-sel-txt"><b>${esc(h.host)}</b><small>${esc(h.nome)}${h.ip ? ' · ' + esc(h.ip) : ''}</small></span>${CHECK}</li>`;
    }).join('') : '<li class="cx-sel-vazio" role="presentation">Nenhum host encontrado com esse texto.</li>';
  }
  function fecharHosts(foco){
    const caixa = $('#cxHostCombo'), lista = $('#cxHostsLista'), campo = $('#cxHost');
    if(!caixa || !lista || lista.hidden) return;
    caixa.classList.remove('is-aberto', 'abre-cima');
    campo?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if(!caixa.classList.contains('is-aberto')) lista.hidden = true; }, 160);
    if(foco) campo?.focus({ preventScroll:true });
  }
  function abrirHosts(){
    const caixa = $('#cxHostCombo'), lista = $('#cxHostsLista'), campo = $('#cxHost');
    if(!caixa || !lista || !campo || !comboHosts().length) return;
    if(comboAberto()){ desenharHosts(); return; }
    caixa._fechar = fecharHosts;   // os outros dropdowns (selects.js) fecham este através daqui
    document.querySelectorAll('.cx-sel.is-aberto').forEach(c => { if(c !== caixa) c._fechar?.(false); });
    desenharHosts();
    lista.hidden = false;
    // Sem espaço embaixo? abre para cima e a lista encolhe/rola por dentro em vez de ser cortada.
    lista.style.maxHeight = '';
    const r = campo.getBoundingClientRect();
    const teto = Math.min(470, window.innerHeight * 0.62);
    const altura = Math.min(lista.scrollHeight, teto);
    const topo = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;   // a barra do topo fica por cima da lista
    const abaixo = window.innerHeight - r.bottom - 16, acima = r.top - Math.max(16, topo + 10);
    const cima = abaixo < altura && acima > abaixo;
    caixa.classList.toggle('abre-cima', cima);
    lista.style.maxHeight = `${Math.round(Math.max(170, Math.min(teto, (cima ? acima : abaixo) - 6)))}px`;
    requestAnimationFrame(() => caixa.classList.add('is-aberto'));
    campo.setAttribute('aria-expanded', 'true');
    lista.querySelector('.is-ativa')?.scrollIntoView({ block:'nearest' });
  }
  function escolherHost(valor){
    const campo = $('#cxHost');
    if(!campo) return;
    comboEscolhendo = true;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles:true }));   // preenche nome e IP se estiverem vazios
    comboEscolhendo = false;
    comboFiltrando = false;
    fecharHosts(true);
  }
  (() => {
    // Registrado no document porque o roteador troca o <body>.
    document.addEventListener('click', e => {
      if(e.target.closest('#cxHost')){ comboFiltrando = false; abrirHosts(); return; }
      const op = e.target.closest('#cxHostsLista .cx-sel-op');
      if(op){ e.preventDefault(); escolherHost(op.dataset.host); return; }   // preventDefault: o <label> não reabre o campo
      if(e.target.closest('#cxHostsLista')){ e.preventDefault(); return; }
      if(comboAberto() && !e.target.closest('#cxHostCombo')) fecharHosts(false);
    });
    document.addEventListener('mousedown', e => { if(e.target.closest('#cxHostsLista')) e.preventDefault(); });   // não tira o foco do campo
    document.addEventListener('input', e => {
      if(e.target.id !== 'cxHost' || comboEscolhendo) return;
      comboFiltrando = true;
      abrirHosts();
    });
    document.addEventListener('keydown', e => {
      const campo = e.target.closest?.('#cxHost'), op = e.target.closest?.('#cxHostsLista .cx-sel-op');
      if(!campo && !op) return;
      const ops = [...document.querySelectorAll('#cxHostsLista .cx-sel-op')];
      if(e.key === 'Escape' && comboAberto()){ e.preventDefault(); e.stopPropagation(); fecharHosts(true); return; }
      if(campo){
        if(e.key === 'ArrowDown'){ e.preventDefault(); if(!comboAberto()){ comboFiltrando = false; abrirHosts(); } setTimeout(() => ($('#cxHostsLista .is-ativa') || $('#cxHostsLista .cx-sel-op'))?.focus(), 0); }
        else if(e.key === 'Tab') fecharHosts(false);
        return;
      }
      const i = ops.indexOf(op);
      if(e.key === 'ArrowDown'){ e.preventDefault(); ops[(i + 1) % ops.length].focus(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); i === 0 ? $('#cxHost').focus() : ops[i - 1].focus(); }
      else if(e.key === 'Home'){ e.preventDefault(); ops[0].focus(); }
      else if(e.key === 'End'){ e.preventDefault(); ops[ops.length - 1].focus(); }
      else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); escolherHost(op.dataset.host); }
      else if(e.key === 'Tab') fecharHosts(false);
    });
  })();

  function classeStatus(st){
    const s = String(st || '').toLowerCase();
    if(['conectada','válida','válido'].includes(s)) return 'ok';
    if(['erro','inválido','inválida','não encontrada','sem dados'].includes(s)) return 'ruim';
    return 'neutro';
  }
  const CATEGORIA = { linux:'servidores', windows:'servidores', outro:'servidores', banco:'bancos', sql:'bancos', api:'fontes', planilha:'fontes' };
  let filtro = 'todos';
  function itensUnificados(){
    return [
      ...maquinas.map(m => ({ chave:'maquina:' + m.id, tipo:m.tipo, nome:m.nome, sub:m.endereco || m.host_zabbix || '', status:m.status || 'não validada', origem:m })),
      ...fontes.map(f => ({ chave:'fonte:' + f.id, tipo:f.tipo, nome:f.nome, sub:f.url || '', status:f.status || 'não validado', origem:f }))
    ];
  }
  function itemSelecionado(){ return itensUnificados().find(i => i.chave === selecionado) || null; }

  function renderizar(){
    const grid = $('#cxGrid');
    if(!grid) return;
    const todos = itensUnificados();
    if(selecionado && !todos.some(i => i.chave === selecionado)) selecionado = null;
    const contar = c => c === 'todos' ? todos.length : todos.filter(i => CATEGORIA[i.tipo] === c).length;
    document.querySelectorAll('#cxFiltros [data-cx-filtro]').forEach(b => {
      b.classList.toggle('is-ativo', b.dataset.cxFiltro === filtro);
      b.querySelector('b').textContent = contar(b.dataset.cxFiltro);
    });
    const itens = filtro === 'todos' ? todos : todos.filter(i => CATEGORIA[i.tipo] === filtro);

    $('#cxContagem').textContent = todos.length;
    $('#cxVazio').hidden = itens.length > 0;
    $('#cxVazio').querySelector('strong').textContent = todos.length ? 'Nada neste filtro' : 'Nenhuma máquina cadastrada';
    $('#cxVazio').querySelector('span').textContent = todos.length ? 'Escolha outro filtro para ver os demais itens.' : 'Use o formulário ao lado para adicionar a primeira.';
    grid.hidden = itens.length === 0;

    grid.innerHTML = itens.map(i => `
      <button type="button" class="cx-tile${i.chave === selecionado ? ' is-selected' : ''}" role="option" aria-selected="${i.chave === selecionado}" data-cx="${esc(i.chave)}" title="${esc(i.nome)}">
        <span class="cx-ico cx-ico--${esc(i.tipo)}">${ICONES[i.tipo] || ICONES.outro}</span>
        <span class="cx-nome">${esc(i.nome)}</span>
        <span class="cx-tipo">${esc(ROTULO_TIPO[i.tipo] || i.tipo)}</span>
        <span class="cx-status cx-status--${classeStatus(i.status)}"><i></i>${esc(i.status)}</span>
      </button>`).join('');

    const sel = itemSelecionado();
    ['cxConectar','cxValidar','cxExcluir'].forEach(id => { const b = document.getElementById(id); if(b) b.disabled = !sel; });
    const dash = document.getElementById('cxVerDash');
    if(dash) dash.disabled = !(sel && sel.chave.startsWith('maquina:'));

    const info = $('#cxSelecionado');
    if(!sel){
      info.hidden = false; info.classList.add('is-vazio');
      info.innerHTML = '<p class="cx-placeholder">Selecione uma máquina ou fonte acima para conectar, validar ou abrir no dashboard.</p>';
      return;
    }
    info.classList.remove('is-vazio');
    const o = sel.origem;
    const linhas = [
      ['Tipo', ROTULO_TIPO[sel.tipo] || sel.tipo],
      [sel.chave.startsWith('maquina:') ? 'Endereço' : 'URL', sel.sub || '—']
    ];
    if(sel.chave.startsWith('maquina:')) linhas.push(['Host no Zabbix', o.host_zabbix || 'procurado pelo IP']);
    if(o.instancia) linhas.push(['Instância / SID', o.instancia]);
    if(o.descricao) linhas.push(['Descrição', o.descricao]);
    info.hidden = false;
    info.innerHTML = `<strong>${esc(sel.nome)}</strong>` +
      linhas.map(([k, v]) => `<span><em>${esc(k)}</em>${esc(v)}</span>`).join('') +
      (o.mensagem ? `<p class="cx-msg cx-msg--${classeStatus(sel.status)}">${esc(o.mensagem)}</p>` : '');
  }

  // Avisos da tela: cartões que entram, ficam alguns segundos e somem sozinhos.
  const ICONE_TOAST = {
    ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    erro:'<path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/>',
    info:'<path d="M12 7.5h.01M12 11v5.5"/><circle cx="12" cy="12" r="9"/>'
  };
  let toastCarregando = null;
  function fecharToast(t){
    if(!t || t.dataset.saindo) return;
    t.dataset.saindo = '1';
    clearTimeout(t._timer);
    t.classList.add('is-saindo');
    setTimeout(() => t.remove(), 280);
  }
  function feedback(texto, erro){
    const area = $('#cxToasts');
    if(!area) return;
    if(toastCarregando){ fecharToast(toastCarregando); toastCarregando = null; }
    if(!texto) return;
    const carregando = /…$/.test(texto);
    const tipo = erro ? 'erro' : (carregando ? 'info' : 'ok');
    const t = document.createElement('div');
    t.className = 'cx-toast cx-toast--' + tipo;
    t.innerHTML = `<span class="cx-toast-ico">${carregando ? '<i class="cx-spin"></i>' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONE_TOAST[tipo]}</svg>`}</span>` +
      `<span class="cx-toast-txt">${esc(texto)}</span>` +
      (carregando ? '' : '<button type="button" class="cx-toast-x" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><i class="cx-toast-barra"></i>');
    area.appendChild(t);
    while(area.children.length > 3) fecharToast(area.firstElementChild);
    if(carregando) toastCarregando = t;
    else{
      const ms = erro ? 8000 : 5000;
      t.style.setProperty('--dur', ms + 'ms');
      t._timer = setTimeout(() => fecharToast(t), ms);
    }
  }
  document.addEventListener('click', e => { const x = e.target.closest('.cx-toast-x'); if(x) fecharToast(x.closest('.cx-toast')); });

  async function recarregarTudo(){
    await Promise.all([carregarMaquinas(), carregarFontes()]);
    renderizar();
    document.dispatchEvent(new CustomEvent('nexusMaquinasAtualizadas'));  // listas de banco/conector em outras telas
  }

  function ajustarFormulario(){
    const tipo = $('#cxTipo')?.value;
    if(!tipo) return;
    const ehMaquina = TIPOS_MAQUINA.includes(tipo);
    document.querySelectorAll('#cxForm [data-so]').forEach(c => {
      const so = c.dataset.so;
      c.hidden = so === 'maquina' ? !ehMaquina : so === 'fonte' ? ehMaquina : so === 'banco' ? tipo !== 'banco' : tipo !== 'sql';
    });
    $('#cxRotuloEndereco').textContent = ehMaquina ? 'IP ou endereço' : 'URL ou host da fonte';
    $('#cxEndereco').placeholder = ehMaquina ? 'Ex.: 10.0.0.15' : 'Ex.: https://api.empresa.com/dados';
    $('#cxEndereco').required = !ehMaquina;
    // fontes com "autenticação: sem" não precisam do campo token, mas o formulário antigo já aceitava vazio.
  }

  document.addEventListener('change', e => {
    if(e.target.id === 'cxTipo') ajustarFormulario();
  });

  // Escolheu um host do Zabbix na lista: já preenche nome e IP se estiverem vazios.
  document.addEventListener('input', e => {
    if(e.target.id !== 'cxHost') return;
    const h = ($('#cxHostsLista')?._hosts || []).find(x => x.host === e.target.value);
    if(!h) return;
    if(!$('#cxNome').value.trim()) $('#cxNome').value = h.nome || h.host;
    if(!$('#cxEndereco').value.trim() && h.ip) $('#cxEndereco').value = h.ip;
  });

  document.addEventListener('submit', async e => {
    if(e.target.id !== 'cxForm') return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const ehMaquina = TIPOS_MAQUINA.includes(d.tipo);
    const botao = $('#cxAdicionar');
    botao.disabled = true;
    feedback('Adicionando…');
    try{
      let novo;
      if(ehMaquina){
        novo = (await api('/api/maquinas', { method:'POST', body:JSON.stringify(d) })).item;
        selecionado = 'maquina:' + novo.id;
      }else{
        const corpo = { nome:d.nome, tipo:d.tipo, url:d.endereco, banco:d.banco || '', autenticacao:d.autenticacao || 'nenhuma', token:d.token || '' };
        novo = (await api('/api/conectores', { method:'POST', body:JSON.stringify(corpo) })).item;
        selecionado = 'fonte:' + novo.id;
      }
      e.target.reset();
      ajustarFormulario();
      await recarregarTudo();
      const st = (novo.status || '').toLowerCase();
      feedback(ehMaquina && st === 'válida' ? 'Máquina adicionada e encontrada no Zabbix.'
        : ehMaquina && st && st !== 'não validada' ? 'Máquina adicionada, mas: ' + (novo.mensagem || novo.status)
        : 'Adicionado com sucesso.', ehMaquina && ['erro','não encontrada'].includes(st));
    }catch(erro){ feedback(erro.message, true); }
    finally{ botao.disabled = false; }
  });

  function confirmarExclusao(item){
    return new Promise(resolve => {
      const overlay = document.getElementById('cxConfirmOverlay');
      const texto = document.getElementById('cxConfirmText');
      if(!overlay || !texto){ resolve(window.confirm(`Excluir "${item.nome}"?`)); return; }
      const ehMaquina = String(item.chave || '').startsWith('maquina:');
      document.getElementById('cxConfirmTitle').textContent = ehMaquina ? 'Excluir máquina?' : 'Excluir conector?';
      texto.innerHTML = `Você tem certeza que deseja excluir <strong>${esc(item.nome)}</strong> (<strong>${esc(ROTULO_TIPO[item.tipo] || item.tipo)}</strong>)? Esta ação não pode ser desfeita.`;
      let aberto = true;
      const fechar = resposta => {
        if(!aberto) return;
        aberto = false;
        overlay.classList.remove('show');
        overlay.removeEventListener('click', aoClicar);
        document.removeEventListener('keydown', aoTeclar, true);
        resolve(resposta);
      };
      const aoClicar = e => {
        if(e.target.closest('#cxConfirmYes')) fechar(true);
        else if(e.target.closest('#cxConfirmCancel') || e.target.closest('#cxConfirmClose') || e.target === overlay) fechar(false);
      };
      const aoTeclar = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fechar(false); } };
      overlay.addEventListener('click', aoClicar);
      document.addEventListener('keydown', aoTeclar, true);
      overlay.classList.add('show');
      setTimeout(() => document.getElementById('cxConfirmCancel')?.focus(), 60);
    });
  }

  async function acao(rotulo, fn){
    const sel = itemSelecionado();
    if(!sel) return;
    const botoes = [...document.querySelectorAll('.cx-acoes .cx-btn')];
    botoes.forEach(b => b.disabled = true);
    feedback(rotulo + '…');
    try{ await fn(sel); }
    catch(erro){ feedback(erro.message, true); }
    finally{ await recarregarTudo(); }
  }

  document.addEventListener('click', async e => {
    const chip = e.target.closest('[data-cx-filtro]');
    if(chip){ filtro = chip.dataset.cxFiltro; renderizar(); return; }
    const tile = e.target.closest('[data-cx]');
    if(tile){
      selecionado = tile.dataset.cx;
      feedback('');
      renderizar();
      return;
    }
    const id = e.target.closest('.cx-acoes .cx-btn')?.id;
    if(!id) return;
    const [tipo, itemId] = (selecionado || ':').split(':');

    if(id === 'cxConectar') acao('Conectando', async () => {
      if(tipo === 'maquina'){
        const r = await api(`/api/maquinas/${itemId}/conectar`, { method:'POST' });
        feedback(r.message, !r.conectada);
      }else{
        const r = await api(`/api/conectores/${itemId}/validar`, { method:'POST' });
        feedback(r.valido ? 'Fonte válida e pronta para uso.' : 'Fonte inválida: ' + (r.errors || []).join(' '), !r.valido);
      }
    });
    if(id === 'cxValidar') acao('Validando', async () => {
      if(tipo === 'maquina'){
        const r = await api(`/api/maquinas/${itemId}/validar`, { method:'POST' });
        feedback(r.message, !r.valido);
      }else{
        const r = await api(`/api/conectores/${itemId}/validar`, { method:'POST' });
        feedback(r.valido ? 'Fonte válida.' : 'Fonte inválida: ' + (r.errors || []).join(' '), !r.valido);
      }
    });
    if(id === 'cxExcluir'){
      const sel = itemSelecionado();
      if(!sel || !(await confirmarExclusao(sel))) return;
      acao('Excluindo', async () => {
        await api(tipo === 'maquina' ? `/api/maquinas/${itemId}` : `/api/conectores/${itemId}`, { method:'DELETE' });
        registrarExclusao(sel);
        if(tipo === 'maquina' && ativa === itemId){ ativa = 'local'; try{ localStorage.setItem(CHAVE, 'local'); }catch(x){} }
        selecionado = null;
        feedback('Excluído.');
      });
    }
    if(id === 'cxVerDash' && tipo === 'maquina'){
      const sel = $('#maquinaSelect');
      if(sel) sel.value = itemId;
      trocarMaquina(itemId);
      window.NexusMostrarView?.('dashboard');
    }
  });

  async function iniciar(){
    if(!document.querySelector('.app')) return;
    await recarregarTudo();
    ajustarFormulario();
    carregarZabbix();
    carregarHostsZabbix();
  }
  document.addEventListener('usuarioAutenticado', iniciar);
  document.addEventListener('nexusRotaAlterada', () => { if(document.querySelector('.app') && window.NexusMaquinaId !== undefined && maquinas.length === 0) iniciar(); });
  // Ao abrir a aba "Conectores de Dados", atualiza a lista e o estado do Zabbix.
  document.addEventListener('click', e => {
    if(e.target.closest('.nav-item[data-view="conectores"]')){ recarregarTudo(); carregarZabbix(); carregarHostsZabbix(); }
  });
})();

