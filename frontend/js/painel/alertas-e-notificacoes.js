function renderAlertas() {
  const alertsList = document.getElementById('alertsList');
  alertsList.innerHTML = '';

  if (notificacoes.length === 0) {
    alertsList.innerHTML = `<div class="alert-text" style="color:var(--text-muted);font-weight:500;">Nenhum alerta no momento.</div>`;
    return;
  }

  notificacoes.forEach(a => {
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `<div class="alert-icon"><svg class="ic"><use href="#ic-alert-triangle"/></svg></div><div class="alert-text">${a}</div>`;
    alertsList.appendChild(div);
  });
}

function renderNotificacoes(destacar) {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');

  badge.textContent = notificacoes.length;
  badge.classList.toggle('empty', notificacoes.length === 0);
  if (destacar) {
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }

  list.innerHTML = '';
  if (notificacoes.length === 0) {
    list.innerHTML = `<div class="notif-empty">Nenhuma notificação no momento.</div>`;
    return;
  }
  notificacoes.forEach(a => {
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `<div class="alert-icon"><svg class="ic"><use href="#ic-alert-triangle"/></svg></div><div class="alert-text">${a}</div>`;
    list.appendChild(div);
  });
}

function adicionarNotificacao(texto) {
  notificacoes.unshift(texto);
  renderAlertas();
  renderNotificacoes(true);
}

document.addEventListener('nexusIdiomaAlterado', () => {
  if (document.getElementById('notifList')) renderNotificacoes(false);
});

function initNotificacoes() {
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  notifBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const estavaAberto = notifDropdown.classList.contains('show');

    await fecharOutrosPaineis('notifDropdown');
    notifDropdown.classList.toggle('show', !estavaAberto);
  });

  document.addEventListener('click', e => {
    if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
      notifDropdown.classList.remove('show');
    }
  });
}

let alertasApiDisponivel = false;

function formatarHorarioAlerta(horarioBruto) {
  if (!horarioBruto) return '';
  const data = new Date(horarioBruto);
  if (isNaN(data.getTime())) return String(horarioBruto);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function buscarAlertasReais() {
  if (document.hidden) return;
  try {
    const resposta = await fetch(API_ALERTAS_URL, { cache: 'no-store', credentials: 'same-origin' });
    if (!resposta.ok) throw new Error('offline');
    const corpo = await resposta.json();
    const alertasApi = corpo.alertas || [];

    alertasApiDisponivel = true;
    notificacoes = alertasApi.map(a => {
      const hora = formatarHorarioAlerta(a.horario);
      return `${a.tipo_alerta} em ${a.maquina_hostname} (${a.status_alerta}) ${hora}`;
    });

    renderAlertas();
    renderNotificacoes(false);
  } catch (erro) {
    if (!alertasApiDisponivel) {
      renderAlertas();
      renderNotificacoes(false);
    }
  }
}
