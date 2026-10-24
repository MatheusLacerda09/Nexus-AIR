function ehMobile() {
  return window.innerWidth <= 900;
}

function fecharSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('burgerBtn');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.remove('mobile-open');
  if (burger) burger.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('burgerBtn');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !burger) return;
  sidebar.classList.add('collapsed');
  if (ehMobile()) sidebar.classList.remove('mobile-open');
  burger.classList.remove('open');
  burger.setAttribute('aria-label', 'Abrir menu lateral');
  burger.setAttribute('aria-expanded', 'false');

  burger.addEventListener('click', () => {
    if (ehMobile()) {
      const abrindo = !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', abrindo);
      burger.classList.toggle('open', abrindo);
      burger.setAttribute('aria-label', abrindo ? 'Fechar menu lateral' : 'Abrir menu lateral');
      burger.setAttribute('aria-expanded', String(abrindo));
      if (overlay) overlay.classList.toggle('show', abrindo);
    } else {
      const fechando = !sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed', fechando);
      burger.classList.toggle('open', !fechando);
      burger.setAttribute('aria-label', fechando ? 'Abrir menu lateral' : 'Fechar menu lateral');
      burger.setAttribute('aria-expanded', String(!fechando));
    }
    setTimeout(posicionarHighlight, 400);
  });

  if (overlay) {
    overlay.addEventListener('click', fecharSidebarMobile);
  }

  window.addEventListener('resize', () => {
    if (!ehMobile()) {
      fecharSidebarMobile();
    }
  });
}

function posicionarHighlight() {
  const ativo = document.querySelector('.nav-item.active');
  const highlight = document.getElementById('navHighlight');
  if (!ativo || !highlight) return;
  highlight.style.top = ativo.offsetTop + 'px';
  highlight.style.height = ativo.offsetHeight + 'px';
}

function initNavegacao() {
  const itens = document.querySelectorAll('.nav-item');
  const DURACAO = 260;

  itens.forEach(item => {
    item.addEventListener('click', () => {
      const alvo = item.dataset.view;
      const viewAlvo = document.getElementById(`view-${alvo}`);

      if (ehMobile()) fecharSidebarMobile();

      if (!viewAlvo || viewAlvo.classList.contains('active')) return;

      itens.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      posicionarHighlight();

      if (alvo === 'usuarios') {
        carregarUsuarios();
      }

      if (alvo === 'relatorios') {
        carregarRelatorioSuporte(document.getElementById('relatorioIdSuporte').value.trim());
      }

      const viewAtual = document.querySelector('.view.active');

      if (viewAtual) {
        viewAtual.classList.remove('show');
        setTimeout(() => {
          viewAtual.classList.remove('active');
          mostrarView(viewAlvo);
        }, DURACAO);
      } else {
        mostrarView(viewAlvo);
      }
    });
  });

  function mostrarView(view) {
    view.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => view.classList.add('show'));
    });
  }

  window.NexusMostrarView = alvo => {
    const viewAlvo = document.getElementById(`view-${alvo}`);
    const viewAtual = document.querySelector('.view.active');
    if (!viewAlvo || viewAlvo === viewAtual) return;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const item = document.querySelector(`.nav-item[data-view="${alvo}"]`);
    if (item) {
      item.classList.add('active');
      posicionarHighlight();
    }
    const topbarTitle = document.getElementById('topbarViewTitle');
    if (topbarTitle)
      topbarTitle.textContent =
        item?.querySelector('.nav-label')?.textContent || (alvo === 'perfil' ? 'Meu usuário' : 'Visão geral');
    const highlight = document.getElementById('navHighlight');
    if (highlight) highlight.style.opacity = item ? '1' : '0';
    if (viewAtual) {
      viewAtual.classList.remove('show');
      setTimeout(() => {
        viewAtual.classList.remove('active');
        mostrarView(viewAlvo);
      }, DURACAO);
    } else mostrarView(viewAlvo);
  };

  const inicial = document.querySelector('.view.active');
  if (inicial) requestAnimationFrame(() => inicial.classList.add('show'));

  posicionarHighlight();
  window.addEventListener('resize', posicionarHighlight);
}
