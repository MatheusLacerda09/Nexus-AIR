(() => {
  const SELETOR = 'select:not([multiple]):not([data-nx-skip]):not(.maquina-select-nativo):not([size])';
  const SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const IC = (d, w = 1.7) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  // <option data-icon="linux" data-desc="texto">: mostra um ícone e uma linha de apoio. Sem os atributos, nada muda.
  const ICONES = {
    linux: IC('<rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path d="M7 7.25h.01M7 16.75h.01M11 7.25h6M11 16.75h6"/>', 1.6),
    windows: IC('<rect x="3" y="3.5" width="18" height="13" rx="2.4"/><path d="M12 3.5v13M3 10h18" opacity=".55"/><path d="M8.5 20.5h7M12 16.5v4"/>'),
    banco: IC('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>', 1.6),
    outro: IC('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>', 1.6),
    api: IC('<path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/>', 1.6),
    sql: IC('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>', 1.6),
    user: IC('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.6-3.7 3.6-5.8 7.5-5.8s6.9 2.1 7.5 5.8"/>', 1.7),
    badge: IC('<rect x="4" y="3.5" width="16" height="17" rx="3"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17c.5-1.9 2-2.9 4-2.9s3.5 1 4 2.9"/>', 1.7),
    code: IC('<path d="m8 8-4.5 4L8 16M16 8l4.5 4L16 16M13.5 5l-3 14"/>', 1.7),
    planilha: IC('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 13h8M8 17h8M11 10v10"/>', 1.6)
  };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const descValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const descIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  let fecharOutros = () => {};

  function melhorar(sel) {
    if (sel.dataset.cxSel) return;
    sel.dataset.cxSel = '1';

    const caixa = document.createElement('div');
    caixa.className = 'cx-sel';
    sel.parentNode.insertBefore(caixa, sel);
    caixa.appendChild(sel);
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    const rotulo = sel.getAttribute('aria-label') ||
      (sel.id && document.querySelector(`label[for="${CSS.escape(sel.id)}"]`)?.textContent.trim()) || '';
    const gat = document.createElement('button');
    gat.type = 'button';
    gat.className = 'cx-sel-btn';
    gat.setAttribute('aria-haspopup', 'listbox');
    gat.setAttribute('aria-expanded', 'false');
    if (rotulo) gat.setAttribute('aria-label', rotulo);
    const lista = document.createElement('ul');
    lista.className = 'cx-sel-lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;
    caixa.append(gat, lista);

    const opcao = (o, i = 0) => {
      const ativa = o.value === sel.value && !o.disabled;
      const ico = ICONES[o.dataset.icon] ? `<i class="cx-sel-ico cx-sel-ico--${esc(o.dataset.icon)}">${ICONES[o.dataset.icon]}</i>` : '';
      const texto = o.dataset.desc
        ? `<span class="cx-sel-txt"><b>${esc(o.textContent)}</b><small>${esc(o.dataset.desc)}</small></span>`
        : `<span>${esc(o.textContent)}</span>`;
      return `<li class="cx-sel-op${ativa ? ' is-ativa' : ''}${o.disabled ? ' is-desativada' : ''}${o.value === '' ? ' is-vazia' : ''}${ico ? ' tem-ico' : ''}" role="option" tabindex="-1"` +
        ` style="--i:${i}" data-valor="${esc(o.value)}" aria-selected="${ativa}"${o.disabled ? ' aria-disabled="true"' : ''}>${ico}${texto}${CHECK}</li>`;
    };
    const desenhar = () => {
      let html = '';
      let n_ = 0;
      [...sel.children].forEach((n) => {
        if (n.tagName === 'OPTGROUP') html += `<li class="cx-sel-grupo" role="presentation">${esc(n.label)}</li>` + [...n.children].map((o) => opcao(o, n_++)).join('');
        else if (n.tagName === 'OPTION') html += opcao(n, n_++);
      });
      lista.innerHTML = html || '<li class="cx-sel-grupo" role="presentation">Sem opções</li>';
      const atual = sel.selectedOptions[0];
      const icoAtual = atual && ICONES[atual.dataset.icon] ? `<i class="cx-sel-ico cx-sel-ico--${esc(atual.dataset.icon)}">${ICONES[atual.dataset.icon]}</i>` : '';
      const descAtual = atual && atual.value !== '' && atual.dataset.desc ? atual.dataset.desc : '';
      const rotuloAtual = descAtual
        ? `<span class="cx-sel-txt"><b>${esc(atual.textContent)}</b><small>${esc(descAtual)}</small></span>`
        : `<span>${esc(atual?.textContent || '')}</span>`;
      gat.innerHTML = `${icoAtual}${rotuloAtual}${SETA}`;
      gat.classList.toggle('tem-ico', Boolean(icoAtual));
      gat.classList.toggle('is-vazio', !atual || atual.value === '');
      gat.disabled = sel.disabled;
      caixa.classList.toggle('is-desativado', sel.disabled);
    };

    const fechar = (foco) => {
      if (lista.hidden) return;
      caixa.classList.remove('is-aberto', 'abre-cima');
      gat.setAttribute('aria-expanded', 'false');
      setTimeout(() => { if (!caixa.classList.contains('is-aberto')) lista.hidden = true; }, 160);
      if (foco) gat.focus({ preventScroll: true });
    };
    const abrir = () => {
      if (sel.disabled) return;
      fecharOutros(caixa);
      desenhar();
      lista.hidden = false;
      // Sem espaço embaixo? abre para cima.
      lista.style.maxHeight = '';
      const r = gat.getBoundingClientRect();
      const teto = Math.min(470, window.innerHeight * 0.62);
      const altura = Math.min(lista.scrollHeight, teto);
      const abaixo = window.innerHeight - r.bottom - 16;
      const acima = r.top - 16;
      const cima = abaixo < altura && acima > abaixo;
      caixa.classList.toggle('abre-cima', cima);
      // Sem espaço para a lista inteira? Ela encolhe e rola por dentro, em vez de ser cortada.
      if (sel.closest('.cx-form, .field-input')) lista.style.maxHeight = `${Math.round(Math.max(170, Math.min(teto, (cima ? acima : abaixo) - 6)))}px`;
      requestAnimationFrame(() => caixa.classList.add('is-aberto'));
      gat.setAttribute('aria-expanded', 'true');
      (lista.querySelector('.is-ativa') || lista.querySelector('.cx-sel-op:not(.is-desativada)'))?.focus({ preventScroll: true });
      lista.querySelector('.is-ativa')?.scrollIntoView({ block: 'nearest' });
    };
    const escolher = (v) => {
      if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      desenhar();
      fechar(true);
    };
    caixa._fechar = fechar;

    gat.addEventListener('click', () => (lista.hidden ? abrir() : fechar(false)));
    gat.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); if (lista.hidden) abrir(); }
    });
    lista.addEventListener('click', (e) => {
      const o = e.target.closest('.cx-sel-op');
      if (o && !o.classList.contains('is-desativada')) escolher(o.dataset.valor);
    });
    lista.addEventListener('keydown', (e) => {
      const ops = [...lista.querySelectorAll('.cx-sel-op:not(.is-desativada)')];
      const i = ops.indexOf(document.activeElement);
      const ir = (n) => { if (ops.length) ops[(n + ops.length) % ops.length].focus({ preventScroll: false }); };
      if (e.key === 'ArrowDown') { e.preventDefault(); ir(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ir(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); ir(0); }
      else if (e.key === 'End') { e.preventDefault(); ir(ops.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) escolher(ops[i].dataset.valor); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(true); }
      else if (e.key === 'Tab') fechar(false);
      else if (e.key.length === 1) {
        const achou = ops.find((o, k) => k > i && o.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase())) ||
          ops.find((o) => o.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
        achou?.focus();
      }
    });

    // Mudanças feitas por código também atualizam o visual.
    Object.defineProperty(sel, 'value', { configurable: true, get() { return descValue.get.call(this); }, set(v) { descValue.set.call(this, v); desenhar(); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return descIndex.get.call(this); }, set(v) { descIndex.set.call(this, v); desenhar(); } });
    new MutationObserver(desenhar).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label'] });
    sel.addEventListener('change', desenhar);
    sel.form?.addEventListener('reset', () => setTimeout(desenhar));
    desenhar();
  }

  fecharOutros = (exceto) => document.querySelectorAll('.cx-sel.is-aberto').forEach((c) => { if (c !== exceto) c._fechar?.(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.cx-sel')) fecharOutros(null); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharOutros(null); });

  const varrer = (raiz) => {
    if (raiz.matches?.(SELETOR)) melhorar(raiz);
    raiz.querySelectorAll?.(SELETOR).forEach(melhorar);
  };
  const iniciar = () => {
    varrer(document);
    // Observa o <html>, não o <body>: o roteador troca o body inteiro ao ir de /entrar para o painel,
    // e um observer preso ao body antigo deixava os selects novos com a lista nativa do navegador.
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) varrer(n); })))
      .observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('nexusRotaAlterada', () => varrer(document));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

