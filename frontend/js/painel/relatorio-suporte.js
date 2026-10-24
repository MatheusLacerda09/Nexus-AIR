const API_RELATORIO_SUPORTE_URL = '/api/alertas/relatorio-suporte';

function renderRelatorioSuporte(registros) {
  const tbody = document.getElementById('relatorioTableBody');
  const vazio = document.getElementById('relatorioVazio');
  tbody.innerHTML = '';

  if (!registros || registros.length === 0) {
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  registros.forEach(r => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="tarefa-cell">${r.nome_empresa ?? '—'}</td>
      <td>${r.tipo_alerta ?? '—'}</td>
      <td>${r.resolucao_alerta ?? '—'}</td>
      <td>${r.maquina_afetada ?? '—'}</td>
      <td>${r.agente_suporte ?? '—'}</td>
      <td>${r.suporte_departamento ?? '—'}</td>
      <td>${formatarHorarioAlerta(r.horario_suporte)}</td>
    `;
    tbody.appendChild(row);
  });
}

async function carregarRelatorioSuporte(idSuporte) {
  try {
    const url = idSuporte
      ? `${API_RELATORIO_SUPORTE_URL}?id_suporte=${encodeURIComponent(idSuporte)}`
      : API_RELATORIO_SUPORTE_URL;
    const resposta = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!resposta.ok) throw new Error('Falha ao carregar relatório de suporte.');
    const corpo = await resposta.json();
    renderRelatorioSuporte(corpo);
  } catch (erro) {
    mostrarToast('Não foi possível carregar o relatório de suporte.');
  }
}

function initRelatorioSuporte() {
  const filtrarBtn = document.getElementById('relatorioFiltrarBtn');
  const limparBtn = document.getElementById('relatorioLimparBtn');
  const input = document.getElementById('relatorioIdSuporte');

  filtrarBtn.addEventListener('click', () => carregarRelatorioSuporte(input.value.trim()));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') carregarRelatorioSuporte(input.value.trim());
  });
  limparBtn.addEventListener('click', () => {
    input.value = '';
    carregarRelatorioSuporte(null);
  });
}
