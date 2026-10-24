(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(url, options = {}) {
    const r = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (body.errors && body.errors.join(' ')) || body.message || 'Não foi possível concluir a operação.';
      throw new Error(msg);
    }
    return body;
  }

  const form = () => $('#agForm');
  let fuso = 'America/Sao_Paulo';
  let secoesRenderizadas = false;

  function feedback(msg, erro = false) {
    const el = $('#agFeedback');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', erro);
    el.classList.toggle('is-success', !erro && !!msg);
  }

  const fmt = (iso) => (iso
    ? new Date(iso).toLocaleString('pt-BR', { timeZone: fuso, dateStyle: 'short', timeStyle: 'short' })
    : '—');

  // ---------- Formulário ----------
  const modo = () => (form().elements.modo.value === 'agora' ? 'agora' : 'agendar');
  const repetir = () => modo() === 'agendar' && !form().elements.so_uma_vez.checked;

  function coletar() {
    const fd = new FormData(form());
    return {
      nome: fd.get('nome'),
      maquina_id: fd.get('maquina_id'),
      instancia: String((bancoEscolhido() && bancoEscolhido().instancia) || $('#agSid').value || '').trim().toUpperCase(),
      usuario_banco: String(fd.get('usuario_banco') || '').trim(),
      senha_banco: fd.get('senha_banco'),
      destinatarios: fd.get('destinatarios'),
      executar_agora: modo() === 'agora',
      frequencia: repetir() ? fd.get('frequencia') : 'unica',
      hora: fd.get('hora'),
      dias_semana: fd.getAll('dias_semana').map(Number),
      intervalo_dias: fd.get('intervalo_dias'),
      data_inicio: fd.get('data_inicio') || undefined,
      dia_mes: fd.get('dia_mes'),
      secoes: fd.getAll('secoes').map(Number),
      assunto: fd.get('assunto'),
      mensagem: fd.get('mensagem'),
    };
  }

  function mostrarCamposDaFrequencia() {
    const freq = $('#agFrequencia').value;
    form().querySelectorAll('[data-freq]').forEach((el) => { el.hidden = el.dataset.freq !== freq; });
    const agendar = modo() === 'agendar';
    form().querySelectorAll('[data-modo="agendar"]').forEach((el) => { el.hidden = !agendar; });
    $('#agRepetir').hidden = !repetir();
    $('#agEnviar').textContent = agendar ? 'Agendar relatório' : 'Gerar relatório agora';
  }

  function valoresIniciais() {
    // Data de hoje e próxima hora cheia, no fuso do relatório.
    const f = form().elements;
    f.data_inicio.value = new Date().toLocaleDateString('en-CA', { timeZone: fuso });
    const h = (Number(new Date().toLocaleString('en-GB', { timeZone: fuso, hour: '2-digit', hour12: false })) + 1) % 24;
    f.hora.value = `${String(h).padStart(2, '0')}:00`;
    // Não dá para agendar no passado: o calendário desativa os dias anteriores a hoje.
    f.data_inicio.dataset.min = f.data_inicio.value;
    window.NexusPicker?.sync(form());
  }

  let timerPrevia;
  function pedirPrevia() {
    clearTimeout(timerPrevia);
    timerPrevia = setTimeout(async () => {
      const el = $('#agPrevia');
      if (!el) return;
      if (modo() === 'agora') {
        el.className = 'ag-previa';
        el.innerHTML = '<strong>Uma vez, agora.</strong><br>O relatório é gerado no próximo ciclo do coletor (até 1 minuto).';
        return;
      }
      try {
        const d = coletar();
        const b = await api('/api/agendamentos/previa', { method: 'POST', body: JSON.stringify({
          frequencia: d.frequencia, hora: d.hora, dias_semana: d.dias_semana,
          intervalo_dias: d.intervalo_dias, data_inicio: d.data_inicio, dia_mes: d.dia_mes }) });
        if (b.errors && b.errors.length) {
          el.className = 'ag-previa is-aviso';
          el.textContent = b.errors[0];
        } else if (d.frequencia === 'unica') {
          el.className = 'ag-previa';
          el.innerHTML = `<strong>${esc(b.descricao)}.</strong><br>O relatório é gerado uma única vez.`;
        } else {
          el.className = 'ag-previa';
          el.innerHTML = `<strong>${esc(b.descricao)}.</strong><br>Próximos envios: ${b.proximas.map(esc).join(' &nbsp;|&nbsp; ')}`;
        }
      } catch (e) {
        el.className = 'ag-previa is-aviso';
        el.textContent = '';
      }
    }, 250);
  }

  // ---------- Bancos (vêm de "Conectores de Dados") ----------
  let bancos = [];
  const bancoEscolhido = () => bancos.find((b) => b.id === $('#agInstancia').value) || null;

  function renderBancos(selecionar) {
    const sel = $('#agInstancia');
    if (!sel) return;
    const atual = selecionar || sel.value;
    sel.innerHTML = '<option value="">Selecione o banco</option>' + bancos.map((b) =>
      `<option value="${esc(b.id)}">${esc(b.instancia ? `${b.nome} (${b.instancia})` : b.nome)}</option>`).join('');
    if (atual && bancos.some((b) => b.id === atual)) sel.value = atual;
    $('#agBancoVazio').hidden = bancos.length > 0;
    sel.disabled = bancos.length === 0;
    mostrarSid();
  }

  // Banco sem SID: pede o SID aqui mesmo (é salvo na máquina ao agendar).
  function mostrarSid() {
    const b = bancoEscolhido();
    $('#agSidBox').hidden = !(b && !b.instancia);
  }

  function renderSecoes(secoes) {
    const box = $('#agSecoes');
    if (!box || secoesRenderizadas) return;
    box.innerHTML = secoes.map((s) =>
      `<label class="ag-check"><input type="checkbox" name="secoes" value="${s.id}" checked><span>${esc(s.nome)}</span></label>`).join('');
    secoesRenderizadas = true;
  }

  // ---------- Tabela ----------
  function chipUltimo(a) {
    if (a.status === 'executando') return `<span class="automation-status is-run">${a.etapa === 'gerando_pdf' ? 'Gerando PDF…' : 'Coletando dados…'}</span>`;
    if (!a.ultima_execucao) return '<span class="ag-sub">Ainda não enviado</span>';
    const ok = a.ultimo_status === 'sucesso';
    const detalhe = a.ultimo_detalhe ? ` title="${esc(a.ultimo_detalhe)}"` : '';
    return `<span class="automation-status ${ok ? 'is-ok' : 'is-falha'}"${detalhe}>${ok ? 'Enviado' : 'Falhou'}</span><span class="ag-sub">${esc(fmt(a.ultima_execucao))}</span>`;
  }

  function linha(a) {
    const proximo = a.ativo ? esc(fmt(a.proxima_execucao))
      : (a.frequencia === 'unica' && a.ultima_execucao ? '<span class="ag-sub">Concluído</span>' : '<span class="ag-sub">Pausado</span>');
    return `<tr>
      <td><strong>${esc(a.nome)}</strong><span class="ag-sub">${esc(a.instancia)} → ${esc((a.destinatarios || []).join(', '))}</span><span class="ag-sub">${a.secoes.length} seç${a.secoes.length === 1 ? 'ão' : 'ões'}</span></td>
      <td>${esc(a.descricao_frequencia)}</td>
      <td>${proximo}</td>
      <td>${chipUltimo(a)}</td>
      <td><div class="ag-acoes">
        <button type="button" data-ag-agora="${a.id}">Enviar agora</button>
        ${a.frequencia === 'unica' && !a.ativo ? '' : `<button type="button" data-ag-alternar="${a.id}" data-ativo="${a.ativo ? '1' : '0'}">${a.ativo ? 'Pausar' : 'Ativar'}</button>`}
        <button type="button" data-ag-excluir="${a.id}">Excluir</button>
      </div></td></tr>`;
  }

  async function carregar() {
    if (!form()) return;
    try {
      const b = await api('/api/agendamentos');
      fuso = b.fuso || fuso;
      renderSecoes(b.secoes || []);
      bancos = b.bancos || [];
      renderBancos();
      $('#agBody').innerHTML = (b.itens || []).map(linha).join('');
      $('#agVazio').toggleAttribute('hidden', (b.itens || []).length > 0);
      const st = $('#fxStatAg'); if (st) st.textContent = (b.itens || []).filter((a) => a.ativo).length;
    } catch (e) {
      // sem sessão ou rota indisponível: a tabela só fica vazia
    }
  }

  // ---------- Eventos ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (!form()) return;
    valoresIniciais();
    mostrarCamposDaFrequencia();
    carregar().then(pedirPrevia);
  });

  document.addEventListener('change', (e) => {
    if (!e.target.closest || !e.target.closest('#agForm')) return;
    if (e.target.id === 'agInstancia') mostrarSid();
    if (e.target.id === 'agFrequencia' || ['modo', 'so_uma_vez'].includes(e.target.name)) mostrarCamposDaFrequencia();
    if (['modo', 'so_uma_vez', 'frequencia', 'hora', 'dias_semana', 'intervalo_dias', 'data_inicio', 'dia_mes'].includes(e.target.name)) pedirPrevia();
  });
  document.addEventListener('input', (e) => {
    if (e.target.closest && e.target.closest('#agForm') && ['hora', 'data_inicio', 'intervalo_dias', 'dia_mes'].includes(e.target.name)) pedirPrevia();
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'agForm') return;
    e.preventDefault();
    const botao = e.target.querySelector('button[type=submit]');
    botao.disabled = true;
    try {
      await api('/api/agendamentos', { method: 'POST', body: JSON.stringify(coletar()) });
      const banco = e.target.elements.maquina_id.value;
      const usuario = e.target.elements.usuario_banco.value;
      const foiAgora = modo() === 'agora';
      e.target.reset();
      renderBancos(banco);
      e.target.elements.usuario_banco.value = usuario;  // a senha nunca fica na tela
      valoresIniciais();
      mostrarCamposDaFrequencia();
      pedirPrevia();
      feedback(foiAgora ? 'Relatório solicitado. O coletor o gera em até 1 minuto.' : 'Relatório agendado.');
      carregar();
    } catch (x) {
      feedback(x.message, true);
    } finally {
      botao.disabled = false;
    }
  });

  document.addEventListener('click', async (e) => {
    const agora = e.target.closest('[data-ag-agora]');
    const alternar = e.target.closest('[data-ag-alternar]');
    const excluir = e.target.closest('[data-ag-excluir]');
    if (e.target.closest('#agIrConectores')) { document.querySelector('.nav-item[data-view="conectores"]')?.click(); return; }
    try {
      if (agora) {
        const b = await api(`/api/agendamentos/${agora.dataset.agAgora}/executar-agora`, { method: 'POST' });
        feedback(b.message);
        carregar();
      } else if (alternar) {
        await api(`/api/agendamentos/${alternar.dataset.agAlternar}`, {
          method: 'PATCH', body: JSON.stringify({ ativo: alternar.dataset.ativo !== '1' }) });
        carregar();
      } else if (excluir && confirm('Excluir este agendamento? Os envios futuros deixam de acontecer.')) {
        await api(`/api/agendamentos/${excluir.dataset.agExcluir}`, { method: 'DELETE' });
        carregar();
      }
    } catch (x) {
      feedback(x.message, true);
    }
  });

  document.addEventListener('nexusRotaAlterada', () => { if (form()) carregar(); });
  document.addEventListener('usuarioAutenticado', () => { if (form()) carregar(); });
  document.addEventListener('nexusMaquinasAtualizadas', () => { if (form()) carregar(); });
  // Atualiza o status ("Gerando…", "Enviado") enquanto a tela está aberta.
  setInterval(() => {
    const view = $('#view-orquestrador');
    if (view && view.classList.contains('active') && !document.hidden) carregar();
  }, 15000);
})();
