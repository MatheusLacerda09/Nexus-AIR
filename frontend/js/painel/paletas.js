const NEXUS_ACCENT_KEY = 'nexusAccentGlobal1';

const NEXUS_ACCENTS = new Set(['violet', 'ocean', 'emerald', 'sunset', 'rose']);

function aplicarCorDeDestaque(cor, persistir = true) {
  const valor = NEXUS_ACCENTS.has(cor) ? cor : 'violet';
  document.documentElement.setAttribute('data-accent', valor);
  if (persistir) {
    try {
      localStorage.setItem(NEXUS_ACCENT_KEY, valor);
    } catch (e) {}
  }
  document
    .querySelectorAll('[data-accent-choice]')
    .forEach(botao => botao.classList.toggle('is-active', botao.dataset.accentChoice === valor));
  const status = document.getElementById('paletteLiveStatus');
  if (status) status.innerHTML = '<i></i> Aplicada agora';
  document.dispatchEvent(new CustomEvent('paletaAlterada', { detail: { paleta: valor } }));
}

function initPersonalizacaoPerfil() {
  let salvo = document.documentElement.dataset.theme === 'dark' ? 'sunset' : 'violet';
  try {
    salvo = localStorage.getItem(NEXUS_ACCENT_KEY) || salvo;
  } catch (e) {}
  aplicarCorDeDestaque(salvo, false);
  document.querySelectorAll('[data-accent-choice]').forEach(botao =>
    botao.addEventListener('click', () => {
      aplicarCorDeDestaque(botao.dataset.accentChoice);
      mostrarToast('Cor do painel atualizada.', 'chimeSuccess');
    })
  );
  document.querySelectorAll('[data-theme-choice]').forEach(botao =>
    botao.addEventListener('click', () => {
      window.NexusSetTheme?.(botao.dataset.themeChoice);
      mostrarToast(
        `Tema ${botao.dataset.themeChoice === 'dark' ? 'escuro' : 'claro'} aplicado.`,
        'chimeSuccess'
      );
    })
  );
  document.addEventListener('temaAlterado', () => {
    const tema =
      typeof obterTemaAtual === 'function'
        ? obterTemaAtual()
        : document.documentElement.dataset.theme === 'dark'
          ? 'dark'
          : 'light';
    document
      .querySelectorAll('[data-theme-choice]')
      .forEach(botao => botao.classList.toggle('is-active', botao.dataset.themeChoice === tema));
  });
  const temaAtual = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  document
    .querySelectorAll('[data-theme-choice]')
    .forEach(botao => botao.classList.toggle('is-active', botao.dataset.themeChoice === temaAtual));
}
