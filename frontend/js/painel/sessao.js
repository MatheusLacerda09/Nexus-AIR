async function exigirAutenticacao(redirecionar = true) {
  try {
    const resposta = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!resposta.ok) {
      if (redirecionar) window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
      return null;
    }
    const corpo = await resposta.json();
    return corpo.usuario;
  } catch (erro) {
    if (redirecionar) window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
    return null;
  }
}

function preencherUsuarioLogado(usuario) {
  if (!usuario) return;
  usuarioAtual = usuario;
  dominioEmpresaLogada = (usuario.email || '').split('@')[1] || '';
  document.getElementById('userChipNome').textContent = usuario.nome.split(' ')[0];
  document.getElementById('userDropdownNome').textContent = usuario.nome;
  document.getElementById('userDropdownEmail').textContent = usuario.email;
  const perfil = {
    perfilNome: usuario.nome,
    perfilEmail: usuario.email,
    perfilCargo: usuario.cargo || 'Não informado',
    perfilDepartamento: usuario.departamento || 'Não informado',
    perfilAcesso: usuario.tipo_acesso === 'admin' ? 'Administrador' : 'Padrão',
    perfilEmpresa: usuario.cliente || usuario.departamento || 'Não informada'
  };
  Object.entries(perfil).forEach(([id, valor]) => {
    const campo = document.getElementById(id);
    if (campo) campo.textContent = valor;
  });
  const nomeInput = document.getElementById('perfilNomeInput');
  if (nomeInput) nomeInput.value = usuario.nome || '';
  const aniversarioInput = document.getElementById('perfilDataNascimentoInput');
  if (aniversarioInput) {
    aniversarioInput.value = usuario.data_nascimento ? String(usuario.data_nascimento).slice(0, 10) : '';
    window.NexusAtualizarDataAniversario?.();
  }
  atualizarFotosUsuario(Boolean(usuario.tem_foto));
  window.NexusAplicarIdioma?.(usuario.idioma || 'pt-BR', false);

  const itemUsuarios = document.querySelector('.nav-item[data-view="usuarios"]');
  if (itemUsuarios) itemUsuarios.style.display = usuario.pode_gerenciar_usuarios ? '' : 'none';
  const hintEmail = document.getElementById('emailCorporativoHint');
  if (hintEmail) {
    hintEmail.textContent = dominioEmpresaLogada
      ? `O endereço será criado no domínio @${dominioEmpresaLogada}.`
      : 'Informe o e-mail corporativo fornecido pela empresa.';
  }
}
