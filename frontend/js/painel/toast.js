function mostrarToast(msg, tipoSom) {
  const somJaExecutado = Boolean(window.NexusSoundToastMuted);
  window.NexusSoundToastMuted = false;
  if (window.NexusSons && !somJaExecutado) {
    const texto = String(msg || '').toLowerCase();
    if (tipoSom) window.NexusSons.play(tipoSom);
    else if (/falha|não foi|nao foi|erro|removido|exclu/i.test(texto)) window.NexusSons.playError();
    else window.NexusSons.play('chimeSuccess');
  }
  let toast = document.getElementById('toast');
  if (!toast) {
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
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}
