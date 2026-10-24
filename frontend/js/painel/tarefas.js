function statusClassFor(status) {
  if (status === 'Em Execução') return 'status-Execucao';
  if (status === 'Parado') return 'status-Parado';
  return 'status-Concluido';
}

function renderTabela() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  tarefas.forEach(t => {
    const row = document.createElement('tr');
    row.dataset.id = t.id;

    let botaoAcao;
    if (t.status === 'Em Execução') {
      botaoAcao = `<button class="action-icon spin" title="Parar processo" data-action="stop"><svg class="ic"><use href="#ic-loader"/></svg></button>`;
    } else if (t.status === 'Parado') {
      botaoAcao = `<button class="action-icon" title="Retomar processo" data-action="start"><svg class="ic ic-solid"><use href="#ic-play"/></svg></button>`;
    } else {
      botaoAcao = `<button class="action-icon" title="Excluir" data-action="delete"><svg class="ic"><use href="#ic-trash"/></svg></button>`;
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

function iniciarProcesso(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;

  tarefa.status = 'Em Execução';
  renderTabela();
  mostrarToast(`Processando ${id}...`, 'loadingStart');

  timersAtivos[id] = setTimeout(() => {
    const t = tarefas.find(t => t.id === id);
    if (t && t.status === 'Em Execução') {
      t.status = 'Concluído';
      renderTabela();
      mostrarToast(`${id} concluído com sucesso!`, 'loadingEndSuccess');
      adicionarNotificacao(`Relatório ${id} concluído com sucesso.`);
    }
    delete timersAtivos[id];
  }, 4000);
}

function pararProcesso(id) {
  clearTimeout(timersAtivos[id]);
  delete timersAtivos[id];

  const tarefa = tarefas.find(t => t.id === id);
  if (tarefa) {
    tarefa.status = 'Parado';
    renderTabela();
    mostrarToast(`Processo ${id} interrompido.`, 'loadingEndFail');
    adicionarNotificacao(`Processo ${id} foi interrompido manualmente.`);
  }
}

function initTabelaEventos() {
  const tbody = document.getElementById('tableBody');
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.action-icon');
    if (!btn) return;

    const row = btn.closest('tr');
    const id = row.dataset.id;
    const acao = btn.dataset.action;

    if (acao === 'delete') {
      tarefas = tarefas.filter(t => t.id !== id);
      renderTabela();
      mostrarToast(`Relatório ${id} removido.`);
    }

    if (acao === 'stop') {
      pararProcesso(id);
    }

    if (acao === 'start') {
      iniciarProcesso(id);
    }
  });
}

function initDateRange() {
  const dateRange = document.getElementById('dateRange');
  dateRange.addEventListener('click', () => {
    const inicio = prompt('Data inicial (AAAA-MM-DD):', '2026-01-01');
    if (inicio === null) return;
    const fim = prompt('Data final (AAAA-MM-DD):', '2026-12-31');
    if (fim === null) return;
    dateRange.innerHTML = `<svg class="ic"><use href="#ic-calendar"/></svg> ${inicio} &nbsp;~&nbsp; ${fim}`;
    mostrarToast('Período atualizado.');
  });
}
