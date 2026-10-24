function gerarEmailCorporativo() {
  const nome = document.getElementById('usuarioNome')?.value || '';
  const campoEmail = document.getElementById('usuarioEmail');
  if (!campoEmail || !dominioEmpresaLogada) return;
  const parteNome = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  if (!parteNome) return;
  campoEmail.value = `${parteNome}@${dominioEmpresaLogada}`;
}

let usuarioEditandoId = null;

function abrirModalUsuario(usuario) {
  const overlay = document.getElementById('usuarioModalOverlay');
  const alerta = document.getElementById('usuarioModalAlert');
  alerta.hidden = true;

  usuarioEditandoId = usuario ? usuario.id : null;
  document.getElementById('usuarioModalTitulo').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
  document.getElementById('usuarioId').value = usuario ? usuario.id : '';
  document.getElementById('usuarioNome').value = usuario ? usuario.nome || '' : '';
  document.getElementById('usuarioEmail').value = usuario ? usuario.email || '' : '';
  document.getElementById('usuarioCargo').value = usuario ? usuario.cargo || '' : '';
  document.getElementById('usuarioDepartamento').value = usuario ? usuario.departamento || '' : '';
  document.getElementById('usuarioTipoAcesso').value = usuario ? usuario.tipo_acesso || 'padrao' : 'padrao';
  document.getElementById('usuarioDataNascimento').value = usuario
    ? String(usuario.data_nascimento || '').slice(0, 10)
    : '';
  document.getElementById('usuarioSenha').value = '';
  document.getElementById('usuarioSenha').required = !usuario;
  document.getElementById('usuarioSenhaHint').hidden = !usuario;

  overlay.classList.add('show');
}

function fecharModalUsuario() {
  document.getElementById('usuarioModalOverlay').classList.remove('show');
  usuarioEditandoId = null;
}

function mostrarAlertaModal(mensagem) {
  const alerta = document.getElementById('usuarioModalAlert');
  alerta.textContent = mensagem;
  alerta.className = 'form-alert form-alert-error';
  alerta.hidden = false;
}

function renderUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTableBody');
  const vazio = document.getElementById('usuariosVazio');
  tbody.innerHTML = '';

  if (!usuarios || usuarios.length === 0) {
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  usuarios.forEach(u => {
    const row = document.createElement('tr');
    const acesso = u.tipo_acesso === 'admin' ? 'Administrador' : 'Padrão';
    row.innerHTML = `
      <td class="tarefa-cell">${u.nome}</td>
      <td>${u.email}</td>
      <td>${u.cargo || '—'}</td>
      <td>${u.departamento || '—'}</td>
      <td><span class="status-badge ${u.tipo_acesso === 'admin' ? 'status-Execucao' : 'status-Concluido'}">${acesso}</span></td>
      <td>
        <button class="action-icon" title="Editar" data-action="editar" data-id="${u.id}"><svg class="ic"><use href="#ic-edit"/></svg></button>
        <button class="action-icon" title="Excluir" data-action="excluir" data-id="${u.id}"><svg class="ic"><use href="#ic-trash"/></svg></button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function carregarUsuarios() {
  try {
    const resposta = await fetch('/api/usuarios', { credentials: 'same-origin', cache: 'no-store' });
    const corpo = await resposta.json().catch(() => ({}));
    if (resposta.status === 403) {
      mostrarToast(corpo.message || 'Você não tem permissão para acessar os usuários.');
      return;
    }
    if (!resposta.ok) throw new Error('Falha ao carregar usuários.');
    renderUsuarios(corpo.data);
  } catch (erro) {
    mostrarToast('Não foi possível carregar os usuários.');
  }
}

async function salvarUsuario(dados, id) {
  const url = id ? `/api/usuarios/${id}` : '/api/usuarios';
  const metodo = id ? 'PUT' : 'POST';

  const resposta = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(dados)
  });
  const corpo = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok, corpo };
}

async function excluirUsuario(id) {
  const resposta = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', credentials: 'same-origin' });
  return resposta.ok;
}

function initUsuariosCRUD() {
  document.getElementById('novoUsuarioBtn').addEventListener('click', () => abrirModalUsuario(null));
  document.getElementById('gerarEmailCorporativoBtn').addEventListener('click', gerarEmailCorporativo);
  document.getElementById('usuarioModalClose').addEventListener('click', fecharModalUsuario);
  document.getElementById('usuarioCancelarBtn').addEventListener('click', fecharModalUsuario);
  document.getElementById('usuarioModalOverlay').addEventListener('click', e => {
    if (e.target.id === 'usuarioModalOverlay') fecharModalUsuario();
  });

  document.getElementById('usuarioForm').addEventListener('submit', async e => {
    e.preventDefault();

    const dados = {
      nome: document.getElementById('usuarioNome').value.trim(),
      email: document.getElementById('usuarioEmail').value.trim(),
      cargo: document.getElementById('usuarioCargo').value.trim(),
      departamento: document.getElementById('usuarioDepartamento').value.trim(),
      tipo_acesso: document.getElementById('usuarioTipoAcesso').value,
      data_nascimento: document.getElementById('usuarioDataNascimento').value || null
    };
    const senha = document.getElementById('usuarioSenha').value;
    if (senha) dados.senha = senha;

    const botao = document.getElementById('usuarioSalvarBtn');
    const editando = usuarioEditandoId !== null;
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
      const { ok, corpo } = await salvarUsuario(dados, usuarioEditandoId);
      if (!ok) {
        mostrarAlertaModal(corpo.message || 'Não foi possível salvar o usuário.');
        return;
      }

      fecharModalUsuario();
      await carregarUsuarios();
      mostrarToast(editando ? 'Usuário editado com sucesso.' : 'Usuário criado com sucesso.');
    } catch (erro) {
      mostrarAlertaModal('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally {
      botao.disabled = false;
      botao.textContent = 'Salvar';
    }
  });

  document.getElementById('usuariosTableBody').addEventListener('click', async e => {
    const btn = e.target.closest('.action-icon');
    if (!btn) return;
    const id = btn.dataset.id;
    const acao = btn.dataset.action;

    if (acao === 'editar') {
      const resposta = await fetch(`/api/usuarios/${id}`, { credentials: 'same-origin' });
      if (!resposta.ok) {
        mostrarToast('Usuário não encontrado.');
        return;
      }
      const corpo = await resposta.json();
      abrirModalUsuario(corpo.data);
    }

    if (acao === 'excluir') {
      if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
      const ok = await excluirUsuario(id);
      if (ok) {
        mostrarToast('Usuário removido.');
        carregarUsuarios();
      } else {
        mostrarToast('Não foi possível remover o usuário.');
      }
    }
  });
}
