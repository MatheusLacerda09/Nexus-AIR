(function () {
  'use strict';

  const TXT = {
    pt: {
      meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
      dias: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      anterior: 'Mês anterior', proximo: 'Próximo mês', mes: 'Mês', ano: 'Ano',
      escolherData: 'Selecionar data', escolherHora: 'Selecionar horário',
      hoje: 'Hoje', hora: 'Hora', minuto: 'Minuto', atalhos: 'Atalhos',
      locale: 'pt-BR',
      presets: [['07:00', 'Manhã'], ['12:00', 'Meio-dia'], ['18:00', 'Fim do dia'], ['23:00', 'Noite']],
      rotulos: { '00:00': 'Meia-noite', '02:00': 'Madrugada', '06:00': 'Amanhecer', '08:00': 'Comercial', '12:00': 'Meio-dia', '13:00': 'Tarde', '18:00': 'Fim do dia', '22:00': 'Noite', '23:59': 'Fim do dia' }
    },
    en: {
      meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      dias: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      anterior: 'Previous month', proximo: 'Next month', mes: 'Month', ano: 'Year',
      escolherData: 'Select date', escolherHora: 'Select time',
      hoje: 'Today', hora: 'Hour', minuto: 'Minute', atalhos: 'Shortcuts',
      locale: 'en-US',
      presets: [['07:00', 'Morning'], ['12:00', 'Noon'], ['18:00', 'End of day'], ['23:00', 'Night']],
      rotulos: { '00:00': 'Midnight', '02:00': 'Night owl', '06:00': 'Sunrise', '08:00': 'Business', '12:00': 'Noon', '13:00': 'Afternoon', '18:00': 'End of day', '22:00': 'Night', '23:59': 'End of day' }
    }
  };
  const lang = () => String(document.documentElement.lang || document.documentElement.dataset?.lang || '').toLowerCase().startsWith('en') ? 'en' : 'pt';
  const tx = () => TXT[lang()];

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return null;
    const [y, m, d] = v.split('-').map(Number);
    const data = new Date(y, m - 1, d);
    return data.getFullYear() === y && data.getMonth() === m - 1 && data.getDate() === d ? data : null;
  };
  const horaValida = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
  const SETA = '<svg class="ic"><use href="#ic-chevron-down"/></svg>';

  // Estado por campo (WeakMap: some junto com o DOM antigo quando o body é trocado).
  const estado = new WeakMap();
  const st = (raiz) => {
    if (!estado.has(raiz)) estado.set(raiz, { vista: new Date(), modo: 'dias' });
    return estado.get(raiz);
  };

  // Popovers levados ao <body> (horário do calendário do dashboard, que abre ao lado do calendário).
  const popDe = new WeakMap();
  const lateral = (raiz) => Boolean(raiz.closest('.period-time-row') || popDe.has(raiz));

  const partes = (raiz) => ({
    input: raiz.querySelector('input[type="hidden"]'),
    gatilho: raiz.querySelector('[data-nx-trigger]'),
    rotulo: raiz.querySelector('[data-nx-label]'),
    pop: popDe.get(raiz) || raiz.querySelector('[data-nx-popover]')
  });

  function textoDoValor(raiz, valor) {
    const tipo = raiz.dataset.nxPicker;
    if (tipo === 'time') return horaValida(valor) ? valor : tx().escolherHora;
    const d = deIso(valor);
    return d ? new Intl.DateTimeFormat(tx().locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d) : tx().escolherData;
  }
  function sincronizar(raiz) {
    const { input, gatilho, rotulo } = partes(raiz);
    if (!input || !gatilho) return;
    const texto = textoDoValor(raiz, input.value);
    if (rotulo) rotulo.textContent = texto;
    gatilho.classList.toggle('has-value', Boolean(input.value));
    gatilho.setAttribute('aria-label', `${input.getAttribute('aria-label') || ''}: ${texto}`.replace(/^: /, ''));
  }

  function montar(raiz) {
    let { pop } = partes(raiz);
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'birthday-date-popover nx-popover';
    pop.dataset.nxPopover = '';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    raiz.appendChild(pop);
    pop.addEventListener('click', (e) => cliqueNoPopover(raiz, e));
    pop.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      const s = st(raiz);
      if (s.modo !== 'dias' && s.modo !== 'horas') { s.modo = raiz.dataset.nxPicker === 'time' ? 'horas' : 'dias'; desenhar(raiz); return; }
      fechar(raiz, true);
    });
    return pop;
  }

  function limites(input) {
    return { min: deIso(input.dataset.min), max: deIso(input.dataset.max) };
  }

  function desenharData(raiz) {
    const t = tx();
    const { input, pop } = partes(raiz);
    const s = st(raiz);
    const { min, max } = limites(input);
    const hoje = new Date();
    const sel = deIso(input.value);
    const y = s.vista.getFullYear();
    const m = s.vista.getMonth();
    const anoMin = (min || hoje).getFullYear();
    const anoMax = Math.max((max || new Date(hoje.getFullYear() + 5, 0, 1)).getFullYear(), anoMin);

    pop.setAttribute('aria-label', t.escolherData);
    pop.classList.add('nx-popover--data');

    const primeiro = new Date(y, m, 1);
    const total = new Date(y, m + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < primeiro.getDay(); i++) celulas.push('<span class="birthday-date-empty" aria-hidden="true"></span>');
    for (let dia = 1; dia <= total; dia++) {
      const d = new Date(y, m, dia);
      const v = iso(d);
      const fora = (min && d < min) || (max && d > max);
      const rotulo = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      celulas.push(`<button type="button" class="birthday-date-day${sel && v === iso(sel) ? ' is-selected' : ''}${v === iso(hoje) ? ' is-today' : ''}" data-nx-dia="${v}"${fora ? ' disabled' : ''} aria-label="${rotulo}"${sel && v === iso(sel) ? ' aria-pressed="true"' : ''}>${dia}</button>`);
    }
    const mesesHtml = t.meses.map((nome, i) => {
      const fora = (min && new Date(y, i + 1, 0) < min) || (max && new Date(y, i, 1) > max);
      return `<button type="button" role="option" class="birthday-date-chip${i === m ? ' is-current' : ''}" data-nx-mes="${i}"${fora ? ' disabled' : ''} aria-selected="${i === m}">${nome.slice(0, 3)}</button>`;
    }).join('');
    let anosHtml = '';
    for (let a = anoMin; a <= anoMax; a++) anosHtml += `<button type="button" role="option" class="birthday-date-chip${a === y ? ' is-current' : ''}" data-nx-ano="${a}" aria-selected="${a === y}">${a}</button>`;

    const ant = new Date(y, m - 1, 1), prox = new Date(y, m + 1, 1);
    const antOff = min && new Date(ant.getFullYear(), ant.getMonth() + 1, 0) < min;
    const proxOff = max && prox > max;
    const emDias = s.modo === 'dias', emMeses = s.modo === 'meses', emAnos = s.modo === 'anos';

    pop.innerHTML = `
      <div class="birthday-date-toolbar">
        <button type="button" class="birthday-date-nav" data-nx-ant aria-label="${t.anterior}"${antOff ? ' disabled' : ''}>${SETA}</button>
        <div class="birthday-date-heading">
          <button type="button" class="birthday-date-pick${emMeses ? ' is-open' : ''}" data-nx-modo="meses" aria-haspopup="listbox" aria-expanded="${emMeses}" aria-label="${t.mes}: ${t.meses[m]}"><span>${t.meses[m]}</span>${SETA}</button>
          <button type="button" class="birthday-date-pick${emAnos ? ' is-open' : ''}" data-nx-modo="anos" aria-haspopup="listbox" aria-expanded="${emAnos}" aria-label="${t.ano}: ${y}"><span>${y}</span>${SETA}</button>
        </div>
        <button type="button" class="birthday-date-nav" data-nx-prox aria-label="${t.proximo}"${proxOff ? ' disabled' : ''}>${SETA}</button>
      </div>
      <div class="birthday-date-body">
        <div class="birthday-date-view birthday-date-view-days${emDias ? ' is-active' : ''}">
          <div class="birthday-date-weekdays">${t.dias.map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="birthday-date-grid">${celulas.join('')}</div>
        </div>
        <div class="birthday-date-view birthday-date-view-months${emMeses ? ' is-active' : ''}" role="listbox" aria-label="${t.mes}">${mesesHtml}</div>
        <div class="birthday-date-view birthday-date-view-years${emAnos ? ' is-active' : ''}" role="listbox" aria-label="${t.ano}">${anosHtml}</div>
      </div>
      <div class="nx-rodape"><button type="button" class="birthday-date-clear" data-nx-hoje>${t.hoje}</button></div>`;

    if (emAnos) pop.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
  }

  function desenharHora(raiz) {
    const t = tx();
    const { input, pop } = partes(raiz);
    const s = st(raiz);
    const [h, mi] = horaValida(input.value) ? input.value.split(':') : ['', ''];
    const emHoras = s.modo !== 'minutos';

    pop.setAttribute('aria-label', t.escolherHora);
    pop.classList.add('nx-popover--hora');

    const horas = Array.from({ length: 24 }, (_, i) => pad(i)).map((v) =>
      `<button type="button" class="birthday-date-chip${v === h ? ' is-current' : ''}" data-nx-h="${v}" aria-pressed="${v === h}">${v}</button>`).join('');
    // data-minutos="00,05,...,59" e data-presets="00:00,12:00,23:59" no <input hidden> personalizam a grade.
    const listaMin = (input.dataset.minutos || '').split(',').map((v) => v.trim()).filter((v) => /^[0-5]\d$/.test(v));
    const minutos = (listaMin.length ? listaMin : Array.from({ length: 12 }, (_, i) => pad(i * 5))).map((v) =>
      `<button type="button" class="birthday-date-chip${v === mi ? ' is-current' : ''}" data-nx-m="${v}" aria-pressed="${v === mi}">${v}</button>`).join('');
    const listaPre = (input.dataset.presets || '').split(',').map((v) => v.trim()).filter(horaValida);
    const presets = listaPre.length ? listaPre.map((v) => [v, t.rotulos[v] || '']) : t.presets;
    const atalhos = presets.map(([v, nome]) =>
      `<button type="button" class="nx-atalho${input.value === v ? ' is-current' : ''}" data-nx-preset="${v}"><b>${v}</b>${nome ? `<span>${nome}</span>` : ''}</button>`).join('');

    pop.innerHTML = `
      <div class="nx-leitura" role="group" aria-label="${t.escolherHora}">
        <button type="button" class="nx-leitura-parte${emHoras ? ' is-open' : ''}" data-nx-modo="horas" aria-label="${t.hora}: ${h || '--'}">${h || '--'}</button>
        <span class="nx-leitura-sep" aria-hidden="true">:</span>
        <button type="button" class="nx-leitura-parte${!emHoras ? ' is-open' : ''}" data-nx-modo="minutos" aria-label="${t.minuto}: ${mi || '--'}">${mi || '--'}</button>
      </div>
      <p class="nx-legenda">${emHoras ? t.hora : t.minuto}</p>
      <div class="nx-hora-corpo">
        <div class="nx-grade nx-grade--horas${emHoras ? ' is-active' : ''}">${horas}</div>
        <div class="nx-grade nx-grade--minutos${!emHoras ? ' is-active' : ''}">${minutos}</div>
      </div>
      <div class="nx-atalhos" aria-label="${t.atalhos}">${atalhos}</div>`;
  }

  function desenhar(raiz) {
    montar(raiz);
    if (raiz.dataset.nxPicker === 'time') desenharHora(raiz); else desenharData(raiz);
    if (raiz.classList.contains('is-open') && lateral(raiz)) posicionar(raiz);
  }

  function fechar(raiz, devolverFoco) {
    const { pop, gatilho } = partes(raiz);
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    gatilho?.setAttribute('aria-expanded', 'false');
    raiz.classList.remove('is-open');
    if (devolverFoco) gatilho?.focus();
  }
  function fecharTodos(exceto) {
    document.querySelectorAll('[data-nx-picker].is-open').forEach((r) => { if (r !== exceto) fechar(r, false); });
  }
  function abrir(raiz, viaTeclado) {
    fecharTodos(raiz);
    const { input, gatilho } = partes(raiz);
    const s = st(raiz);
    if (raiz.dataset.nxPicker === 'time') {
      s.modo = 'horas';
    } else {
      const sel = deIso(input.value);
      const { min } = limites(input);
      const base = sel || min || new Date();
      s.vista = new Date(base.getFullYear(), base.getMonth(), 1);
      s.modo = 'dias';
    }
    desenhar(raiz);
    const { pop } = partes(raiz);
    if (lateral(raiz) && pop.parentElement !== document.body) {
      // O calendário do dashboard rola e corta o que sai dele: o painel de horas vai para o <body>
      // e abre AO LADO do calendário, sem empurrar o conteúdo para baixo.
      popDe.set(raiz, pop);
      pop.classList.add('nx-popover--lateral');
      document.body.appendChild(pop);
    }
    pop.hidden = false;
    gatilho.setAttribute('aria-expanded', 'true');
    raiz.classList.add('is-open');
    posicionar(raiz);
    if (raiz.dataset.nxPicker === 'time') pop.querySelector('.birthday-date-chip.is-current')?.scrollIntoView({ block: 'nearest' });
    // Aberto pelo teclado (Enter/Espaço): leva o foco para dentro, no dia/hora atual.
    if (viaTeclado) pop.querySelector('.is-selected, .is-current, .is-today, .birthday-date-day:not(:disabled), .birthday-date-chip')?.focus({ preventScroll: true });
  }
  // Abre para cima se não couber embaixo; se também não couber, rola a tela até caber.
  function posicionarLateral(raiz) {
    const { pop, gatilho } = partes(raiz);
    if (!pop || pop.hidden) return;
    const margem = 12, vao = 12;
    const calendario = document.querySelector('[data-period-popover]:not([hidden])');
    const a = (calendario || gatilho).getBoundingClientRect();
    const g = gatilho.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = a.right + vao;                                        // à direita do calendário
    if (left + w > window.innerWidth - margem) left = a.left - vao - w;   // sem espaço: à esquerda
    if (left < margem) left = Math.max(margem, (window.innerWidth - w) / 2); // telas estreitas: centralizado
    let top = Math.min(g.top - 8, window.innerHeight - h - margem);
    top = Math.max(top, margem);
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }
  function posicionar(raiz) {
    if (lateral(raiz)) return posicionarLateral(raiz);
    const { pop, gatilho } = partes(raiz);
    pop.classList.remove('opens-up');
    const campo = gatilho.getBoundingClientRect();
    const altura = pop.offsetHeight + 16;
    const abaixo = window.innerHeight - campo.bottom;
    if (abaixo < altura && campo.top > abaixo) pop.classList.add('opens-up');
    const p = pop.getBoundingClientRect();
    if (p.top < 0 || p.bottom > window.innerHeight) pop.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function definir(raiz, valor, fecharDepois) {
    const { input } = partes(raiz);
    if (!input) return;
    input.value = valor;
    sincronizar(raiz);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (fecharDepois) fechar(raiz, true); else desenhar(raiz);
  }

  function cliqueNoPopover(raiz, e) {
    const s = st(raiz);
    const { input } = partes(raiz);
    const alvo = (sel) => e.target.closest(sel);
    let b;
    if ((b = alvo('[data-nx-dia]')) && !b.disabled) return definir(raiz, b.dataset.nxDia, true);
    if (alvo('[data-nx-ant]')) { s.vista = new Date(s.vista.getFullYear(), s.vista.getMonth() - (s.modo === 'dias' ? 1 : 12), 1); return desenhar(raiz); }
    if (alvo('[data-nx-prox]')) { s.vista = new Date(s.vista.getFullYear(), s.vista.getMonth() + (s.modo === 'dias' ? 1 : 12), 1); return desenhar(raiz); }
    if ((b = alvo('[data-nx-modo]'))) {
      const m = b.dataset.nxModo;
      s.modo = s.modo === m ? (raiz.dataset.nxPicker === 'time' ? 'horas' : 'dias') : m;
      return desenhar(raiz);
    }
    if ((b = alvo('[data-nx-mes]')) && !b.disabled) { s.vista = new Date(s.vista.getFullYear(), Number(b.dataset.nxMes), 1); s.modo = 'dias'; return desenhar(raiz); }
    if ((b = alvo('[data-nx-ano]'))) { s.vista = new Date(Number(b.dataset.nxAno), s.vista.getMonth(), 1); s.modo = 'dias'; return desenhar(raiz); }
    if (alvo('[data-nx-hoje]')) {
      const { min, max } = limites(input);
      let d = new Date();
      if (min && d < min) d = min;
      if (max && d > max) d = max;
      return definir(raiz, iso(d), true);
    }
    if ((b = alvo('[data-nx-h]'))) {
      const mi = horaValida(input.value) ? input.value.split(':')[1] : '00';
      s.modo = 'minutos';
      return definir(raiz, `${b.dataset.nxH}:${mi}`, false);
    }
    if ((b = alvo('[data-nx-m]'))) {
      const h = horaValida(input.value) ? input.value.split(':')[0] : '07';
      return definir(raiz, `${h}:${b.dataset.nxM}`, true);
    }
    if ((b = alvo('[data-nx-preset]'))) return definir(raiz, b.dataset.nxPreset, true);
  }

  document.addEventListener('click', (e) => {
    const gatilho = e.target.closest?.('[data-nx-trigger]');
    const raiz = gatilho?.closest('[data-nx-picker]');
    if (raiz) {
      const { pop } = partes(raiz);
      if (pop && !pop.hidden) fechar(raiz, false); else abrir(raiz, e.detail === 0);
      return;
    }
    // clique fora: composedPath, porque o botão clicado pode ter sido recriado por desenhar()
    const caminho = e.composedPath ? e.composedPath() : [];
    document.querySelectorAll('[data-nx-picker].is-open').forEach((r) => {
      if (!caminho.includes(r) && !caminho.includes(popDe.get(r))) fechar(r, false);
    });
  });
  // Acompanha o calendário quando a janela muda de tamanho ou a página rola.
  const reposicionarLaterais = () => document.querySelectorAll('[data-nx-picker].is-open').forEach((r) => { if (lateral(r)) posicionarLateral(r); });
  window.addEventListener('resize', reposicionarLaterais);
  document.addEventListener('scroll', reposicionarLaterais, true);
  // Esc fecha o campo aberto, esteja o foco no botão ou dentro do popover.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberto = document.querySelector('[data-nx-picker].is-open');
    if (!aberto) return;
    const s = st(aberto);
    const dentro = partes(aberto).pop?.contains(document.activeElement);
    if (dentro && s.modo !== 'dias' && s.modo !== 'horas') return;  // o popover volta para a grade antes de fechar
    fechar(aberto, true);
  });
  document.addEventListener('nexusRotaAlterada', () => setTimeout(sincronizarTodos, 0));
  document.addEventListener('nexusIdiomaAlterado', sincronizarTodos);

  function sincronizarTodos(raizDoc) {
    (raizDoc && raizDoc.querySelectorAll ? raizDoc : document).querySelectorAll('[data-nx-picker]').forEach(sincronizar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => sincronizarTodos(), { once: true });
  else sincronizarTodos();

  // API: NexusPicker.sync(elemento) — elemento pode ser um campo, ou um container (ex.: o formulário).
  window.NexusPicker = {
    sync(el) {
      const base = el || document;
      if (base.matches && base.matches('[data-nx-picker]')) return sincronizar(base);
      sincronizarTodos(base);
    }
  };
})();

