// Tarefas e alertas ficam no BANCO (por empresa), não no navegador: qualquer
// computador que entrar com a conta da empresa enxerga os mesmos dados.
// "quando" = momento em que a tarefa rodou (ms; usado pelo filtro de período).
let tarefas = [];

// Alertas pendentes da empresa logada: os de máquina/banco (id numérico) e os de
// tarefa (id "t-N", com o objeto "tarefa"). Só saem do card/notificações quando
// alguém os verifica na Central de Alertas.
let alertasPendentes = [];

const API_TAREFAS_URL = '/api/tarefas';
const API_ALERTAS_URL = '/api/alertas';

const timersAtivos = {};
let dominioEmpresaLogada = '';
let usuarioAtual = null;

function aplicarVisualFotoPerfil(url){
  const imagens = [...document.querySelectorAll('#userChipFoto, #userDropdownFoto, #perfilFoto')];
  const fallback = [...document.querySelectorAll('.user-chip-avatar-fallback, .user-dropdown-avatar-fallback, .profile-avatar-fallback')];
  document.documentElement.classList.add('nexus-has-profile-photo');
  imagens.forEach(imagem=>{ imagem.src = url; imagem.hidden = false; imagem.style.display = 'block'; });
  fallback.forEach(icone=>{ icone.hidden = true; icone.style.display = 'none'; });
}
function atualizarFotosUsuario(temFoto){
  const imagens = [...document.querySelectorAll('#userChipFoto, #userDropdownFoto, #perfilFoto')];
  const fallback = [...document.querySelectorAll('.user-chip-avatar-fallback, .user-dropdown-avatar-fallback, .profile-avatar-fallback')];
  if(!temFoto){
    document.documentElement.classList.remove('nexus-has-profile-photo');
    imagens.forEach(imagem=>{ imagem.hidden = true; imagem.removeAttribute('src'); imagem.style.display = 'none'; });
    fallback.forEach(icone=>{ icone.hidden = false; icone.style.removeProperty('display'); });
    return;
  }
  aplicarVisualFotoPerfil(`/api/auth/minha-foto?v=${Date.now()}`);
}

async function exigirAutenticacao(redirecionar=true){
  try{
    const resposta = await fetch('/api/auth/me', { credentials:'same-origin', cache:'no-store' });
    if(!resposta.ok){
      if(redirecionar) window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
      return null;
    }
    const corpo = await resposta.json();
    return corpo.usuario;
  }catch(erro){
    if(redirecionar) window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
    return null;
  }
}

function preencherUsuarioLogado(usuario){
  if(!usuario) return;
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
  Object.entries(perfil).forEach(([id, valor])=>{
    const campo = document.getElementById(id);
    if(campo) campo.textContent = valor;
  });
  const nomeInput = document.getElementById('perfilNomeInput');
  if(nomeInput) nomeInput.value = usuario.nome || '';
  const aniversarioInput = document.getElementById('perfilDataNascimentoInput');
  if(aniversarioInput){ aniversarioInput.value = usuario.data_nascimento ? String(usuario.data_nascimento).slice(0,10) : ''; window.NexusAtualizarDataAniversario?.(); }
  atualizarFotosUsuario(Boolean(usuario.tem_foto));
  window.NexusAplicarIdioma?.(usuario.idioma || 'pt-BR', false);

  // A página de Usuários só existe para cargo de gerente ou superior
  // (o backend também barra com 403, isto aqui só esconde o atalho).
  const itemUsuarios = document.querySelector('.nav-item[data-view="usuarios"]');
  if(itemUsuarios) itemUsuarios.style.display = usuario.pode_gerenciar_usuarios ? '' : 'none';
  const hintEmail = document.getElementById('emailCorporativoHint');
  if(hintEmail){
    hintEmail.textContent = dominioEmpresaLogada
      ? `O endereço será criado no domínio @${dominioEmpresaLogada}.`
      : 'Informe o e-mail corporativo fornecido pela empresa.';
  }
}

function abrirPerfilUsuario(){
  document.getElementById('userDropdown')?.classList.remove('show');
  const titulo = document.getElementById('topbarViewTitle');
  if(titulo) titulo.textContent = window.NexusTraducao?.('profileTitle') || 'Meu usuário';
  window.NexusMostrarView?.('perfil');
}

const NEXUS_ACCENT_KEY = 'nexusAccentGlobal1';
const NEXUS_ACCENTS = new Set(['violet','ocean','emerald','sunset','rose']);
function aplicarCorDeDestaque(cor, persistir=true){
  const valor = NEXUS_ACCENTS.has(cor) ? cor : 'violet';
  document.documentElement.setAttribute('data-accent', valor);
  if(persistir){ try{ localStorage.setItem(NEXUS_ACCENT_KEY, valor); }catch(e){} }
  document.querySelectorAll('[data-accent-choice]').forEach(botao=>botao.classList.toggle('is-active', botao.dataset.accentChoice === valor));
  const status = document.getElementById('paletteLiveStatus');
  if(status) status.innerHTML = '<i></i> Aplicada agora';
  document.dispatchEvent(new CustomEvent('paletaAlterada', { detail:{ paleta:valor } }));
}
function initPersonalizacaoPerfil(){
  let salvo = document.documentElement.dataset.theme === 'dark' ? 'sunset' : 'violet';
  try{ salvo = localStorage.getItem(NEXUS_ACCENT_KEY) || salvo; }catch(e){}
  aplicarCorDeDestaque(salvo, false);
  document.querySelectorAll('[data-accent-choice]').forEach(botao=>botao.addEventListener('click', ()=>{
    aplicarCorDeDestaque(botao.dataset.accentChoice);
    mostrarToast('Cor do painel atualizada.', 'chimeSuccess');
  }));
  document.querySelectorAll('[data-theme-choice]').forEach(botao=>botao.addEventListener('click', ()=>{
    window.NexusSetTheme?.(botao.dataset.themeChoice);
    mostrarToast(`Tema ${botao.dataset.themeChoice === 'dark' ? 'escuro' : 'claro'} aplicado.`, 'chimeSuccess');
  }));
  document.addEventListener('temaAlterado', ()=>{
    const tema = typeof obterTemaAtual === 'function' ? obterTemaAtual() : (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    document.querySelectorAll('[data-theme-choice]').forEach(botao=>botao.classList.toggle('is-active', botao.dataset.themeChoice === tema));
  });
  const temaAtual = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-choice]').forEach(botao=>botao.classList.toggle('is-active', botao.dataset.themeChoice === temaAtual));
}

function gerarEmailCorporativo(){
  const nome = document.getElementById('usuarioNome')?.value || '';
  const campoEmail = document.getElementById('usuarioEmail');
  if(!campoEmail || !dominioEmpresaLogada) return;
  const parteNome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  if(!parteNome) return;
  campoEmail.value = `${parteNome}@${dominioEmpresaLogada}`;
}

function abrirEditorFotoPerfil(arquivo, aoConfirmar){
  const leitor = new FileReader();
  leitor.onload = ()=>{
    const editor = document.createElement('div');
    editor.className = 'profile-photo-editor-overlay';
    editor.innerHTML = `<div class="profile-photo-editor" role="dialog" aria-modal="true" aria-label="Editar foto de perfil"><div class="profile-photo-editor-head"><div><span class="profile-photo-editor-kicker">PERSONALIZE SUA FOTO</span><strong>Ajustar foto de perfil</strong><small>Arraste a imagem e use o zoom para escolher o enquadramento.</small></div><button type="button" class="profile-photo-editor-close" aria-label="Fechar editor">×</button></div><div class="profile-photo-crop-stage"><img class="profile-photo-crop-image" alt="Pré-visualização da foto"></div><label class="profile-photo-zoom">Zoom <input type="range" min="0" max="1" step="0.01" value="0" aria-label="Ajustar zoom da foto"><output>0%</output></label><div class="profile-photo-editor-actions"><button type="button" class="btn-secondary profile-photo-cancel">Cancelar</button><button type="button" class="btn-primary profile-photo-apply">Aplicar enquadramento</button></div></div>`;
    document.body.appendChild(editor);
    const stage = editor.querySelector('.profile-photo-crop-stage');
    const imagem = editor.querySelector('.profile-photo-crop-image');
    const zoomInput = editor.querySelector('input[type="range"]');
    const zoomOutput = editor.querySelector('output');
    imagem.src = leitor.result;
    let zoom = 0, deslocamentoX = 0, deslocamentoY = 0, escalaBase = 1;
    let arrastando = false, inicioX = 0, inicioY = 0, origemX = 0, origemY = 0;
    const atualizar = ()=>{
      const fatorZoom = 1 + zoom;
      imagem.style.transform = `translate(-50%, -50%) translate(${deslocamentoX}px, ${deslocamentoY}px) scale(${fatorZoom})`;
      zoomOutput.value = `${Math.round(zoom * 100)}%`;
    };
    const fechar = ()=>editor.remove();
    const confirmar = ()=>{
      if(!imagem.naturalWidth || !imagem.naturalHeight) return;
      const tamanho = 512;
      const area = stage.getBoundingClientRect().width;
      const escala = escalaBase * (1 + zoom);
      const largura = imagem.naturalWidth * escala;
      const altura = imagem.naturalHeight * escala;
      const x = (area - largura) / 2 + deslocamentoX;
      const y = (area - altura) / 2 + deslocamentoY;
      const canvas = document.createElement('canvas');
      canvas.width = tamanho;
      canvas.height = tamanho;
      const contexto = canvas.getContext('2d');
      contexto.clearRect(0, 0, tamanho, tamanho);
      contexto.drawImage(imagem, x * tamanho / area, y * tamanho / area, largura * tamanho / area, altura * tamanho / area);
      canvas.toBlob(blob=>{
        if(blob) aoConfirmar(new File([blob], 'foto-perfil.png', {type:'image/png'}), canvas.toDataURL('image/png'));
        fechar();
      }, 'image/png');
    };
    zoomInput.addEventListener('input', ()=>{ zoom = Number(zoomInput.value); atualizar(); });
    stage.addEventListener('pointerdown', event=>{
      arrastando = true; inicioX = event.clientX; inicioY = event.clientY; origemX = deslocamentoX; origemY = deslocamentoY;
      stage.setPointerCapture?.(event.pointerId); stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', event=>{
      if(!arrastando) return;
      deslocamentoX = origemX + event.clientX - inicioX;
      deslocamentoY = origemY + event.clientY - inicioY;
      atualizar();
    });
    const soltar = ()=>{ arrastando = false; stage.classList.remove('is-dragging'); };
    stage.addEventListener('pointerup', soltar);
    stage.addEventListener('pointercancel', soltar);
    editor.querySelector('.profile-photo-editor-close').addEventListener('click', fechar);
    editor.querySelector('.profile-photo-cancel').addEventListener('click', fechar);
    editor.querySelector('.profile-photo-apply').addEventListener('click', confirmar);
    editor.addEventListener('click', event=>{ if(event.target === editor) fechar(); });
    imagem.addEventListener('load', ()=>{
      const area = stage.getBoundingClientRect().width;
      // Contain no estado inicial: a pessoa enxerga a foto inteira no quadrado.
      escalaBase = Math.min(area / imagem.naturalWidth, area / imagem.naturalHeight);
      imagem.style.width = `${imagem.naturalWidth * escalaBase}px`;
      imagem.style.height = `${imagem.naturalHeight * escalaBase}px`;
      atualizar();
    }, {once:true});
    requestAnimationFrame(()=>editor.classList.add('show'));
  };
  leitor.readAsDataURL(arquivo);
}

function initMenuUsuario(){
  const btn = document.getElementById('userChipBtn');
  const dropdown = document.getElementById('userDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  const profileBtn = document.getElementById('userProfileBtn');

  btn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    const estavaAberto = dropdown.classList.contains('show');
    // O usuário é um novo contexto: fecha todos os outros painéis,
    // inclusive notificações, mesmo com a propagação interrompida.
    await fecharOutrosPaineis('userDropdown');
    dropdown.classList.toggle('show', !estavaAberto);
  });

  document.addEventListener('click', (e)=>{
    if(!dropdown.contains(e.target) && e.target !== btn){
      dropdown.classList.remove('show');
    }
  });

  logoutBtn.addEventListener('click', async ()=>{
    await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin' });
    window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
  });
  profileBtn?.addEventListener('click', abrirPerfilUsuario);
  document.getElementById('perfilVoltarBtn')?.addEventListener('click', ()=>window.NexusMostrarView?.('dashboard'));
  initPersonalizacaoPerfil();
  const nameForm = document.getElementById('profileNameForm');
  let nomeStatusTimer = null;
  nameForm?.addEventListener('submit', async event=>{
    event.preventDefault();
    const input = document.getElementById('perfilNomeInput');
    const status = document.getElementById('perfilNomeStatus');
    const botao = document.getElementById('perfilNomeBtn');
    const nome = input.value.trim();
    if(nome.length < 3){ status.textContent = 'Informe um nome com pelo menos 3 caracteres.'; status.className = 'is-error'; mostrarToast('Nome inválido.', 'chimeAlert'); return; }
    const nomeAtual = String(usuarioAtual?.nome || document.getElementById('perfilNome')?.textContent || '').trim();
    const normalizarNome = valor => valor.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    if(nomeAtual && normalizarNome(nome) === normalizarNome(nomeAtual)){
      status.textContent = 'O nome informado é igual ao nome atual.';
      status.className = 'is-warning';
      mostrarToast('O nome informado é igual ao nome atual.', 'chimeAlert');
      clearTimeout(nomeStatusTimer);
      nomeStatusTimer = setTimeout(()=>{ status.textContent = ''; status.className = ''; }, 4000);
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    try{
      const resposta = await fetch('/api/auth/meu-perfil', { method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome}) });
      const corpo = await resposta.json();
      status.textContent = corpo.message || (resposta.ok ? 'Nome atualizado.' : 'Não foi possível atualizar o nome.');
      status.className = resposta.ok ? 'is-success' : 'is-error';
      if(resposta.ok){
        usuarioAtual = corpo.usuario || usuarioAtual;
        document.getElementById('userChipNome').textContent = nome.split(' ')[0];
        document.getElementById('userDropdownNome').textContent = nome;
        document.getElementById('perfilNome').textContent = nome;
        mostrarToast('Nome atualizado com sucesso.', 'chimeSuccess');
      }else mostrarToast(corpo.message || 'Não foi possível atualizar o nome.', 'chimeAlert');
    }catch(e){ status.textContent = 'Não foi possível conectar ao servidor.'; status.className = 'is-error'; mostrarToast('Não foi possível atualizar o nome.', 'chimeAlert'); }
    botao.disabled = false;
    botao.textContent = 'Salvar nome';
  });
  const photoForm = document.getElementById('profilePhotoForm');
  const photoInput = document.getElementById('perfilFotoInput');
  const photoButton = document.getElementById('perfilFotoBtn');
  const photoStatus = document.getElementById('perfilFotoStatus');
  let fotoEditada = null;
  photoInput?.addEventListener('change', ()=>{
    const arquivo = photoInput.files?.[0];
    if(!arquivo) return;
    fotoEditada = null;
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)){
      photoStatus.textContent = 'Use uma imagem JPG, PNG ou WEBP.';
      photoStatus.className = 'is-error';
      photoInput.value = '';
      photoButton.disabled = true;
      return;
    }
    if(arquivo.size > 5 * 1024 * 1024){
      photoStatus.textContent = 'A foto deve ter no máximo 5 MB.';
      photoStatus.className = 'is-error';
      photoInput.value = '';
      photoButton.disabled = true;
      return;
    }
    abrirEditorFotoPerfil(arquivo, (foto, preview)=>{
      fotoEditada = foto;
      photoStatus.textContent = 'Enquadramento pronto para aplicar.';
      photoStatus.className = '';
      photoButton.disabled = false;
      aplicarVisualFotoPerfil(preview);
    });
  });
  photoForm?.addEventListener('submit', async event=>{
    event.preventDefault();
    const arquivo = fotoEditada;
    if(!arquivo) return;
    photoButton.disabled = true;
    photoButton.textContent = 'Salvando...';
    const dados = new FormData();
    dados.append('foto', arquivo);
    try{
      const resposta = await fetch('/api/auth/minha-foto', { method:'POST', credentials:'same-origin', body:dados });
      const corpo = await resposta.json().catch(()=>({}));
      photoStatus.textContent = corpo.message || (resposta.ok ? 'Foto atualizada.' : 'Não foi possível salvar a foto.');
      photoStatus.className = resposta.ok ? 'is-success' : 'is-error';
      if(resposta.ok){
        usuarioAtual = corpo.usuario || usuarioAtual;
        atualizarFotosUsuario(true);
        photoInput.value = '';
        fotoEditada = null;
        mostrarToast('Foto de perfil atualizada.', 'chimeSuccess');
        setTimeout(()=>{ photoStatus.textContent = ''; photoStatus.className = ''; }, 4500);
      }
      else photoButton.disabled = false;
    }catch(e){ photoStatus.textContent = 'Não foi possível conectar ao servidor.'; photoStatus.className = 'is-error'; photoButton.disabled = false; }
    photoButton.textContent = 'Salvar foto';
  });
  const passwordForm = document.getElementById('profilePasswordForm');
  passwordForm?.addEventListener('submit', async event=>{
    event.preventDefault();
    const status = document.getElementById('perfilSenhaStatus');
    const botao = document.getElementById('perfilSenhaBtn');
    const senhaAtual = document.getElementById('perfilSenhaAtual').value;
    const novaSenha = document.getElementById('perfilNovaSenha').value;
    const confirmacao = document.getElementById('perfilConfirmarSenha').value;
    status.textContent = '';
    if(novaSenha !== confirmacao){ status.textContent = 'As novas senhas não coincidem.'; status.className = 'is-error'; mostrarToast('As novas senhas não coincidem.', 'chimeAlert'); return; }
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    try{
      const resposta = await fetch('/api/auth/minha-senha', { method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({senha_atual:senhaAtual,nova_senha:novaSenha,confirmacao}) });
      const corpo = await resposta.json();
      status.textContent = corpo.message || (resposta.ok ? 'Senha redefinida.' : 'Não foi possível redefinir a senha.');
      status.className = resposta.ok ? 'is-success' : 'is-error';
      if(resposta.ok){ passwordForm.reset(); mostrarToast('Senha alterada com sucesso.', 'chimeSuccess'); }
      else mostrarToast(corpo.message || 'Não foi possível alterar a senha.', 'chimeAlert');
    }catch(e){ status.textContent = 'Não foi possível conectar ao servidor.'; status.className = 'is-error'; mostrarToast('Não foi possível alterar a senha.', 'chimeAlert'); }
    botao.disabled = false;
    botao.textContent = 'Redefinir senha';
  });
  const birthdayForm = document.getElementById('profileBirthdayForm');
  let birthdayStatusTimer = null;
  let birthdayFadeTimer = null;
  const mostrarStatusAniversario = (status, texto, classe='')=>{
    if(!status) return;
    clearTimeout(birthdayStatusTimer);
    clearTimeout(birthdayFadeTimer);
    status.classList.remove('is-fading','is-entering');
    status.textContent = texto;
    status.className = `${classe} is-entering`.trim();
    birthdayStatusTimer = setTimeout(()=>{
      status.classList.add('is-fading');
      birthdayFadeTimer = setTimeout(()=>{
        status.textContent = '';
        status.className = '';
      }, 280);
    }, 3600);
  };
  birthdayForm?.addEventListener('submit', async event=>{
    event.preventDefault();
    const input = document.getElementById('perfilDataNascimentoInput');
    const status = document.getElementById('perfilAniversarioStatus');
    const botao = document.getElementById('perfilAniversarioBtn');
    mostrarStatusAniversario(status, 'Salvando...');
    botao.disabled = true;
    try{
      const resposta = await fetch('/api/auth/meu-perfil', {method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({data_nascimento:input.value})});
      const corpo = await resposta.json().catch(()=>({}));
      mostrarStatusAniversario(status, corpo.message || (resposta.ok ? 'Data atualizada.' : 'Não foi possível atualizar a data.'), resposta.ok ? 'is-success' : 'is-error');
      if(resposta.ok){
        usuarioAtual = corpo.usuario || {...(usuarioAtual||{}), data_nascimento:input.value};
        // A mensagem só aparece se hoje for o dia/mês do aniversário (checado em aniversario.js).
        document.dispatchEvent(new CustomEvent('aniversarioDataAlterada',{detail:{...usuarioAtual, data_nascimento:input.value}}));
        mostrarToast('Data de aniversário salva.', 'chimeSuccess');
      }
    }catch(e){ mostrarStatusAniversario(status, 'Não foi possível conectar ao servidor.', 'is-error'); }
    botao.disabled = false;
  });
}

function fecharPainelFlutuante(id, motivo='normal'){
  const painel = document.getElementById(id);
  if(!painel) return Promise.resolve();
  painel.classList.remove('show');
  painel.classList.toggle('closing-outside', motivo === 'outside');
  painel.classList.add('closing');
  return new Promise(resolve=>{
    let finalizado = false;
    const remover = ()=>{
      if(finalizado) return;
      finalizado = true;
      painel.remove();
      resolve();
    };
    painel.addEventListener('transitionend', remover, { once:true });
    setTimeout(remover, 170);
  });
}

async function fecharOutrosPaineis(idAtual){
  const ids = ['nexusSearchPanel','nexusHelpPanel','notifDropdown','userDropdown']
    .filter(id => id !== idAtual);
  await Promise.all(ids.map(id=>{
    const painel = document.getElementById(id);
    if(!painel) return Promise.resolve();
    if(id === 'notifDropdown' || id === 'userDropdown'){
      painel.classList.remove('show');
      return Promise.resolve();
    }
    return fecharPainelFlutuante(id);
  }));
}

function isolarDropdownsDaTopbar(){
  ['notifDropdown','userDropdown'].forEach(id=>{
    const painel = document.getElementById(id);
    if(painel && painel.closest('.topbar')) document.body.appendChild(painel);
  });
}

function initTopbarActions(){
  const searchBtn = document.getElementById('searchBtn');
  const helpBtn = document.getElementById('helpBtn');
  const topbarTitle = document.getElementById('topbarViewTitle');
  if(!searchBtn || !helpBtn) return;

  const atualizarTitulo = (item, rotulo) => {
    if(topbarTitle) topbarTitle.textContent = item?.querySelector('.nav-label')?.textContent || rotulo || 'Visão geral';
  };
  const normalizarBusca = valor => String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
  const metadadosBusca = {
    dashboard: {
      descricao:'Visão geral, CPU, RAM, tarefas e alertas do sistema.',
      termos:'visao geral monitoramento infraestrutura maquina virtual desempenho recursos memoria processador tarefas alertas saude status home inicio dashboard overview summary resumen'
    },
    usuarios: {
      descricao:'Gerencie pessoas, cargos, permissões e acessos.',
      termos:'usuario usuarios pessoas equipe cadastro colaborador gerente funcionario conta cargo perfil acesso user users people employee employees team staff account role permission permissions usuario usuarios usuarios'
    },
    conectores: {
      descricao:'Integrações com bancos, APIs e fontes de dados.',
      termos:'conector conectores integrar integracao oracle banco dados api fonte conexao serviço servico connector connectors integration integrations database data sources connection conexiones conectores integraciones'
    },
    orquestrador: {
      descricao:'Automação e acompanhamento de fluxos de trabalho.',
      termos:'orquestrador fluxo fluxos automacao processo processos pipeline rotina execucao tarefas workflow workflows automation flow flows workstream flujos automatizacion'
    },
    relatorios: {
      descricao:'Relatórios de suporte, filtros e registros operacionais.',
      termos:'relatorio relatorios suporte chamado atendimento agente registros historico filtro exportacao analise report reports support ticket service records history filter export analysis informe informes reportes'
    },
    seguranca: {
      descricao:'Distribuição, proteção, permissões e controles de segurança.',
      termos:'seguranca segurança protecao proteção permissao permissoes acesso distribuicao distribuição politica politicas security protection permissions access distribution policy policies seguridad proteccion permisos'
    },
    sistema: {
      descricao:'Governança, políticas, status e administração do sistema.',
      termos:'sistema governanca governança politica políticas status administracao administração regras conformidade system governance policy policies administration rules compliance sistema gobierno administracion'
    },
    config: {
      descricao:'Tema, aparência, sons, música e preferências do painel.',
      termos:'config configuracao configurações configuracoes aparencia aparência tema claro escuro modo som sons musica música preferencia preferencias settings configuration appearance theme light dark mode sound sounds music preference preferences ajustes configuracion apariencia tema claro oscuro sonido musica preferencias'
    },
    perfil: {
      descricao:'Nome, senha, aparência e preferências da sua conta.',
      termos:'meu usuario meu usuário meu perfil perfil conta dados pessoais informacoes pessoais informações pessoais nome alterar nome senha trocar senha alterar senha redefinir senha credenciais aparência aparencia tema cor cores personalizacao personalização preferências preferencias account profile personal data name password change password reset password credentials appearance theme color preferences user account my account my profile personal information edit name update password settings preferences usuario cuenta mi cuenta mi perfil datos personales informacion personal nombre cambiar nombre contraseña cambiar contraseña preferencias perfil utilisateur compte mon compte mon profil données personnelles informations personnelles nom mot de passe changer mot de passe préférences profil utente account il mio account il mio profilo dati personali nome password cambia password preferenze benutzer konto mein konto mein profil persönliche daten name passwort passwort ändern einstellungen',
      icone:'<svg class="ic search-profile-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19c.65-3.1 2.82-4.75 6.5-4.75s5.85 1.65 6.5 4.75" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".65"/></svg>'
    }
  };

  const obterIndiceBusca = () => {
    const indice = [...document.querySelectorAll('.nav-item')]
      .filter(item => getComputedStyle(item).display !== 'none')
      .map(item => {
        const chave = item.dataset.view;
        const rotulo = item.querySelector('.nav-label')?.textContent?.trim() || chave;
        const meta = metadadosBusca[chave] || { descricao:'Abrir esta seção do painel.', termos:'' };
        return { item, chave, rotulo, descricao:meta.descricao, termos:normalizarBusca(`${rotulo} ${meta.termos}`) };
      });
    const botaoPerfil = document.getElementById('userProfileBtn');
    if(botaoPerfil){
      const meta = metadadosBusca.perfil;
      indice.push({ item:botaoPerfil, chave:'perfil', rotulo:'Meu usuário', descricao:meta.descricao, termos:normalizarBusca(`Meu usuário ${meta.termos}`), icone:meta.icone });
    }
    return indice;
  };

  const distanciaEdicao = (a, b) => {
    if(a === b) return 0;
    if(!a || !b) return Math.max(a.length, b.length);
    let anterior = Array.from({length:b.length + 1}, (_, i) => i);
    for(let i=1; i<=a.length; i++){
      const atual = [i];
      for(let j=1; j<=b.length; j++){
        atual[j] = Math.min(
          atual[j-1] + 1,
          anterior[j] + 1,
          anterior[j-1] + (a[i-1] === b[j-1] ? 0 : 1)
        );
      }
      anterior = atual;
    }
    return anterior[b.length];
  };
  const palavrasSemelhantes = (palavra, tokens) => {
    if(palavra.length <= 3) return tokens.some(token => token === palavra);
    const limite = palavra.length >= 10 ? 3 : (palavra.length >= 6 ? 2 : 1);
    return tokens.some(token => {
      if(token.includes(palavra) || palavra.includes(token)) return true;
      if(Math.abs(token.length - palavra.length) > limite) return false;
      return distanciaEdicao(palavra, token) <= limite;
    });
  };
  const pontuar = (entrada, termo) => {
    if(!termo) return 1;
    const palavras = termo.split(/\s+/).filter(Boolean);
    const alvo = normalizarBusca(`${entrada.rotulo} ${entrada.termos}`);
    const tokens = alvo.split(/\s+/).filter(Boolean);
    const correspondentes = palavras.filter(palavra => palavrasSemelhantes(palavra, tokens));
    if(correspondentes.length !== palavras.length) return -1;
    const rotulo = normalizarBusca(entrada.rotulo);
    if(rotulo === termo) return 120;
    if(rotulo.startsWith(termo)) return 110;
    if(rotulo.includes(termo)) return 100;
    const exatos = palavras.filter(palavra => alvo.includes(palavra)).length;
    const aproximados = correspondentes.length - exatos;
    return 65 + exatos * 8 + aproximados * 4;
  };

  const abrirBusca = async () => {
    if(document.getElementById('nexusSearchPanel')){
      await fecharPainelFlutuante('nexusSearchPanel');
      return;
    }
    await fecharOutrosPaineis('nexusSearchPanel');
    const painel = document.createElement('div');
    painel.id = 'nexusSearchPanel';
    painel.className = 'command-panel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Busca inteligente do painel');
    painel.innerHTML = `<div class="command-panel-head"><div><span class="command-kicker">ATALHO RÁPIDO</span><strong>Buscar no Nexus Air</strong><small class="command-subtitle">Digite um assunto e vá direto para a área certa</small></div><button type="button" class="command-close" aria-label="Fechar busca">×</button></div><label class="command-input"><svg class="ic"><use href="#ic-search"/></svg><input id="nexusSearchInput" type="search" placeholder="Ex.: meu usuário, profile, contraseña..." autocomplete="off" aria-label="Pesquisar no painel" aria-controls="nexusSearchResults"></label><div class="command-results" id="nexusSearchResults" role="listbox" aria-label="Resultados da pesquisa"></div><div class="command-footer"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir <kbd>Esc</kbd> fechar</div>`;
    document.body.appendChild(painel);
    const input = painel.querySelector('#nexusSearchInput');
    const results = painel.querySelector('#nexusSearchResults');
    let resultadosAtuais = [];
    let indiceAtivo = 0;

    const selecionar = entrada => {
      if(!entrada) return;
      entrada.item.click();
      fecharPainelFlutuante('nexusSearchPanel');
      atualizarTitulo(entrada.item, entrada.rotulo);
    };
    const atualizarAtivo = indice => {
      const botoes = [...results.querySelectorAll('.command-result')];
      if(!botoes.length) return;
      indiceAtivo = (indice + botoes.length) % botoes.length;
      botoes.forEach((botao, i) => {
        botao.classList.toggle('is-active', i === indiceAtivo);
        botao.setAttribute('aria-selected', i === indiceAtivo ? 'true' : 'false');
      });
      botoes[indiceAtivo].scrollIntoView({block:'nearest'});
    };
    const render = valor => {
      const termo = normalizarBusca(valor);
      resultadosAtuais = obterIndiceBusca()
        .map(entrada => ({ entrada, nota:pontuar(entrada, termo) }))
        .filter(resultado => resultado.nota >= 0)
        .sort((a,b) => b.nota - a.nota)
        .map(resultado => resultado.entrada);
      indiceAtivo = 0;
      if(!resultadosAtuais.length){
        results.innerHTML = `<div class="command-empty"><strong>Nenhum destino encontrado</strong><span>Tente "meu usuário", "perfil", "usuários", "integrações", "fluxos", "relatórios", "segurança" ou "configurações".</span></div>`;
        window.NexusTraduzirConteudo?.();
        return;
      }
      results.innerHTML = resultadosAtuais.map((entrada, indice) => `<button type="button" class="command-result${indice === 0 ? ' is-active' : ''}" data-command-index="${indice}" role="option" aria-selected="${indice === 0 ? 'true' : 'false'}"><span class="command-result-icon">${entrada.icone || entrada.item.querySelector('.nav-icon')?.innerHTML || ''}</span><span class="command-result-copy"><strong>${entrada.rotulo}</strong><small>${entrada.descricao}</small></span><kbd>↵</kbd></button>`).join('');
      window.NexusTraduzirConteudo?.();
    };

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', event => {
      if(event.key === 'ArrowDown'){
        event.preventDefault();
        atualizarAtivo(indiceAtivo + 1);
      } else if(event.key === 'ArrowUp'){
        event.preventDefault();
        atualizarAtivo(indiceAtivo - 1);
      } else if(event.key === 'Enter'){
        event.preventDefault();
        selecionar(resultadosAtuais[indiceAtivo]);
      } else if(event.key === 'Escape'){
        event.preventDefault();
        fecharPainelFlutuante('nexusSearchPanel');
      }
    });
    results.addEventListener('click', event => {
      const botao = event.target.closest('.command-result');
      if(botao) selecionar(resultadosAtuais[Number(botao.dataset.commandIndex)]);
    });
    painel.querySelector('.command-close').addEventListener('click', () => fecharPainelFlutuante('nexusSearchPanel'));
    render('');
    requestAnimationFrame(() => { painel.classList.add('show'); input.focus(); });
  };

  searchBtn.addEventListener('click', abrirBusca);
  helpBtn.addEventListener('click', async ()=>{
    if(document.getElementById('nexusHelpPanel')){
      await fecharPainelFlutuante('nexusHelpPanel');
      return;
    }
    await fecharOutrosPaineis('nexusHelpPanel');
    const painel = document.createElement('div');
    painel.id = 'nexusHelpPanel';
    painel.className = 'command-panel help-panel';
    painel.innerHTML = `<div class="command-panel-head"><div><span class="command-kicker">NEXUS AIR</span><strong>Central de ajuda</strong></div><button type="button" class="command-close" aria-label="Fechar ajuda">×</button></div><div class="help-list"><div><span class="help-number">01</span><p><strong>Navegue pelo menu lateral</strong><small>Use as seções para alternar entre os módulos do painel.</small></p></div><div><span class="help-number">02</span><p><strong>Use a busca inteligente</strong><small>Pesquise por assunto, sinônimo ou recurso e pressione Enter.</small></p></div><div><span class="help-number">03</span><p><strong>Atalho rápido</strong><small>Pressione Ctrl + K (ou Command + K) para abrir a busca de qualquer lugar.</small></p></div></div>`;
    document.body.appendChild(painel);
    window.NexusTraduzirConteudo?.();
    painel.querySelector('.command-close').addEventListener('click', ()=>fecharPainelFlutuante('nexusHelpPanel'));
    requestAnimationFrame(()=>painel.classList.add('show'));
  });

  document.addEventListener('keydown', event=>{
    if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'){
      event.preventDefault();
      if(!document.getElementById('nexusSearchPanel')) abrirBusca();
      else document.getElementById('nexusSearchInput')?.focus();
      return;
    }
    if(event.key === 'Escape'){
      fecharPainelFlutuante('nexusSearchPanel');
      fecharPainelFlutuante('nexusHelpPanel');
    }
  });
  document.addEventListener('click', event=>{
    const painel = event.target.closest('.command-panel, #userDropdown, #notifDropdown');
    const botaoPainel = event.target.closest('#searchBtn, #helpBtn, #notifBtn, #userChipBtn');
    if(!painel && !botaoPainel){
      fecharOutrosPaineis('__outside__');
    }
    const item = event.target.closest('.nav-item');
    if(item) atualizarTitulo(item);
  });
  atualizarTitulo(document.querySelector('.nav-item.active'));
}

let usuarioEditandoId = null;

function abrirModalUsuario(usuario){
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
  document.getElementById('usuarioTipoAcesso').value = usuario ? (usuario.tipo_acesso || 'padrao') : 'padrao';
  document.getElementById('usuarioDataNascimento').value = usuario ? String(usuario.data_nascimento || '').slice(0,10) : '';
  document.getElementById('usuarioSenha').value = '';
  document.getElementById('usuarioSenha').required = !usuario;
  document.getElementById('usuarioSenhaHint').hidden = !usuario;

  overlay.classList.add('show');
}

function fecharModalUsuario(){
  document.getElementById('usuarioModalOverlay').classList.remove('show');
  usuarioEditandoId = null;
}

function mostrarAlertaModal(mensagem){
  const alerta = document.getElementById('usuarioModalAlert');
  alerta.textContent = mensagem;
  alerta.className = 'form-alert form-alert-error';
  alerta.hidden = false;
}

function renderUsuarios(usuarios){
  const tbody = document.getElementById('usuariosTableBody');
  const vazio = document.getElementById('usuariosVazio');
  tbody.innerHTML = '';

  const total = usuarios ? usuarios.length : 0;
  const contagem = document.getElementById('usuariosContagem');
  if(contagem) contagem.textContent = total;
  const contagemTxt = document.getElementById('usuariosContagemTxt');
  if(contagemTxt) contagemTxt.textContent = total === 1 ? 'usuário cadastrado' : 'usuários cadastrados';

  if(!usuarios || usuarios.length === 0){
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  usuarios.forEach((u, i)=>{
    const row = document.createElement('tr');
    const acesso = u.tipo_acesso === 'admin' ? 'Administrador' : 'Padrão';
    const partes = String(u.nome || '?').trim().split(/\s+/);
    const iniciais = ((partes[0] || '?')[0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
    row.style.setProperty('--i', Math.min(i, 12));
    row.innerHTML = `
      <td class="tarefa-cell"><span class="us-pessoa"><i class="us-avatar" aria-hidden="true">${esc(iniciais)}</i><span class="us-nome">${esc(u.nome)}</span></span></td>
      <td class="us-email">${esc(u.email)}</td>
      <td>${u.cargo ? `<span class="us-chip">${esc(u.cargo)}</span>` : '<span class="us-nada">—</span>'}</td>
      <td>${u.departamento ? esc(u.departamento) : '<span class="us-nada">—</span>'}</td>
      <td><span class="status-badge ${u.tipo_acesso === 'admin' ? 'status-Execucao' : 'status-Concluido'}">${acesso}</span></td>
      <td>
        <button class="action-icon" title="Editar" data-action="editar" data-id="${u.id}"><svg class="ic"><use href="#ic-edit"/></svg></button>
        <button class="action-icon" title="Excluir" data-action="excluir" data-id="${u.id}"><svg class="ic"><use href="#ic-trash"/></svg></button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function carregarUsuarios(){
  try{
    const resposta = await fetch('/api/usuarios', { credentials:'same-origin', cache:'no-store' });
    const corpo = await resposta.json().catch(() => ({}));
    if(resposta.status === 403){
      mostrarToast(corpo.message || 'Você não tem permissão para acessar os usuários.');
      return;
    }
    if(!resposta.ok) throw new Error('Falha ao carregar usuários.');
    renderUsuarios(corpo.data);
  }catch(erro){
    mostrarToast('Não foi possível carregar os usuários.');
  }
}

async function salvarUsuario(dados, id){
  const url = id ? `/api/usuarios/${id}` : '/api/usuarios';
  const metodo = id ? 'PUT' : 'POST';

  const resposta = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(dados)
  });
  const corpo = await resposta.json().catch(()=>({}));
  return { ok: resposta.ok, corpo };
}

async function excluirUsuario(id){
  const resposta = await fetch(`/api/usuarios/${id}`, { method:'DELETE', credentials:'same-origin' });
  return resposta.ok;
}

function initUsuariosCRUD(){
  document.getElementById('novoUsuarioBtn').addEventListener('click', ()=> abrirModalUsuario(null));
  document.getElementById('gerarEmailCorporativoBtn').addEventListener('click', gerarEmailCorporativo);
  document.getElementById('usuarioModalClose').addEventListener('click', fecharModalUsuario);
  document.getElementById('usuarioCancelarBtn').addEventListener('click', fecharModalUsuario);
  document.getElementById('usuarioModalOverlay').addEventListener('click', (e)=>{
    if(e.target.id === 'usuarioModalOverlay') fecharModalUsuario();
  });

  document.getElementById('usuarioForm').addEventListener('submit', async (e)=>{
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
    if(senha) dados.senha = senha;

    const botao = document.getElementById('usuarioSalvarBtn');
    const editando = usuarioEditandoId !== null;
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
      const { ok, corpo } = await salvarUsuario(dados, usuarioEditandoId);
      if(!ok){
        mostrarAlertaModal(corpo.message || 'Não foi possível salvar o usuário.');
        return;
      }

      fecharModalUsuario();
      await carregarUsuarios();
      mostrarToast(editando ? 'Usuário editado com sucesso.' : 'Usuário criado com sucesso.');
    } catch(erro) {
      mostrarAlertaModal('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally {
      botao.disabled = false;
      botao.textContent = 'Salvar';
    }
  });

  document.getElementById('usuariosTableBody').addEventListener('click', async (e)=>{
    const btn = e.target.closest('.action-icon');
    if(!btn) return;
    const id = btn.dataset.id;
    const acao = btn.dataset.action;

    if(acao === 'editar'){
      const resposta = await fetch(`/api/usuarios/${id}`, { credentials:'same-origin' });
      if(!resposta.ok){ mostrarToast('Usuário não encontrado.'); return; }
      const corpo = await resposta.json();
      abrirModalUsuario(corpo.data);
    }

    if(acao === 'excluir'){
      if(!confirm('Tem certeza que deseja excluir este usuário?')) return;
      const ok = await excluirUsuario(id);
      if(ok){
        mostrarToast('Usuário removido.');
        carregarUsuarios();
      } else {
        mostrarToast('Não foi possível remover o usuário.');
      }
    }
  });
}

const API_RELATORIO_SUPORTE_URL = '/api/alertas/relatorio-suporte';

function renderRelatorioSuporte(registros){
  const tbody = document.getElementById('relatorioTableBody');
  const vazio = document.getElementById('relatorioVazio');
  tbody.innerHTML = '';

  if(!registros || registros.length === 0){
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  registros.forEach(r=>{
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

async function carregarRelatorioSuporte(idSuporte){
  try{
    const url = idSuporte
      ? `${API_RELATORIO_SUPORTE_URL}?id_suporte=${encodeURIComponent(idSuporte)}`
      : API_RELATORIO_SUPORTE_URL;
    const resposta = await fetch(url, { credentials:'same-origin', cache:'no-store' });
    if(!resposta.ok) throw new Error('Falha ao carregar relatório de suporte.');
    const corpo = await resposta.json();
    renderRelatorioSuporte(corpo);
  }catch(erro){
    mostrarToast('Não foi possível carregar o relatório de suporte.');
  }
}

function initRelatorioSuporte(){
  const filtrarBtn = document.getElementById('relatorioFiltrarBtn');
  const limparBtn = document.getElementById('relatorioLimparBtn');
  const input = document.getElementById('relatorioIdSuporte');

  filtrarBtn.addEventListener('click', ()=> carregarRelatorioSuporte(input.value.trim()));
  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') carregarRelatorioSuporte(input.value.trim());
  });
  limparBtn.addEventListener('click', ()=>{
    input.value = '';
    carregarRelatorioSuporte(null);
  });
}

function statusClassFor(status){
  if(status === 'Em Execução') return 'status-Execucao';
  if(status === 'Parado') return 'status-Parado';
  return 'status-Concluido';
}

function formatarQuandoTarefa(ms){
  if(!ms) return '';
  return new Date(ms).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function tarefaDentroDoPeriodo(t){
  const periodo = window.NexusPeriodo;
  return periodo ? periodo.contem(t.quando) : true;
}

function renderTabela(){
  const tbody = document.getElementById('tableBody');
  if(!tbody) return;
  tbody.innerHTML = '';

  const visiveis = tarefas.filter(tarefaDentroDoPeriodo);
  if(visiveis.length === 0){
    const vazio = document.createElement('tr');
    vazio.className = 'tasks-empty-row';
    vazio.innerHTML = `<td colspan="6" class="table-empty">${tarefas.length === 0 ? 'Nenhuma tarefa.' : 'Nenhuma tarefa neste período. Ajuste o calendário acima.'}</td>`;
    tbody.appendChild(vazio);
    return;
  }

  visiveis.forEach(t=>{
    const row = document.createElement('tr');
    row.dataset.id = t.id;

    let botaoAcao;
    if(t.status === 'Em Execução'){
      botaoAcao = `<button class="action-icon spin" title="Parar processo" data-action="stop"><svg class="ic"><use href="#ic-loader"/></svg></button>`;
    } else if(t.status === 'Parado'){
      botaoAcao = `<button class="action-icon" title="Retomar processo" data-action="start"><svg class="ic ic-solid"><use href="#ic-play"/></svg></button>`;
    } else {
      botaoAcao = `<button class="action-icon" title="Excluir" data-action="delete"><svg class="ic"><use href="#ic-trash"/></svg></button>`;
    }

    row.innerHTML = `
      <td class="id-cell">${t.id}</td>
      <td class="tarefa-cell">${t.tarefa}<small class="tarefa-quando">${formatarQuandoTarefa(t.quando)}</small></td>
      <td>${t.origem}</td>
      <td><span class="progress-pill">${t.tempo}</span></td>
      <td><span class="status-badge ${statusClassFor(t.status)}">${t.status}</span></td>
      <td>${botaoAcao}</td>
    `;
    tbody.appendChild(row);
  });
}

async function chamarTarefasApi(caminho, opcoes={}){
  const resposta = await fetch(`${API_TAREFAS_URL}${caminho}`, {
    credentials:'same-origin', cache:'no-store',
    headers:{ 'Content-Type':'application/json' }, ...opcoes
  });
  const corpo = await resposta.json().catch(()=>({}));
  if(!resposta.ok) throw new Error(corpo.message || 'Não foi possível falar com o servidor.');
  return corpo;
}

async function carregarTarefas(){
  try{
    const corpo = await chamarTarefasApi('');
    tarefas = corpo.tarefas || [];
  }catch(erro){
    tarefas = [];
    mostrarToast('Não foi possível carregar as tarefas.', 'error');
  }
  renderTabela();
}

// Salva o novo status no banco. O servidor também cria o alerta (concluída /
// interrompida), então depois basta atualizar a lista de alertas (sem toast extra).
async function salvarStatusTarefa(id, status){
  try{
    await chamarTarefasApi(`/${encodeURIComponent(id)}`, { method:'PATCH', body: JSON.stringify({ status }) });
    await buscarAlertasReais(true, { silencioso:true });
  }catch(erro){
    mostrarToast(erro.message || 'Não foi possível salvar a tarefa.', 'error');
  }
}

function iniciarProcesso(id){
  const tarefa = tarefas.find(t=>t.id === id);
  if(!tarefa) return;

  tarefa.status = 'Em Execução';
  renderTabela();
  mostrarToast(`Processando ${id}...`, 'loadingStart');
  salvarStatusTarefa(id, 'Em Execução');

  timersAtivos[id] = setTimeout(()=>{
    const t = tarefas.find(t=>t.id === id);
    if(t && t.status === 'Em Execução'){
      t.status = 'Concluído';
      renderTabela();
      mostrarToast(`${id} concluído com sucesso!`, 'loadingEndSuccess');
      salvarStatusTarefa(id, 'Concluído');
    }
    delete timersAtivos[id];
  }, 4000);
}

function pararProcesso(id){
  clearTimeout(timersAtivos[id]);
  delete timersAtivos[id];

  const tarefa = tarefas.find(t=>t.id === id);
  if(tarefa){
    tarefa.status = 'Parado';
    renderTabela();
    mostrarToast(`Processo ${id} interrompido.`, 'loadingEndFail');
    salvarStatusTarefa(id, 'Parado');
  }
}

function initTabelaEventos(){
  const tbody = document.getElementById('tableBody');
  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('.action-icon');
    if(!btn) return;

    const row = btn.closest('tr');
    const id = row.dataset.id;
    const acao = btn.dataset.action;

    if(acao === 'delete'){
      abrirConfirmarExclusao(id);
    }

    if(acao === 'stop'){
      pararProcesso(id);
    }

    if(acao === 'start'){
      iniciarProcesso(id);
    }
  });
}

function isoLocal(data){
  const p = n=>String(n).padStart(2,'0');
  return `${data.getFullYear()}-${p(data.getMonth()+1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}:${p(data.getSeconds())}`;
}

// Todos os pendentes (máquina/banco + tarefas), do mais recente para o mais antigo.
function todosAlertasPendentes(){
  return [...alertasPendentes].sort((x,y)=>String(y.horario).localeCompare(String(x.horario)));
}

let tarefaParaExcluir = null;

function abrirConfirmarExclusao(id){
  const overlay = document.getElementById('confirmDeleteOverlay');
  const tarefa = tarefas.find(t=>t.id === id);
  if(!overlay || !tarefa) return;
  tarefaParaExcluir = id;
  document.getElementById('confirmDeleteText').innerHTML =
    `Você tem certeza que deseja excluir <strong>${escHtml(tarefa.tarefa)}</strong> (<strong>${escHtml(tarefa.id)}</strong>)? Esta ação não pode ser desfeita.`;
  overlay.classList.add('show');
  setTimeout(()=>document.getElementById('confirmDeleteCancel')?.focus(), 60);
}

function fecharConfirmarExclusao(){
  tarefaParaExcluir = null;
  document.getElementById('confirmDeleteOverlay')?.classList.remove('show');
}

async function confirmarExclusaoTarefa(){
  const id = tarefaParaExcluir;
  fecharConfirmarExclusao();
  if(!id) return;
  try{
    await chamarTarefasApi(`/${encodeURIComponent(id)}`, { method:'DELETE' });
    clearTimeout(timersAtivos[id]);
    delete timersAtivos[id];
    tarefas = tarefas.filter(t=>t.id !== id);
    renderTabela();
    // A exclusão gera um alerta "Tarefa excluída" que precisa ser verificado
    // na Central de Alertas, igual aos de tarefa concluída/interrompida.
    await buscarAlertasReais(true, { silencioso:true });
    mostrarToast(`Tarefa ${id} excluída. Verifique o alerta gerado.`, 'notificationPop');
  }catch(erro){
    mostrarToast(erro.message || 'Não foi possível excluir a tarefa.', 'error');
  }
}

function escHtml(valor){
  return String(valor ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const ROTULO_SEVERIDADE = { baixa:'Baixa', media:'Média', alta:'Alta', critica:'Crítica' };

function itemAlertaHtml(a){
  const sev = ROTULO_SEVERIDADE[a.severidade] ? a.severidade : 'media';
  const onde = a.tarefa ? a.tarefa.id : (a.maquina_hostname || a.zabbix_host || a.ip_maquina || '');
  const hora = formatarHorarioAlerta(a.horario);
  return `<button type="button" class="alert-item alert-item--link" data-alerta-id="${escHtml(a.id)}" data-sev="${sev}">
    <span class="alert-icon"><svg class="ic"><use href="#ic-alert-triangle"/></svg></span>
    <span class="alert-text"><strong>${escHtml(a.tipo_alerta)}</strong><small>${escHtml(a.status_alerta)}</small><small class="alert-meta">${escHtml(onde)}${onde && hora ? ' · ' : ''}${escHtml(hora)}</small></span>
    <span class="alert-sev-badge" data-sev="${sev}">${ROTULO_SEVERIDADE[sev]}</span>
    <svg class="ic alert-go"><use href="#ic-chevron-right"/></svg>
  </button>`;
}

const ALERTAS_NO_CARD = 4;

function renderAlertas(){
  const alertsList = document.getElementById('alertsList');
  if(!alertsList) return;
  const pendentes = todosAlertasPendentes();

  if(pendentes.length === 0){
    alertsList.innerHTML = `<div class="alert-text" style="color:var(--text-muted);font-weight:500;">Nenhum alerta no momento.</div>`;
    return;
  }

  let html = pendentes.slice(0, ALERTAS_NO_CARD).map(itemAlertaHtml).join('');
  if(pendentes.length > ALERTAS_NO_CARD){
    html += `<button type="button" class="alerts-more" data-alerta-abrir-central>Ver todos os ${pendentes.length} alertas pendentes</button>`;
  }
  alertsList.innerHTML = html;
}

function renderNotificacoes(destacar){
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  if(!badge || !list) return;
  const pendentes = todosAlertasPendentes();
  const total = pendentes.length;

  badge.textContent = total;
  badge.classList.toggle('empty', total === 0);
  if(destacar){
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }

  if(total === 0){
    list.innerHTML = `<div class="notif-empty">Nenhuma notificação no momento.</div>`;
    return;
  }
  list.innerHTML = pendentes.map(itemAlertaHtml).join('');
}

document.addEventListener('nexusIdiomaAlterado', ()=>{
  if(document.getElementById('notifList')) renderNotificacoes(false);
});

function initNotificacoes(){
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  notifBtn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    const estavaAberto = notifDropdown.classList.contains('show');
    // Notificações é um novo contexto: fecha todos os outros painéis.
    await fecharOutrosPaineis('notifDropdown');
    notifDropdown.classList.toggle('show', !estavaAberto);
  });

  document.addEventListener('click', (e)=>{
    if(!notifDropdown.contains(e.target) && e.target !== notifBtn){
      notifDropdown.classList.remove('show');
    }
  });
}

function mostrarToast(msg, tipoSom){
  const somJaExecutado = Boolean(window.NexusSoundToastMuted);
  window.NexusSoundToastMuted = false;
  if(window.NexusSons && !somJaExecutado){
    const texto = String(msg || '').toLowerCase();
    if(tipoSom) window.NexusSons.play(tipoSom);
    else if(/falha|não foi|nao foi|erro|removido|exclu/i.test(texto)) window.NexusSons.playError();
    else window.NexusSons.play('chimeSuccess');
  }
  let toast = document.getElementById('toast');
  if(!toast){
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
  toast._timer = setTimeout(()=> toast.classList.remove('show'), 2500);
}

function ehMobile(){
  return window.innerWidth <= 900;
}

function fecharSidebarMobile(){
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('burgerBtn');
  const overlay = document.getElementById('sidebarOverlay');
  if(!sidebar) return;
  sidebar.classList.remove('mobile-open');
  if(burger) burger.classList.remove('open');
  if(overlay) overlay.classList.remove('show');
}

function corTrilhaGrafico(){
  return obterTemaAtual() === 'dark' ? 'rgba(255,255,255,0.12)' : '#e9e3ff';
}

function corAcentoGrafico(){
  return getComputedStyle(document.documentElement).getPropertyValue('--purple').trim() || '#5b2ee0';
}

function redesenharGraficosTema(){
  const cpuUsoEl = document.getElementById('cpuUsoPct');
  const usoAtual = cpuUsoEl ? parseFloat(cpuUsoEl.textContent) || 0 : 0;
  animarDonut('cpuChart', [
    {value:usoAtual, color:corAcentoGrafico()},
    {value:100-usoAtual, color:corTrilhaGrafico()}
  ]);
  animarDonut('tarefasChart', [
    {value:82, color:corAcentoGrafico()},
    {value:18, color:corTrilhaGrafico()}
  ]);
}

// A roda de tarefas e a da CPU também precisam acompanhar a troca de paleta.
document.addEventListener('paletaAlterada', ()=>redesenharGraficosTema());

document.addEventListener('temaAlterado', (e)=>{
  // Só redesenha quando é uma troca real feita pelo usuário (persistir),
  // não na aplicação inicial do tema salvo ao carregar a página.
  if(e.detail && e.detail.persistir) redesenharGraficosTema();
});

function initSidebarToggle(){
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('burgerBtn');
  const overlay = document.getElementById('sidebarOverlay');
  if(!sidebar || !burger) return;
  sidebar.classList.add('collapsed');
  if(ehMobile()) sidebar.classList.remove('mobile-open');
  burger.classList.remove('open');
  burger.setAttribute('aria-label', 'Abrir menu lateral');
  burger.setAttribute('aria-expanded', 'false');

  burger.addEventListener('click', ()=>{
    if(ehMobile()){
      const abrindo = !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', abrindo);
      burger.classList.toggle('open', abrindo);
      burger.setAttribute('aria-label', abrindo ? 'Fechar menu lateral' : 'Abrir menu lateral');
      burger.setAttribute('aria-expanded', String(abrindo));
      if(overlay) overlay.classList.toggle('show', abrindo);
    } else {
      const fechando = !sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed', fechando);
      burger.classList.toggle('open', !fechando);
      burger.setAttribute('aria-label', fechando ? 'Abrir menu lateral' : 'Fechar menu lateral');
      burger.setAttribute('aria-expanded', String(!fechando));
    }
    setTimeout(posicionarHighlight, 400);
  });

  if(overlay){
    overlay.addEventListener('click', fecharSidebarMobile);
  }

  window.addEventListener('resize', ()=>{
    if(!ehMobile()){
      fecharSidebarMobile();
    }
  });
}

function posicionarHighlight(){
  const ativo = document.querySelector('.nav-item.active');
  const highlight = document.getElementById('navHighlight');
  if(!ativo || !highlight) return;
  highlight.style.top = ativo.offsetTop + 'px';
  highlight.style.height = ativo.offsetHeight + 'px';
}

function initNavegacao(){
  const itens = document.querySelectorAll('.nav-item');
  const DURACAO = 260;

  itens.forEach(item=>{
    item.addEventListener('click', ()=>{
      const alvo = item.dataset.view;
      const viewAlvo = document.getElementById(`view-${alvo}`);

      if(ehMobile()) fecharSidebarMobile();

      if(!viewAlvo || viewAlvo.classList.contains('active')) return;

      itens.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      posicionarHighlight();

      if(alvo === 'usuarios'){
        carregarUsuarios();
      }

      if(alvo === 'relatorios'){
        carregarRelatorioSuporte(document.getElementById('relatorioIdSuporte').value.trim());
      }

      const viewAtual = document.querySelector('.view.active');

      if(viewAtual){
        viewAtual.classList.remove('show');
        setTimeout(()=>{
          viewAtual.classList.remove('active');
          mostrarView(viewAlvo);
        }, DURACAO);
      } else {
        mostrarView(viewAlvo);
      }
    });
  });

  function mostrarView(view){
    view.classList.add('active');
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=> view.classList.add('show'));
    });
  }

  window.NexusMostrarView = (alvo)=>{
    const viewAlvo = document.getElementById(`view-${alvo}`);
    const viewAtual = document.querySelector('.view.active');
    if(!viewAlvo || viewAlvo === viewAtual) return;
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    const item = document.querySelector(`.nav-item[data-view="${alvo}"]`);
    if(item){ item.classList.add('active'); posicionarHighlight(); }
    const topbarTitle = document.getElementById('topbarViewTitle');
    if(topbarTitle) topbarTitle.textContent = item?.querySelector('.nav-label')?.textContent || (alvo === 'perfil' ? 'Meu usuário' : 'Visão geral');
    const highlight = document.getElementById('navHighlight');
    if(highlight) highlight.style.opacity = item ? '1' : '0';
    if(viewAtual){
      viewAtual.classList.remove('show');
      setTimeout(()=>{ viewAtual.classList.remove('active'); mostrarView(viewAlvo); }, DURACAO);
    }else mostrarView(viewAlvo);
  };

  const inicial = document.querySelector('.view.active');
  if(inicial) requestAnimationFrame(()=> inicial.classList.add('show'));

  posicionarHighlight();
  window.addEventListener('resize', posicionarHighlight);
  window.addEventListener('load', posicionarHighlight);

  // Os itens mudam de altura ao recolher/expandir o menu (min-height animado).
  // Sem acompanhar isso, o destaque ficava deslocado do item ativo.
  if('ResizeObserver' in window){
    const destaque = document.getElementById('navHighlight');
    let aguardando = false;
    const observador = new ResizeObserver(()=>{
      if(aguardando) return;
      aguardando = true;
      requestAnimationFrame(()=>{
        aguardando = false;
        if(destaque) destaque.style.transition = 'none';
        posicionarHighlight();
        if(destaque){ void destaque.offsetHeight; destaque.style.transition = ''; }
      });
    });
    itens.forEach(item=>observador.observe(item));
  }
}

function drawDonut(canvasId, segments, progresso){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const cx = canvas.width/2, cy = canvas.height/2;
  const radius = Math.min(cx,cy) - 6;
  const innerRadius = radius * 0.62;
  let startAngle = -Math.PI/2;

  segments.forEach(seg=>{
    const angle = (seg.value/100) * Math.PI * 2 * progresso;
    const endAngle = startAngle + angle;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,startAngle,endAngle);
    ctx.arc(cx,cy,innerRadius,endAngle,startAngle,true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill('evenodd');
    startAngle += angle;
  });
}

const animacoesDonut = {};

function animarDonut(canvasId, segments){
  const anterior = animacoesDonut[canvasId];
  if(anterior?.frame) cancelAnimationFrame(anterior.frame);
  const destino = segments.map(seg=>({...seg, value:Number(seg.value)||0}));
  const origem = (anterior?.segments || destino.map(seg=>({...seg, value:0}))).map((seg,i)=>({
    value:Number(seg.value)||0,
    color:destino[i]?.color || seg.color
  }));
  const duracao = 760;
  const inicio = performance.now();

  function passo(agora){
    const t = Math.min((agora - inicio) / duracao, 1);
    const facilitado = 1 - Math.pow(1 - t, 3);
    const atual = destino.map((seg,i)=>({
      color:seg.color,
      value:origem[i].value + (seg.value-origem[i].value)*facilitado
    }));
    drawDonut(canvasId, atual, 1);
    if(t < 1){
      animacoesDonut[canvasId] = {frame:requestAnimationFrame(passo), segments:destino};
    }else{
      animacoesDonut[canvasId] = {frame:0, segments:destino};
    }
  }
  animacoesDonut[canvasId] = {frame:requestAnimationFrame(passo), segments:destino};
}

const RAM_JANELA_PONTOS = 30;
const RAM_DURACAO_TRANSICAO = 800;
const RAM_DURACAO_ENTRADA = 1100;
const RAM_DURACAO_ABRIR_DETALHE = 950;
const RAM_ATRASO_ABRIR_DETALHE = 240;
const RAM_DURACAO_FECHAR_DETALHE = 320;
const RAM_MAX_AMOSTRAS = 60;

const ramHistoricoPercentual = [];
let ramTransicao = { inicio:0, de:0, para:0 };
let ramEntradaInicio = 0;
let ramProgressoDetalhe = 1;
let ramFrameDetalhe = 0;
let ramCoresCache = null;

const limitarFaixa = (valor, minimo, maximo)=>Math.max(minimo, Math.min(maximo, valor));
const facilitarSaida = t=>1 - Math.pow(1 - t, 3);

// Contagem suave até o novo valor (mesma sensação dos números da CPU).
function animarNumeroTexto(elemento, destino, formatar, duracao=800){
  if(!elemento) return;
  if(!Number.isFinite(destino)) return;
  const de = Number.isFinite(elemento._valorAnimado) ? elemento._valorAnimado : 0;
  if(elemento._valorAnimado === destino) return;
  cancelAnimationFrame(elemento._quadroNumero);
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    elemento._valorAnimado = destino;
    elemento.textContent = formatar(destino);
    return;
  }
  elemento.classList.remove('chart-value-updated');
  void elemento.offsetWidth;
  elemento.classList.add('chart-value-updated');
  const inicio = performance.now();
  const passo = agora=>{
    const t = Math.min(1, (agora - inicio)/duracao);
    const valor = de + (destino - de)*(1 - Math.pow(1 - t, 3));
    elemento._valorAnimado = valor;
    elemento.textContent = formatar(valor);
    if(t < 1) elemento._quadroNumero = requestAnimationFrame(passo);
    else { elemento._valorAnimado = destino; elemento.textContent = formatar(destino); }
  };
  elemento._quadroNumero = requestAnimationFrame(passo);
}

function atualizarTextoChart(elemento, valor){
  if(!elemento) return;
  const texto = String(valor);
  if(elemento.textContent === texto) return;
  elemento.classList.remove('chart-value-updated');
  void elemento.offsetWidth;
  elemento.textContent = texto;
  elemento.classList.add('chart-value-updated');
}

function corComAlfa(cor, alfa){
  const texto = String(cor).trim();
  let canais = [91,46,224];
  const hex = texto.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if(hex){
    const valor = hex[1].length === 3 ? hex[1].replace(/./g, c=>c+c) : hex[1];
    canais = [0,2,4].map(i=>parseInt(valor.slice(i,i+2),16));
  } else {
    const rgb = texto.match(/rgba?\(([^)]+)\)/);
    if(rgb) canais = rgb[1].split(',').slice(0,3).map(Number);
  }
  return `rgba(${canais.join(',')},${alfa})`;
}

function coresGraficoRAM(){
  if(ramCoresCache) return ramCoresCache;
  const estilo = getComputedStyle(document.documentElement);
  ramCoresCache = {
    acento: estilo.getPropertyValue('--purple').trim() || '#5b2ee0',
    claro: estilo.getPropertyValue('--purple-light').trim() || '#7a4dff'
  };
  return ramCoresCache;
}
['paletaAlterada','temaAlterado'].forEach(evento=>document.addEventListener(evento, ()=>{
  // O CSS leva um quadro para refletir a nova paleta; só então relê as cores.
  requestAnimationFrame(()=>{ ramCoresCache = null; });
}));

function prepararCanvas(canvas){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;
  if(!largura || !altura) return null;
  if(canvas._larguraCss !== largura || canvas._alturaCss !== altura || canvas._dpr !== dpr){
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas._larguraCss = largura;
    canvas._alturaCss = altura;
    canvas._dpr = dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,largura,altura);
  return { ctx, largura, altura };
}

function tracarCurvaSuave(ctx, pontos, yMin, yMax){
  ctx.moveTo(pontos[0].x, pontos[0].y);
  for(let i=0;i<pontos.length-1;i++){
    const p0 = pontos[i-1] || pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i+1];
    const p3 = pontos[i+2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x)/6, limitarFaixa(p1.y + (p2.y - p0.y)/6, yMin, yMax),
      p2.x - (p3.x - p1.x)/6, limitarFaixa(p2.y - (p3.y - p1.y)/6, yMin, yMax),
      p2.x, p2.y
    );
  }
}

function desenharMarcadorFinal(ctx, x, y, acento, pulso){
  ctx.beginPath();
  ctx.arc(x, y, 5 + 7*pulso, 0, Math.PI*2);
  ctx.fillStyle = corComAlfa(acento, 0.28*(1 - pulso));
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI*2);
  ctx.fillStyle = acento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.stroke();
}

function desenharAreaComLinha(ctx, pontos, base, topo, acento, acentoClaro){
  const gradiente = ctx.createLinearGradient(0, topo, 0, base);
  gradiente.addColorStop(0, corComAlfa(acento, 0.36));
  gradiente.addColorStop(1, corComAlfa(acento, 0.02));
  ctx.beginPath();
  tracarCurvaSuave(ctx, pontos, topo, base);
  ctx.lineTo(pontos[pontos.length-1].x, base);
  ctx.lineTo(pontos[0].x, base);
  ctx.closePath();
  ctx.fillStyle = gradiente;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  tracarCurvaSuave(ctx, pontos, topo, base);
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = acentoClaro;
  ctx.shadowColor = corComAlfa(acento, 0.45);
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function serieVisivelRAM(usoAtual){
  const base = ramHistoricoPercentual.length ? ramHistoricoPercentual : [Number(usoAtual) || 0];
  const valores = base.slice(-RAM_JANELA_PONTOS);
  if(ramTransicao.inicio && valores.length){
    const progresso = limitarFaixa((performance.now() - ramTransicao.inicio)/RAM_DURACAO_TRANSICAO, 0, 1);
    valores[valores.length-1] = ramTransicao.de + (ramTransicao.para - ramTransicao.de)*facilitarSaida(progresso);
  }
  while(valores.length < RAM_JANELA_PONTOS + 1) valores.unshift(valores[0]);
  return valores;
}

function desenharGraficoRAM(canvasId, usoAtual=0){
  const canvas = document.getElementById(canvasId);
  const area = canvas && prepararCanvas(canvas);
  if(!area) return;
  const { ctx, largura, altura } = area;
  const agora = performance.now();
  const { acento, claro } = coresGraficoRAM();

  const topo = 14;
  const base = altura - 8;
  const direita = largura - 10;

  ctx.save();
  ctx.setLineDash([4,6]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = corTrilhaGrafico();
  [0.25,0.5,0.75].forEach(fracao=>{
    const y = Math.round(base - (base - topo)*fracao) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(largura, y);
    ctx.stroke();
  });
  ctx.restore();

  if(!ramHistoricoPercentual.length) return;
  if(!ramEntradaInicio) ramEntradaInicio = agora;

  const entrada = facilitarSaida(limitarFaixa((agora - ramEntradaInicio)/RAM_DURACAO_ENTRADA, 0, 1));
  const progressoSlide = ramTransicao.inicio ? limitarFaixa((agora - ramTransicao.inicio)/RAM_DURACAO_TRANSICAO, 0, 1) : 1;
  const passo = direita/(RAM_JANELA_PONTOS - 1);
  const deslocamento = (1 - facilitarSaida(progressoSlide))*passo;
  const valores = serieVisivelRAM(usoAtual);

  const pontos = valores.map((valor, i)=>({
    x: direita - (valores.length - 1 - i)*passo + deslocamento,
    y: base - (limitarFaixa(valor,0,100)/100)*(base - topo)*entrada
  }));

  ctx.save();
  // Recorta à área do gráfico para a curva nunca vazar pelas bordas durante o deslize.
  ctx.beginPath();
  ctx.rect(0, 0, largura, altura);
  ctx.clip();
  ctx.globalAlpha = Math.min(1, entrada*1.4);
  desenharAreaComLinha(ctx, pontos, base, topo, acento, claro);
  const ultimo = pontos[pontos.length-1];
  desenharMarcadorFinal(ctx, Math.min(ultimo.x, direita), ultimo.y, acento, (agora % 1800)/1800);
  ctx.restore();
}

function registrarAmostraRAM(percentual){
  const atual = limitarFaixa(Number(percentual) || 0, 0, 100);
  ramTransicao = { inicio:performance.now(), de:ramHistoricoPercentual.at(-1) ?? atual, para:atual };
  ramHistoricoPercentual.push(atual);
  if(ramHistoricoPercentual.length > RAM_MAX_AMOSTRAS) ramHistoricoPercentual.shift();
  desenharGraficoRAM('ramChart', atual);
  if(!historicoRAMAberto()) atualizarResumoRAMDetalhado();
}

function atualizarResumoRAMDetalhado(){
  const valores = ramHistoricoPercentual.length ? ramHistoricoPercentual : [0];
  atualizarTextoChart(document.getElementById('ramHistoryCurrent'), `${Math.round(valores.at(-1) || 0)}%`);
  atualizarTextoChart(document.getElementById('ramHistoryPeak'), `${Math.round(Math.max(...valores))}%`);
  atualizarTextoChart(document.getElementById('ramHistorySamples'), valores.length);
}

function desenharHistoricoRAMDetalhado(progresso=ramProgressoDetalhe){
  const canvas = document.getElementById('ramHistoryDetailChart');
  if(!canvas) return;
  const area = prepararCanvas(canvas);
  if(!area) return;
  const { ctx, largura, altura } = area;
  const { acento, claro } = coresGraficoRAM();
  const margem = { topo:12, direita:40, base:18, esquerda:12 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;
  const valores = ramHistoricoPercentual.length ? ramHistoricoPercentual : [0];
  const revelado = facilitarSaida(limitarFaixa(progresso, 0, 1));

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(148,132,190,.22)';
  [0,0.5,1].forEach(fracao=>{
    const y = Math.round(margem.topo + h*fracao) + 0.5;
    ctx.beginPath();
    ctx.moveTo(margem.esquerda, y);
    ctx.lineTo(margem.esquerda + w, y);
    ctx.stroke();
  });

  const serie = valores.length > 1 ? valores : [valores[0], valores[0]];
  const n = serie.length - 1;
  const pontos = serie.map((valor, i)=>({
    x: margem.esquerda + (i/n)*w,
    y: margem.topo + h - (limitarFaixa(valor,0,100)/100)*h*revelado
  }));

  if(revelado > 0){
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, margem.esquerda + w*revelado + 6, altura);
    ctx.clip();
    desenharAreaComLinha(ctx, pontos, margem.topo + h, margem.topo, acento, claro);
    ctx.restore();
    if(revelado >= 1){
      const ultimo = pontos[pontos.length-1];
      desenharMarcadorFinal(ctx, ultimo.x, ultimo.y, acento, (performance.now() % 1800)/1800);
    }
  }
  atualizarResumoRAMDetalhado();
}

// Anima o progresso do gráfico do detalhe (0 = vazio, 1 = completo).
// Enquanto o modal está aberto o laço continua, para o marcador pulsar.
function animarProgressoDetalheRAM(alvo, duracao, atraso=0, aoFinalizar){
  cancelAnimationFrame(ramFrameDetalhe);
  const de = ramProgressoDetalhe;
  const inicio = performance.now() + atraso;
  const passo = agora=>{
    const t = limitarFaixa((agora - inicio)/duracao, 0, 1);
    ramProgressoDetalhe = de + (alvo - de)*t;
    desenharHistoricoRAMDetalhado();
    if(t < 1 || (alvo === 1 && historicoRAMAberto())){
      ramFrameDetalhe = requestAnimationFrame(passo);
    } else if(aoFinalizar){
      aoFinalizar();
    }
  };
  ramFrameDetalhe = requestAnimationFrame(passo);
}

function historicoRAMAberto(){
  return Boolean(document.getElementById('ramHistoryOverlay')?.classList.contains('show'));
}

function abrirHistoricoRAM(){
  const overlay = document.getElementById('ramHistoryOverlay');
  if(!overlay || historicoRAMAberto()) return;
  const modal = overlay.querySelector('.ram-history-modal');
  const card = document.querySelector('.ram-card-interactive');
  if(modal && card){
    // O modal "nasce" do card: a origem da animação é o centro do card.
    const c = card.getBoundingClientRect();
    const origemX = c.left + c.width/2 - (window.innerWidth/2 - modal.offsetWidth/2);
    const origemY = c.top + c.height/2 - (window.innerHeight/2 - modal.offsetHeight/2);
    modal.style.transformOrigin = `${Math.round(origemX)}px ${Math.round(origemY)}px`;
  }
  overlay.classList.remove('closing');
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  card?.setAttribute('aria-expanded','true');
  ramProgressoDetalhe = 0;
  desenharHistoricoRAMDetalhado();
  animarProgressoDetalheRAM(1, RAM_DURACAO_ABRIR_DETALHE, RAM_ATRASO_ABRIR_DETALHE);
  document.getElementById('ramHistoryClose')?.focus({ preventScroll:true });
}

function fecharHistoricoRAM(){
  const overlay = document.getElementById('ramHistoryOverlay');
  if(!overlay || !historicoRAMAberto()) return;
  overlay.classList.remove('show');
  overlay.classList.add('closing');
  overlay.setAttribute('aria-hidden','true');
  const card = document.querySelector('.ram-card-interactive');
  card?.setAttribute('aria-expanded','false');
  animarProgressoDetalheRAM(0, RAM_DURACAO_FECHAR_DETALHE, 0, ()=>overlay.classList.remove('closing'));
  if(overlay.contains(document.activeElement)) card?.focus({ preventScroll:true });
}

function iniciarHistoricoRAM(){
  const card = document.querySelector('.ram-card-interactive');
  card?.setAttribute('aria-expanded','false');
  card?.addEventListener('click', abrirHistoricoRAM);
  card?.addEventListener('keydown', e=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      abrirHistoricoRAM();
    }
  });
  document.getElementById('ramHistoryClose')?.addEventListener('click', fecharHistoricoRAM);
  document.getElementById('ramHistoryOverlay')?.addEventListener('click', e=>{
    if(e.target.id === 'ramHistoryOverlay') fecharHistoricoRAM();
  });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') fecharHistoricoRAM(); });
  window.addEventListener('resize', ()=>{ if(historicoRAMAberto()) desenharHistoricoRAMDetalhado(); });
}

function iniciarAnimacaoRAM(){
  let frameId = null;
  let ultimoQuadro = 0;
  function loop(agora){
    if(document.hidden || !document.getElementById('ramChart')?.isConnected){
      frameId = null;
      return;
    }
    frameId = requestAnimationFrame(loop);
    if(agora - ultimoQuadro < 24) return;
    ultimoQuadro = agora;
    if(!document.getElementById('view-dashboard')?.classList.contains('active')) return;
    desenharGraficoRAM('ramChart', ramHistoricoPercentual.at(-1) || 0);
  }
  const iniciar = ()=>{
    if(!document.hidden && frameId === null) frameId = requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', iniciar, { passive:true });
  iniciar();
}

let alertasApiDisponivel = false;

function formatarHorarioAlerta(horarioBruto){
  if(!horarioBruto) return '';
  const data = new Date(horarioBruto);
  if(isNaN(data.getTime())) return String(horarioBruto);
  return data.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

let alertasPrimeiraCarga = true;

async function buscarAlertasReais(forcar=false, { silencioso=false }={}){
  if(document.hidden && !forcar) return;
  try{
    const resposta = await fetch(`${API_ALERTAS_URL}?status=pendente`, { cache:'no-store', credentials:'same-origin' });
    if(!resposta.ok) throw new Error('offline');
    const corpo = await resposta.json();
    const antigos = new Set(alertasPendentes.map(a=>a.id));
    const recebidos = corpo.alertas || [];
    const novos = recebidos.filter(a=>!antigos.has(a.id));

    alertasApiDisponivel = true;
    alertasPendentes = recebidos;

    renderAlertas();
    renderNotificacoes(!silencioso && !alertasPrimeiraCarga && novos.length > 0);
    atualizarContadorCentral();
    if(!silencioso && !alertasPrimeiraCarga && novos.length > 0){
      mostrarToast(novos.length === 1 ? `Novo alerta: ${novos[0].tipo_alerta}` : `${novos.length} novos alertas.`, 'notificationPop');
    }
    alertasPrimeiraCarga = false;
    if(centralAlertasAberta()) carregarCentralAlertas({ manterSelecao:true });
  }catch(erro){
    if(!alertasApiDisponivel){
      renderAlertas();
      renderNotificacoes(false);
    }
  }
}

// O calendário de período (dia/semana/mês/intervalo + horário) vive em
// calendario-periodo.js. Ao aplicar, ele avisa e a tabela é refeita.
function initDateRange(){
  window.NexusInitPeriodo?.();
}
document.addEventListener('nexusPeriodoAlterado', ()=>renderTabela());

let uptimeBaseSegundos = 0;
let uptimeReferenciaMs = 0;
let backendDisponivel = false;

function formatarTempo(totalSegundos){
  const dias = Math.floor(totalSegundos/86400);
  const horas = Math.floor((totalSegundos%86400)/3600);
  const minutos = Math.floor((totalSegundos%3600)/60);
  const segundos = Math.floor(totalSegundos%60);
  const base = `${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
  return dias > 0 ? `${dias}d ${base}` : base;
}

async function buscarStatusCPU(){
  if(document.hidden) return;
  // Máquina escolhida no seletor do dashboard (maquinas.js); sem escolha = este servidor.
  const maquinaAlvo = window.NexusMaquinaId ? window.NexusMaquinaId() : null;
  try{
    const resposta = await fetch(window.NexusUrlStatusCPU ? window.NexusUrlStatusCPU() : '/api/sistema/status', { cache:'no-store', credentials:'same-origin' });
    if(maquinaAlvo !== (window.NexusMaquinaId ? window.NexusMaquinaId() : null)) return; // trocou de máquina durante a consulta
    if(!resposta.ok){
      if(maquinaAlvo){
        const falha = await resposta.json().catch(()=>({}));
        window.NexusMaquinaAviso?.(falha.message || 'Não foi possível ler esta máquina no Zabbix.');
        return;
      }
      throw new Error('offline');
    }
    const corpo = await resposta.json();
    const dados = corpo.data;
    window.NexusMaquinaAviso?.(dados.avisos && dados.avisos.length ? 'Zabbix não entrega: ' + dados.avisos.join(', ') + '.' : '');

    backendDisponivel = true;
    const inicioProjeto = Number(dados.inicioProjetoEpoch);
    uptimeBaseSegundos = Number.isFinite(inicioProjeto)
      ? Math.max(0, Math.floor(Date.now()/1000 - inicioProjeto))
      : Math.max(0, Number(dados.tempoAtividadeSegundos) || 0);
    uptimeReferenciaMs = Date.now();

    atualizarTextoChart(document.getElementById('cpuVelocidade'), dados.velocidadeGHz ? `${dados.velocidadeGHz} GHz` : 'n/d');
    atualizarTextoChart(document.getElementById('cpuUsoPct'), `${dados.usoPercentual}%`);
    atualizarTextoChart(document.getElementById('cpuLivrePct'), `${dados.livrePercentual}%`);
    const ramUso = document.getElementById('ramUsoPct');
    const ramTotal = document.getElementById('ramTotal');
    const ramLivre = document.getElementById('ramLivre');
    animarNumeroTexto(ramUso, Number(dados.ramUsoPercentual), v=>`${Math.round(v)}%`);
    animarNumeroTexto(ramTotal, Number(dados.ramTotalBytes), formatarMemoria);
    animarNumeroTexto(ramLivre, Number(dados.ramLivreBytes), formatarMemoria);
    registrarAmostraRAM(dados.ramUsoPercentual);

    animarDonut('cpuChart', [
      {value:dados.usoPercentual, color:corAcentoGrafico()},
      {value:dados.livrePercentual, color:corTrilhaGrafico()}
    ]);
  }catch(erro){
    if(!backendDisponivel){
      document.getElementById('cpuVelocidade').textContent = 'Conecte o backend';
      const nucleos = navigator.hardwareConcurrency || '--';
      document.getElementById('cpuUsoPct').textContent = `${nucleos} núcleos`;
      document.getElementById('cpuLivrePct').textContent = '--';
    }
  }
}

function iniciarRelogioUptime(){
  setInterval(()=>{
    if(document.hidden) return;
    if(backendDisponivel){
      const decorridoMs = Date.now() - uptimeReferenciaMs;
      const totalSegundos = uptimeBaseSegundos + Math.floor(decorridoMs/1000);
      document.getElementById('cpuUptime').textContent = formatarTempo(totalSegundos);
    } else {
      document.getElementById('cpuUptime').textContent = '--:--:--';
    }
  }, 1000);
}

function formatarMemoria(bytes){
  if(!Number.isFinite(bytes)) return '--';
  const unidades = ['B','KB','MB','GB','TB'];
  let valor = bytes, indice = 0;
  while(valor >= 1024 && indice < unidades.length - 1){ valor /= 1024; indice++; }
  return `${valor.toFixed(indice > 1 ? 1 : 0)} ${unidades[indice]}`;
}

let centralAba = 'pendente';
let centralLista = [];
let centralSelecionadoId = null;
let centralEnviando = false;
// Rascunho da observação por alerta + chave do que está desenhado no painel de
// detalhes. A atualização automática (a cada 15 s) NÃO pode redesenhar o painel
// enquanto nada mudou, senão a caixa de texto era recriada e o texto digitado sumia.
let centralRascunhos = {};
let centralDetalheChave = null;

const centralOverlay = ()=> document.getElementById('alertsCenterOverlay');
function centralAlertasAberta(){ return Boolean(centralOverlay()?.classList.contains('show')); }

function formatarDataCompleta(bruto){
  if(!bruto) return '—';
  const d = new Date(bruto);
  if(isNaN(d.getTime())) return String(bruto);
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function atualizarContadorCentral(){
  const el = document.getElementById('alertsTabPendentes');
  if(el) el.textContent = todosAlertasPendentes().length;
}

// ids da API são números; os de tarefa são texto ("t-...").
function lerIdAlerta(bruto){
  return /^\d+$/.test(String(bruto)) ? Number(bruto) : String(bruto);
}

async function carregarCentralAlertas({ manterSelecao=false }={}){
  const lista = document.getElementById('alertsCenterList');
  if(!lista) return;
  let daApi = [];
  let apiFalhou = false;
  try{
    const resposta = await fetch(`${API_ALERTAS_URL}?status=${centralAba}`, { cache:'no-store', credentials:'same-origin' });
    if(!resposta.ok) throw new Error('falha');
    const corpo = await resposta.json();
    daApi = corpo.alertas || [];
    if(centralAba === 'pendente') alertasPendentes = daApi;
  }catch(e){
    apiFalhou = true;
  }
  centralLista = daApi;
  atualizarContadorCentral();
  if(apiFalhou && centralLista.length === 0){
    lista.innerHTML = `<div class="alerts-center-empty">Não foi possível carregar os alertas.</div>`;
    document.getElementById('alertsCenterDetail').innerHTML = '';
    return;
  }
  const aindaExiste = centralLista.some(a=>a.id === centralSelecionadoId);
  if(!manterSelecao || !aindaExiste) centralSelecionadoId = centralLista[0]?.id ?? null;
  renderListaCentral();
  renderDetalheCentral();
}

function renderListaCentral(){
  const lista = document.getElementById('alertsCenterList');
  if(centralLista.length === 0){
    lista.innerHTML = `<div class="alerts-center-empty">${centralAba === 'pendente' ? 'Nenhum alerta pendente. Tudo verificado!' : 'Nenhum alerta verificado ainda.'}</div>`;
    return;
  }
  lista.innerHTML = centralLista.map(a=>{
    const sev = ROTULO_SEVERIDADE[a.severidade] ? a.severidade : 'media';
    const ativo = a.id === centralSelecionadoId ? ' is-active' : '';
    const onde = a.tarefa ? a.tarefa.id : (a.maquina_hostname || a.zabbix_host || a.ip_maquina || '');
    return `<button type="button" class="alerts-center-item${ativo}" data-central-id="${escHtml(a.id)}" data-sev="${sev}">
      <span class="alerts-center-dot" data-sev="${sev}"></span>
      <span class="alerts-center-item-text"><strong>${escHtml(a.tipo_alerta)}</strong><small>${escHtml(onde)} · ${escHtml(formatarHorarioAlerta(a.horario))}</small></span>
    </button>`;
  }).join('');
}

function campoDetalhe(rotulo, valor){
  const vazio = valor === null || valor === undefined || valor === '';
  return `<div class="alert-field"><span>${escHtml(rotulo)}</span><strong${vazio ? ' class="is-empty"' : ''}>${vazio ? '—' : escHtml(valor)}</strong></div>`;
}

function renderDetalheCentral(){
  const painel = document.getElementById('alertsCenterDetail');
  const a = centralLista.find(x=>x.id === centralSelecionadoId);
  if(!a){
    centralDetalheChave = null;
    painel.innerHTML = `<div class="alerts-center-placeholder"><svg class="ic"><use href="#ic-bell"/></svg><p>Selecione um alerta para ver todos os detalhes.</p></div>`;
    return;
  }
  const chave = `${a.id}|${a.verificado}|${a.verificado_em || ''}|${a.observacao_verificacao || ''}`;
  if(chave === centralDetalheChave && painel.firstElementChild) return;   // nada mudou: preserva o que a pessoa está digitando
  centralDetalheChave = chave;
  const sev = ROTULO_SEVERIDADE[a.severidade] ? a.severidade : 'media';
  const pct = v => (v === null || v === undefined) ? null : `${v}%`;
  const gb = v => (v === null || v === undefined) ? null : `${v} GB`;

  const rodape = a.verificado
    ? `<div class="alert-verified-box"><svg class="ic"><use href="#ic-check"/></svg><div>
         <strong>Verificado por ${escHtml(a.verificado_por || '—')}</strong>
         <small>${escHtml(formatarDataCompleta(a.verificado_em))}</small>
         ${a.observacao_verificacao ? `<p>${escHtml(a.observacao_verificacao)}</p>` : ''}
       </div></div>`
    : `<form class="alert-verify-form" id="alertVerifyForm" data-verificar-id="${escHtml(a.id)}">
         <label for="alertVerifyNote">Observação da verificação <small>(opcional)</small></label>
         <textarea id="alertVerifyNote" rows="2" maxlength="500" placeholder="O que foi verificado ou feito sobre este alerta"></textarea>
         <p class="alert-verify-hint">Ao marcar como verificado, o alerta deixa de aparecer na Central e nas notificações.</p>
         <button type="submit" class="btn-primary" id="alertVerifyBtn"><svg class="ic"><use href="#ic-check"/></svg> Marcar como verificado</button>
       </form>`;

  painel.innerHTML = `
    <div class="alert-detail-head" data-sev="${sev}">
      <div class="alert-detail-title">
        <span class="alert-sev-badge" data-sev="${sev}">${ROTULO_SEVERIDADE[sev]}</span>
        <span class="alert-state ${a.verificado ? 'is-done' : 'is-pending'}">${a.verificado ? 'Verificado' : 'Pendente'}</span>
        <h4>${escHtml(a.tipo_alerta)}</h4>
        <p>${escHtml(a.status_alerta)}</p>
      </div>
    </div>
    <div class="alert-detail-scroll">
      <div class="alert-section"><h5>Ocorrência</h5><div class="alert-fields">
        ${campoDetalhe('Registrado em', formatarDataCompleta(a.horario))}
        ${campoDetalhe('Origem', a.origem)}
        ${campoDetalhe('Contexto', a.contexto)}
        ${campoDetalhe('Criado por', a.criado_por)}
        ${campoDetalhe('Nº do alerta', a.tarefa ? 'Tarefa ' + a.tarefa.id : '#' + a.id)}
      </div></div>
      ${a.descricao ? `<div class="alert-section"><h5>Descrição</h5><p class="alert-long">${escHtml(a.descricao)}</p></div>` : ''}
      ${a.tarefa ? `<div class="alert-section"><h5>Tarefa</h5><div class="alert-fields">
        ${campoDetalhe('ID do relatório', a.tarefa.id)}
        ${campoDetalhe('Tarefa', a.tarefa.nome)}
        ${campoDetalhe('Origem', a.tarefa.origem)}
        ${campoDetalhe('Tempo estimado', a.tarefa.tempo)}
        ${campoDetalhe('Status no momento do alerta', a.tarefa.status)}
      </div></div>` : `<div class="alert-section"><h5>Máquina virtual</h5><div class="alert-fields">
        ${campoDetalhe('Hostname', a.maquina_hostname)}
        ${campoDetalhe('IP', a.ip_maquina)}
        ${campoDetalhe('Status OLVM', a.maquina_status_olvm)}
        ${campoDetalhe('Status Zabbix', a.maquina_status_zabbix)}
        ${campoDetalhe('CPU', pct(a.maquina_cpu))}
        ${campoDetalhe('RAM', gb(a.maquina_ram))}
      </div></div>
      <div class="alert-section"><h5>Banco de dados</h5><div class="alert-fields">
        ${campoDetalhe('IP', a.ip_banco)}
        ${campoDetalhe('Status OLVM', a.banco_status_olvm)}
        ${campoDetalhe('Status Zabbix', a.banco_status_zabbix)}
        ${campoDetalhe('Memória', gb(a.banco_memoria))}
      </div>${a.banco_log_erro ? `<pre class="alert-log">${escHtml(a.banco_log_erro)}</pre>` : ''}</div>`}
      ${a.recomendacao ? `<div class="alert-section alert-reco"><h5>Ação recomendada</h5><p class="alert-long">${escHtml(a.recomendacao)}</p></div>` : ''}
    </div>
    <div class="alert-detail-foot">${rodape}</div>`;

  const campoObs = document.getElementById('alertVerifyNote');
  if(campoObs && centralRascunhos[a.id]) campoObs.value = centralRascunhos[a.id];
}

function abrirCentralAlertas(id=null, aba='pendente'){
  const overlay = centralOverlay();
  if(!overlay) return;
  document.getElementById('notifDropdown')?.classList.remove('show');
  centralAba = aba;
  centralSelecionadoId = id;
  centralDetalheChave = null;
  document.querySelectorAll('[data-alerts-tab]').forEach(b=>b.classList.toggle('is-active', b.dataset.alertsTab === aba));
  overlay.classList.add('show');
  carregarCentralAlertas({ manterSelecao: id !== null });
}

function fecharCentralAlertas(){ centralOverlay()?.classList.remove('show'); }

async function verificarAlerta(id, observacao){
  if(centralEnviando) return;
  centralEnviando = true;
  const botao = document.getElementById('alertVerifyBtn');
  if(botao) botao.disabled = true;
  try{
    const resposta = await fetch(`${API_ALERTAS_URL}/${encodeURIComponent(id)}/verificar`, {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ observacao })
    });
    const corpo = await resposta.json().catch(()=>({}));
    if(!resposta.ok) throw new Error(corpo.message || 'Não foi possível verificar o alerta.');
    delete centralRascunhos[id];
    // sai da lista de pendentes: card, notificações e contador atualizam na hora
    alertasPendentes = alertasPendentes.filter(a=>a.id !== id);
    centralLista = centralLista.filter(a=>a.id !== id);
    centralSelecionadoId = centralLista[0]?.id ?? null;
    renderAlertas();
    renderNotificacoes(false);
    atualizarContadorCentral();
    renderListaCentral();
    renderDetalheCentral();
    mostrarToast('Alerta verificado.', 'chimeSuccess');
  }catch(erro){
    mostrarToast(erro.message || 'Não foi possível verificar o alerta.', 'error');
    if(botao) botao.disabled = false;
  }finally{
    centralEnviando = false;
  }
}

function mostrarErroNovoAlerta(msg){
  const el = document.getElementById('alertNewError');
  if(!el) return;
  el.textContent = msg;
  el.className = 'form-alert form-alert-error';
  el.hidden = false;
}

async function abrirNovoAlerta(){
  const overlay = document.getElementById('alertNewOverlay');
  if(!overlay) return;
  document.getElementById('alertNewForm').reset();
  document.getElementById('alertNewError').hidden = true;
  const selMaq = document.getElementById('alertNewMaquina');
  const selBanco = document.getElementById('alertNewBanco');
  selMaq.innerHTML = selBanco.innerHTML = '<option value="">Carregando...</option>';
  overlay.classList.add('show');
  try{
    const resposta = await fetch(`${API_ALERTAS_URL}/opcoes`, { cache:'no-store', credentials:'same-origin' });
    if(!resposta.ok) throw new Error('falha');
    const { maquinas=[], bancos=[] } = await resposta.json();
    selMaq.innerHTML = maquinas.length
      ? '<option value="" disabled selected>Selecione</option>' + maquinas.map(m=>`<option value="${escHtml(m.ip)}">${escHtml(m.hostname && m.hostname !== m.ip ? (m.ip.includes('.') || m.ip.includes(':') ? `${m.hostname} (${m.ip})` : m.hostname) : m.ip)}</option>`).join('')
      : '<option value="">Nenhuma máquina cadastrada</option>';
    selBanco.innerHTML = bancos.length
      ? '<option value="" disabled selected>Selecione</option>' + bancos.map(b=>`<option value="${escHtml(b.ip)}">${escHtml(b.hostname && b.hostname !== b.ip ? (b.ip.includes('.') || b.ip.includes(':') ? `${b.hostname} (${b.ip})` : b.hostname) : b.ip)}</option>`).join('')
      : '<option value="">Nenhum banco cadastrado</option>';
    if(!maquinas.length || !bancos.length) mostrarErroNovoAlerta('É preciso ter ao menos uma máquina virtual e um banco cadastrados para criar alertas.');
  }catch(e){
    selMaq.innerHTML = selBanco.innerHTML = '<option value="">Indisponível</option>';
    mostrarErroNovoAlerta('Não foi possível carregar máquinas e bancos. Verifique o servidor.');
  }
}

function fecharNovoAlerta(){ document.getElementById('alertNewOverlay')?.classList.remove('show'); }

async function enviarNovoAlerta(event){
  event.preventDefault();
  const v = id => document.getElementById(id).value.trim();
  const dados = {
    tipo_alerta: v('alertNewTipo'), status_alerta: v('alertNewStatus'), severidade: v('alertNewSeveridade'),
    ip_maquina: v('alertNewMaquina'), ip_banco: v('alertNewBanco'), contexto: v('alertNewContexto'),
    origem: v('alertNewOrigem'), descricao: v('alertNewDescricao'), recomendacao: v('alertNewRecomendacao')
  };
  if(!dados.tipo_alerta || !dados.status_alerta || !dados.ip_maquina || !dados.ip_banco){
    mostrarErroNovoAlerta('Preencha tipo, resumo, máquina virtual e banco de dados.');
    return;
  }
  const botao = document.getElementById('alertNewSubmit');
  botao.disabled = true;
  try{
    const resposta = await fetch(API_ALERTAS_URL, {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(dados)
    });
    const corpo = await resposta.json().catch(()=>({}));
    if(!resposta.ok) throw new Error(corpo.message || 'Não foi possível criar o alerta.');
    fecharNovoAlerta();
    await buscarAlertasReais(true);
    mostrarToast('Alerta criado.', 'chimeSuccess');
    abrirCentralAlertas(corpo.alerta.id, 'pendente');
  }catch(erro){
    mostrarErroNovoAlerta(erro.message);
  }finally{
    botao.disabled = false;
  }
}

// Delegação no document: sobrevive à troca de <body> feita pelo roteador.
if(!window.__nexusAlertasBound){
  window.__nexusAlertasBound = true;
  document.addEventListener('click', event=>{
    const alvo = event.target;
    const item = alvo.closest?.('button[data-alerta-id]');
    if(item){ abrirCentralAlertas(lerIdAlerta(item.dataset.alertaId), 'pendente'); return; }
    if(alvo.closest?.('[data-alerta-abrir-central]')){ abrirCentralAlertas(null, 'pendente'); return; }
    if(alvo.closest?.('#alertsOpenCenterBtn')){ abrirCentralAlertas(null, 'pendente'); return; }
    if(alvo.closest?.('#alertsNewBtn') || alvo.closest?.('#alertsCenterNewBtn')){ abrirNovoAlerta(); return; }
    if(alvo.closest?.('#alertsCenterClose') || alvo.id === 'alertsCenterOverlay'){ fecharCentralAlertas(); return; }
    if(alvo.closest?.('#alertNewClose') || alvo.closest?.('#alertNewCancel') || alvo.id === 'alertNewOverlay'){ fecharNovoAlerta(); return; }
    if(alvo.closest?.('#confirmDeleteYes')){ confirmarExclusaoTarefa(); return; }
    if(alvo.closest?.('#confirmDeleteCancel') || alvo.closest?.('#confirmDeleteClose') || alvo.id === 'confirmDeleteOverlay'){ fecharConfirmarExclusao(); return; }
    const aba = alvo.closest?.('[data-alerts-tab]');
    if(aba){
      centralAba = aba.dataset.alertsTab; centralSelecionadoId = null;
      document.querySelectorAll('[data-alerts-tab]').forEach(b=>b.classList.toggle('is-active', b === aba));
      carregarCentralAlertas(); return;
    }
    const sel = alvo.closest?.('[data-central-id]');
    if(sel){ centralSelecionadoId = lerIdAlerta(sel.dataset.centralId); renderListaCentral(); renderDetalheCentral(); }
  });
  document.addEventListener('input', event=>{
    if(event.target.id !== 'alertVerifyNote') return;
    const id = event.target.closest('[data-verificar-id]')?.dataset.verificarId;
    if(id) centralRascunhos[lerIdAlerta(id)] = event.target.value;
  });
  document.addEventListener('submit', event=>{
    if(event.target.id === 'alertNewForm') enviarNovoAlerta(event);
    if(event.target.id === 'alertVerifyForm'){
      event.preventDefault();
      verificarAlerta(lerIdAlerta(event.target.dataset.verificarId), document.getElementById('alertVerifyNote').value.trim());
    }
  });
  document.addEventListener('keydown', event=>{
    if(event.key !== 'Escape') return;
    if(document.getElementById('confirmDeleteOverlay')?.classList.contains('show')) fecharConfirmarExclusao();
    else if(document.getElementById('alertNewOverlay')?.classList.contains('show')) fecharNovoAlerta();
    else if(centralAlertasAberta()) fecharCentralAlertas();
  });
}

window.NexusInitDashboard = async ()=>{
  if(!document.querySelector('.app')) return;
  const aberturaAtiva = Boolean(document.querySelector('#nexusSplash:not(.is-hidden)'));
  const usuarioLogado = await exigirAutenticacao(!aberturaAtiva);
  if(!usuarioLogado){
    if(aberturaAtiva) window.NexusAberturaAposEntrada = true;
    return;
  }

  // Cada etapa roda isolada: se uma falhar, as demais (e principalmente o menu lateral
  // e o destaque da aba ativa) continuam funcionando.
  const seguro = (nome, fn)=>{ try{ return fn(); }catch(erro){ console.error(`[Nexus] falha em ${nome}:`, erro); } };

  seguro('preencherUsuarioLogado', ()=>preencherUsuarioLogado(usuarioLogado));
  document.dispatchEvent(new CustomEvent('usuarioAutenticado', { detail: usuarioLogado }));
  // Menu lateral primeiro: o quadrado da aba ativa depende só disto.
  seguro('initSidebarToggle', initSidebarToggle);
  seguro('initNavegacao', initNavegacao);
  seguro('abertura', ()=>window.NexusInitAbertura?.());
  seguro('isolarDropdownsDaTopbar', isolarDropdownsDaTopbar);
  seguro('initMenuUsuario', initMenuUsuario);
  seguro('initTopbarActions', initTopbarActions);
  seguro('initUsuariosCRUD', initUsuariosCRUD);
  seguro('initRelatorioSuporte', initRelatorioSuporte);

  seguro('initDateRange', initDateRange);
  seguro('renderTabela', renderTabela);
  seguro('carregarTarefas', carregarTarefas);
  seguro('renderAlertas', renderAlertas);
  seguro('renderNotificacoes', ()=>renderNotificacoes(false));
  seguro('atualizarContadorCentral', atualizarContadorCentral);
  seguro('initTabelaEventos', initTabelaEventos);
  seguro('initNotificacoes', initNotificacoes);

  animarDonut('cpuChart', [
    {value:0, color:corAcentoGrafico()},
    {value:0, color:corTrilhaGrafico()}
  ]);

  animarDonut('tarefasChart', [
    {value:82, color:corAcentoGrafico()},
    {value:18, color:corTrilhaGrafico()}
  ]);

  iniciarAnimacaoRAM();
  iniciarHistoricoRAM();

  uptimeReferenciaMs = Date.now();
  buscarStatusCPU();
  setInterval(buscarStatusCPU, 4000);
  iniciarRelogioUptime();

  buscarAlertasReais();
  // O roteador pode chamar esta função de novo a cada navegação: um único timer,
  // senão a Central de Alertas era redesenhada várias vezes por segundo.
  if(!window.__nexusAlertasTimer) window.__nexusAlertasTimer = setInterval(buscarAlertasReais, 15000);
};

window.addEventListener('DOMContentLoaded', window.NexusInitDashboard);

