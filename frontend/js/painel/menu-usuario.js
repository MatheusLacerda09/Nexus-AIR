function abrirPerfilUsuario() {
  document.getElementById('userDropdown')?.classList.remove('show');
  const titulo = document.getElementById('topbarViewTitle');
  if (titulo) titulo.textContent = window.NexusTraducao?.('profileTitle') || 'Meu usuário';
  window.NexusMostrarView?.('perfil');
}

function initMenuUsuario() {
  const btn = document.getElementById('userChipBtn');
  const dropdown = document.getElementById('userDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  const profileBtn = document.getElementById('userProfileBtn');

  btn.addEventListener('click', async e => {
    e.stopPropagation();
    const estavaAberto = dropdown.classList.contains('show');

    await fecharOutrosPaineis('userDropdown');
    dropdown.classList.toggle('show', !estavaAberto);
  });

  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('show');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
  });
  profileBtn?.addEventListener('click', abrirPerfilUsuario);
  document
    .getElementById('perfilVoltarBtn')
    ?.addEventListener('click', () => window.NexusMostrarView?.('dashboard'));
  initPersonalizacaoPerfil();
  const nameForm = document.getElementById('profileNameForm');
  let nomeStatusTimer = null;
  nameForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('perfilNomeInput');
    const status = document.getElementById('perfilNomeStatus');
    const botao = document.getElementById('perfilNomeBtn');
    const nome = input.value.trim();
    if (nome.length < 3) {
      status.textContent = 'Informe um nome com pelo menos 3 caracteres.';
      status.className = 'is-error';
      mostrarToast('Nome inválido.', 'chimeAlert');
      return;
    }
    const nomeAtual = String(
      usuarioAtual?.nome || document.getElementById('perfilNome')?.textContent || ''
    ).trim();
    const normalizarNome = valor => valor.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    if (nomeAtual && normalizarNome(nome) === normalizarNome(nomeAtual)) {
      status.textContent = 'O nome informado é igual ao nome atual.';
      status.className = 'is-warning';
      mostrarToast('O nome informado é igual ao nome atual.', 'chimeAlert');
      clearTimeout(nomeStatusTimer);
      nomeStatusTimer = setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 4000);
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    try {
      const resposta = await fetch('/api/auth/meu-perfil', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const corpo = await resposta.json();
      status.textContent =
        corpo.message || (resposta.ok ? 'Nome atualizado.' : 'Não foi possível atualizar o nome.');
      status.className = resposta.ok ? 'is-success' : 'is-error';
      if (resposta.ok) {
        usuarioAtual = corpo.usuario || usuarioAtual;
        document.getElementById('userChipNome').textContent = nome.split(' ')[0];
        document.getElementById('userDropdownNome').textContent = nome;
        document.getElementById('perfilNome').textContent = nome;
        mostrarToast('Nome atualizado com sucesso.', 'chimeSuccess');
      } else mostrarToast(corpo.message || 'Não foi possível atualizar o nome.', 'chimeAlert');
    } catch (e) {
      status.textContent = 'Não foi possível conectar ao servidor.';
      status.className = 'is-error';
      mostrarToast('Não foi possível atualizar o nome.', 'chimeAlert');
    }
    botao.disabled = false;
    botao.textContent = 'Salvar nome';
  });
  const photoForm = document.getElementById('profilePhotoForm');
  const photoInput = document.getElementById('perfilFotoInput');
  const photoButton = document.getElementById('perfilFotoBtn');
  const photoStatus = document.getElementById('perfilFotoStatus');
  let fotoEditada = null;
  photoInput?.addEventListener('change', () => {
    const arquivo = photoInput.files?.[0];
    if (!arquivo) return;
    fotoEditada = null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      photoStatus.textContent = 'Use uma imagem JPG, PNG ou WEBP.';
      photoStatus.className = 'is-error';
      photoInput.value = '';
      photoButton.disabled = true;
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      photoStatus.textContent = 'A foto deve ter no máximo 5 MB.';
      photoStatus.className = 'is-error';
      photoInput.value = '';
      photoButton.disabled = true;
      return;
    }
    abrirEditorFotoPerfil(arquivo, (foto, preview) => {
      fotoEditada = foto;
      photoStatus.textContent = 'Enquadramento pronto para aplicar.';
      photoStatus.className = '';
      photoButton.disabled = false;
      aplicarVisualFotoPerfil(preview);
    });
  });
  photoForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const arquivo = fotoEditada;
    if (!arquivo) return;
    photoButton.disabled = true;
    photoButton.textContent = 'Salvando...';
    const dados = new FormData();
    dados.append('foto', arquivo);
    try {
      const resposta = await fetch('/api/auth/minha-foto', {
        method: 'POST',
        credentials: 'same-origin',
        body: dados
      });
      const corpo = await resposta.json().catch(() => ({}));
      photoStatus.textContent =
        corpo.message || (resposta.ok ? 'Foto atualizada.' : 'Não foi possível salvar a foto.');
      photoStatus.className = resposta.ok ? 'is-success' : 'is-error';
      if (resposta.ok) {
        usuarioAtual = corpo.usuario || usuarioAtual;
        atualizarFotosUsuario(true);
        photoInput.value = '';
        fotoEditada = null;
        mostrarToast('Foto de perfil atualizada.', 'chimeSuccess');
        setTimeout(() => {
          photoStatus.textContent = '';
          photoStatus.className = '';
        }, 4500);
      } else photoButton.disabled = false;
    } catch (e) {
      photoStatus.textContent = 'Não foi possível conectar ao servidor.';
      photoStatus.className = 'is-error';
      photoButton.disabled = false;
    }
    photoButton.textContent = 'Salvar foto';
  });
  const passwordForm = document.getElementById('profilePasswordForm');
  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('perfilSenhaStatus');
    const botao = document.getElementById('perfilSenhaBtn');
    const senhaAtual = document.getElementById('perfilSenhaAtual').value;
    const novaSenha = document.getElementById('perfilNovaSenha').value;
    const confirmacao = document.getElementById('perfilConfirmarSenha').value;
    status.textContent = '';
    if (novaSenha !== confirmacao) {
      status.textContent = 'As novas senhas não coincidem.';
      status.className = 'is-error';
      mostrarToast('As novas senhas não coincidem.', 'chimeAlert');
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    try {
      const resposta = await fetch('/api/auth/minha-senha', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha, confirmacao })
      });
      const corpo = await resposta.json();
      status.textContent =
        corpo.message || (resposta.ok ? 'Senha redefinida.' : 'Não foi possível redefinir a senha.');
      status.className = resposta.ok ? 'is-success' : 'is-error';
      if (resposta.ok) {
        passwordForm.reset();
        mostrarToast('Senha alterada com sucesso.', 'chimeSuccess');
      } else mostrarToast(corpo.message || 'Não foi possível alterar a senha.', 'chimeAlert');
    } catch (e) {
      status.textContent = 'Não foi possível conectar ao servidor.';
      status.className = 'is-error';
      mostrarToast('Não foi possível alterar a senha.', 'chimeAlert');
    }
    botao.disabled = false;
    botao.textContent = 'Redefinir senha';
  });
  const birthdayForm = document.getElementById('profileBirthdayForm');
  let birthdayStatusTimer = null;
  let birthdayFadeTimer = null;
  const mostrarStatusAniversario = (status, texto, classe = '') => {
    if (!status) return;
    clearTimeout(birthdayStatusTimer);
    clearTimeout(birthdayFadeTimer);
    status.classList.remove('is-fading', 'is-entering');
    status.textContent = texto;
    status.className = `${classe} is-entering`.trim();
    birthdayStatusTimer = setTimeout(() => {
      status.classList.add('is-fading');
      birthdayFadeTimer = setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 280);
    }, 3600);
  };
  birthdayForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('perfilDataNascimentoInput');
    const status = document.getElementById('perfilAniversarioStatus');
    const botao = document.getElementById('perfilAniversarioBtn');
    mostrarStatusAniversario(status, 'Salvando...');
    botao.disabled = true;
    try {
      const resposta = await fetch('/api/auth/meu-perfil', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_nascimento: input.value })
      });
      const corpo = await resposta.json().catch(() => ({}));
      mostrarStatusAniversario(
        status,
        corpo.message || (resposta.ok ? 'Data atualizada.' : 'Não foi possível atualizar a data.'),
        resposta.ok ? 'is-success' : 'is-error'
      );
      if (resposta.ok) {
        usuarioAtual = corpo.usuario || { ...(usuarioAtual || {}), data_nascimento: input.value };
        document.dispatchEvent(new CustomEvent('aniversarioDataAlterada', { detail: usuarioAtual }));
        window.NexusBirthday?.open?.({ ...usuarioAtual, data_nascimento: input.value }, true);
        mostrarToast('Data de aniversário salva.', 'chimeSuccess');
      }
    } catch (e) {
      mostrarStatusAniversario(status, 'Não foi possível conectar ao servidor.', 'is-error');
    }
    botao.disabled = false;
  });
}
