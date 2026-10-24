function fecharPainelFlutuante(id, motivo = 'normal') {
  const painel = document.getElementById(id);
  if (!painel) return Promise.resolve();
  painel.classList.remove('show');
  painel.classList.toggle('closing-outside', motivo === 'outside');
  painel.classList.add('closing');
  return new Promise(resolve => {
    let finalizado = false;
    const remover = () => {
      if (finalizado) return;
      finalizado = true;
      painel.remove();
      resolve();
    };
    painel.addEventListener('transitionend', remover, { once: true });
    setTimeout(remover, 170);
  });
}

async function fecharOutrosPaineis(idAtual) {
  const ids = ['nexusSearchPanel', 'nexusHelpPanel', 'notifDropdown', 'userDropdown'].filter(
    id => id !== idAtual
  );
  await Promise.all(
    ids.map(id => {
      const painel = document.getElementById(id);
      if (!painel) return Promise.resolve();
      if (id === 'notifDropdown' || id === 'userDropdown') {
        painel.classList.remove('show');
        return Promise.resolve();
      }
      return fecharPainelFlutuante(id);
    })
  );
}

function isolarDropdownsDaTopbar() {
  ['notifDropdown', 'userDropdown'].forEach(id => {
    const painel = document.getElementById(id);
    if (painel && painel.closest('.topbar')) document.body.appendChild(painel);
  });
}
