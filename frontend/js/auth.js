function mostrarAvisoAnimado(elemento){
  if(!elemento) return;
  if(elemento._avisoTimeoutSaida){
    clearTimeout(elemento._avisoTimeoutSaida);
    elemento._avisoTimeoutSaida = null;
  }
  if(PREFERE_MENOS_MOVIMENTO){
    elemento.hidden = false;
    elemento.classList.add('form-alert--visivel');
    return;
  }
  elemento.hidden = false;
  elemento.classList.remove('form-alert--visivel');
  // Força o navegador a "commitar" o estado oculto antes de adicionar a
  // classe que dispara a transição — sem isso o fade de entrada não
  // roda (o elemento nasceria já visível, sem transição para animar).
  void elemento.offsetWidth;
  elemento.classList.add('form-alert--visivel');
}

function esconderAvisoAnimado(elemento){
  if(!elemento || elemento.hidden) return;
  if(PREFERE_MENOS_MOVIMENTO){
    elemento.hidden = true;
    elemento.classList.remove('form-alert--visivel');
    return;
  }
  elemento.classList.remove('form-alert--visivel');
  elemento._avisoTimeoutSaida = setTimeout(() => {
    elemento.hidden = true;
    elemento._avisoTimeoutSaida = null;
  }, 220);
}

function mostrarAlerta(mensagem, tipo){
  const alerta = document.getElementById('formAlert');
  if(!alerta) return;
  if(window.NexusSons){
    if(tipo === 'error') window.NexusSons.playError();
    else window.NexusSons.play('accessGranted');
  }
  alerta.textContent = mensagem;
  alerta.className = `form-alert form-alert-${tipo}`;
  mostrarAvisoAnimado(alerta);
}

function alternarCarregando(botao, carregando, textoNormal){
  botao.disabled = carregando;
  botao.innerHTML = carregando
    ? '<span class="btn-spinner" aria-hidden="true"></span>Aguarde...'
    : textoNormal;
}

function irParaDepoisDaAnimacao(destino){
  const shell = document.querySelector('.auth-shell');
  const navegar = () => window.NexusRouter?.go(destino) || (window.location.href = destino);
  if(!shell || PREFERE_MENOS_MOVIMENTO){ navegar(); return; }
  if(shell.classList.contains('auth-shell--leaving')) return;
  shell.classList.add('auth-shell--leaving');
  let navegou = false;
  const ir = () => { if(navegou) return; navegou = true; navegar(); };
  // animationend sobe (bubbles) de qualquer filho, como a onda do botão (ripple):
  // só vale a animação de saída do próprio cartão.
  shell.addEventListener('animationend', e => {
    if(e.target === shell && e.animationName === 'authShellOut') ir();
  });
  setTimeout(ir, 800);
}

async function enviarJSON(url, dados){
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(dados)
  });
  const corpo = await resposta.json().catch(()=>({}));
  return { ok: resposta.ok, corpo };
}

function aplicarMascara(input, formatador){
  if(!input) return;
  input.addEventListener('input', () => {
    const posicaoAntes = input.selectionStart;
    const tamanhoAntes = input.value.length;
    input.value = formatador(input.value);
    const diff = input.value.length - tamanhoAntes;
    const novaPos = Math.max(0, (posicaoAntes || 0) + diff);
    try{ input.setSelectionRange(novaPos, novaPos); }
    catch(_e){  }
  });
}

function digitosNacionaisTelefone(valor){
  const bruto = (valor || '').trim();
  let d;
  if(bruto.startsWith('+55')){
    d = bruto.slice(3).replace(/\D/g, '');
  } else {
    d = bruto.replace(/\D/g, '');
    if(d.startsWith('55') && d.length >= 12) d = d.slice(2);
  }
  return d.slice(0, 11);
}

function maskTelefone(valor){
  const d = digitosNacionaisTelefone(valor);
  if(!d) return '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const tamanhoParte1 = d.length <= 10 ? 4 : 5;
  const parte1 = resto.slice(0, tamanhoParte1);
  const parte2 = resto.slice(tamanhoParte1);

  let out = `+55 (${ddd}`;
  if(ddd.length === 2 && resto) out += ') ';
  out += parte1;
  if(parte2) out += `-${parte2}`;
  return out;
}

function telefoneParaEnvio(valor){
  const d = digitosNacionaisTelefone(valor);
  return d ? `+55${d}` : '';
}

function maskCPF(valor){
  const d = valor.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCNPJ(valor){
  const d = valor.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskEmail(valor){
  return valor.replace(/\s+/g, '').toLowerCase();
}

function initMascaras(){
  aplicarMascara(document.getElementById('telefone'), maskTelefone);
  aplicarMascara(document.getElementById('cpf'), maskCPF);
  aplicarMascara(document.getElementById('email'), maskEmail);
  aplicarMascara(document.getElementById('telefoneEmpresa'), maskTelefone);
  aplicarMascara(document.getElementById('cnpj'), maskCNPJ);
  aplicarMascara(document.getElementById('emailEmpresa'), maskEmail);
}

function initTogglesSenha(){
  document.querySelectorAll('.field-toggle-pw').forEach(botao => {
    botao.addEventListener('click', () => {
      const alvo = document.getElementById(botao.dataset.toggleFor);
      if(!alvo) return;
      const mostrando = alvo.type === 'text';
      alvo.type = mostrando ? 'password' : 'text';
      botao.innerHTML = mostrando
        ? '<svg><use href="#ic-eye"></use></svg>'
        : '<svg><use href="#ic-eye-off"></use></svg>';
      botao.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');

      botao.classList.remove('fx-pop');
      void botao.offsetWidth; // reinicia a animação mesmo em cliques seguidos
      botao.classList.add('fx-pop');
    });
  });
}

const PREFERE_MENOS_MOVIMENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initRipple(){
  if(PREFERE_MENOS_MOVIMENTO) return;
  document.querySelectorAll('.fx-ripple').forEach(el => {
    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect();
      const tamanho = Math.max(rect.width, rect.height) * 1.8;
      const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left - tamanho / 2;
      const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - tamanho / 2;

      const onda = document.createElement('span');
      onda.className = 'ripple-circle';
      onda.style.width = onda.style.height = `${tamanho}px`;
      onda.style.left = `${x}px`;
      onda.style.top = `${y}px`;
      el.appendChild(onda);
      onda.addEventListener('animationend', () => onda.remove());
    });
  });
}

function initTiltMagnetico(){
  if(PREFERE_MENOS_MOVIMENTO) return;
  if(!window.matchMedia('(hover: hover)').matches) return;

  document.querySelectorAll('.fx-tilt').forEach(botao => {
    let frame = 0;
    let ponteiro = null;
    let rect = null;
    botao.addEventListener('mouseenter', () => { rect = botao.getBoundingClientRect(); });
    botao.addEventListener('mousemove', (e) => {
      ponteiro = e;
      if(frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if(!ponteiro) return;
        rect ||= botao.getBoundingClientRect();
        const meioX = rect.width / 2;
        const meioY = rect.height / 2;
        botao.dataset.cursorX = ((ponteiro.clientX - rect.left - meioX) / meioX).toFixed(2);
        botao.dataset.cursorY = ((ponteiro.clientY - rect.top - meioY) / meioY).toFixed(2);
      });
    }, {passive:true});
    botao.addEventListener('mouseleave', () => { ponteiro = null; rect = null; if(frame) cancelAnimationFrame(frame); frame = 0; });
  });
}

function morfarBotaoSucesso(botao){
  if(!botao) return;
  botao.style.transform = '';
  botao.disabled = true;
  botao.innerHTML = '<span class="btn-morph-check"><svg><use href="#ic-check"></use></svg></span>';
  botao.classList.add('btn-morphing');
}

function calcularForcaSenha(senha){
  let pontos = 0;
  if(senha.length >= 6) pontos++;
  if(senha.length >= 10) pontos++;
  if(/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
  if(/\d/.test(senha)) pontos++;
  if(/[^A-Za-z0-9]/.test(senha)) pontos++;
  return Math.min(pontos, 4);
}

function initMedidorSenha(senhaId = 'senha', meterId = 'pwMeter', fillId = 'pwMeterFill', labelId = 'pwMeterLabel'){
  const senha = document.getElementById(senhaId);
  const meter = document.getElementById(meterId);
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if(!senha || !meter) return;

  const niveis = [
    { cor: 'var(--red)', texto: 'Muito fraca', largura: '15%' },
    { cor: 'var(--red)', texto: 'Fraca', largura: '35%' },
    { cor: 'var(--orange)', texto: 'Razoável', largura: '60%' },
    { cor: 'var(--green)', texto: 'Boa', largura: '82%' },
    { cor: 'var(--green)', texto: 'Excelente', largura: '100%' },
  ];

  senha.addEventListener('input', () => {
    if(!senha.value){
      meter.hidden = true;
      return;
    }
    meter.hidden = false;
    const nivel = niveis[calcularForcaSenha(senha.value)];
    fill.style.width = nivel.largura;
    fill.style.background = nivel.cor;
    label.textContent = `Força da senha: ${nivel.texto}`;
  });
}

function marcarErro(input, mensagemEl, texto){
  if(!input) return;
  input.classList.remove('field-valid');
  input.classList.add('field-invalid');
  if(mensagemEl){ mensagemEl.textContent = texto; mensagemEl.classList.add('show'); }
  input.addEventListener('animationend', () => input.classList.remove('field-invalid'), { once:true });
}

function marcarValido(input, mensagemEl){
  if(!input) return;
  input.classList.remove('field-invalid');
  input.classList.add('field-valid');
  if(mensagemEl){ mensagemEl.textContent=''; mensagemEl.classList.remove('show'); }
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initChecagemEmail(campoId = 'email', erroId = 'erro-email', endpoint = '/api/auth/verificar-email'){
  const campoEmail = document.getElementById(campoId);
  const erroEmail = document.getElementById(erroId);
  if(!campoEmail) return;

  let timeoutId = null;
  let ultimaRequisicaoId = 0;

  campoEmail.addEventListener('input', () => {
    const email = campoEmail.value.trim();
    campoEmail.dataset.emailIndisponivel = '';

    if(timeoutId) clearTimeout(timeoutId);

    if(!REGEX_EMAIL.test(email)){
      // Deixa a validação de formato (feita no submit) cuidar da mensagem;
      // aqui só evita consultar o backend com um e-mail incompleto.
      marcarValido(campoEmail, erroEmail);
      return;
    }

    const requisicaoId = ++ultimaRequisicaoId;
    timeoutId = setTimeout(async () => {
      campoEmail.classList.add('field-checking');
      try{
        const resposta = await fetch(`${endpoint}?email=${encodeURIComponent(email)}`, {
          credentials: 'same-origin'
        });
        const corpo = await resposta.json().catch(() => ({}));

        // Ignora respostas de consultas antigas (usuário já digitou outra coisa).
        if(requisicaoId !== ultimaRequisicaoId) return;
        if(campoEmail.value.trim() !== email) return;

        if(resposta.ok && corpo.disponivel === false){
          campoEmail.dataset.emailIndisponivel = 'true';
          marcarErro(campoEmail, erroEmail, corpo.message || 'Este e-mail já está cadastrado.');
        } else if(resposta.ok && corpo.disponivel === true){
          marcarValido(campoEmail, erroEmail);
        }
      } catch(_e){
        // Falha de rede: não bloqueia o usuário, a validação final acontece no submit.
      } finally {
        if(requisicaoId === ultimaRequisicaoId) campoEmail.classList.remove('field-checking');
      }
    }, 500);
  });
}

function initChecagemCNPJ(){
  const campoCnpj = document.getElementById('cnpj');
  const erroCnpj = document.getElementById('erro-cnpj');
  if(!campoCnpj) return;

  let timeoutId = null;
  let ultimaRequisicaoId = 0;

  campoCnpj.addEventListener('input', () => {
    const cnpj = campoCnpj.value.replace(/\D/g, '');
    campoCnpj.dataset.cnpjIndisponivel = '';

    if(timeoutId) clearTimeout(timeoutId);

    if(cnpj.length !== 14){
      marcarValido(campoCnpj, erroCnpj);
      return;
    }

    const requisicaoId = ++ultimaRequisicaoId;
    timeoutId = setTimeout(async () => {
      campoCnpj.classList.add('field-checking');
      try{
        const resposta = await fetch(`/api/auth/verificar-cnpj?cnpj=${encodeURIComponent(cnpj)}`, {
          credentials: 'same-origin'
        });
        const corpo = await resposta.json().catch(() => ({}));

        if(requisicaoId !== ultimaRequisicaoId) return;
        if(campoCnpj.value.replace(/\D/g, '') !== cnpj) return;

        if(resposta.ok && corpo.disponivel === false){
          campoCnpj.dataset.cnpjIndisponivel = 'true';
          marcarErro(campoCnpj, erroCnpj, corpo.message || 'Este CNPJ já está cadastrado.');
        } else if(resposta.ok && corpo.disponivel === true){
          marcarValido(campoCnpj, erroCnpj);
        } else if(!resposta.ok){
          marcarErro(campoCnpj, erroCnpj, corpo.message || 'Informe um CNPJ válido.');
        }
      } catch(_e){
        // Falha de rede: a validação final acontece no submit.
      } finally {
        if(requisicaoId === ultimaRequisicaoId) campoCnpj.classList.remove('field-checking');
      }
    }, 500);
  });
}

function initValidacaoTelefone(campoId = 'telefoneEmpresa', erroId = 'erro-telefoneEmpresa'){
  const campo = document.getElementById(campoId);
  const erro = document.getElementById(erroId);
  if(!campo) return;

  function validar(){
    const digitos = digitosNacionaisTelefone(campo.value);
    if(!digitos){
      // Campo vazio: a validação de "obrigatório" no submit cuida da mensagem.
      marcarValido(campo, erro);
      return;
    }
    if(digitos.length === 10 || digitos.length === 11){
      marcarValido(campo, erro);
    } else {
      marcarErro(campo, erro, 'Informe um telefone válido.');
    }
  }

  campo.addEventListener('input', validar);
  campo.addEventListener('blur', validar);
}

function initLoginForm(){
  const form = document.getElementById('loginForm');
  if(!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const botao = document.getElementById('submitBtn');
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    alternarCarregando(botao, true, 'Entrar');
    const { ok, corpo } = await enviarJSON('/api/auth/login', { email, senha });
    alternarCarregando(botao, false, 'Entrar');

    if(!ok){
      mostrarAlerta(corpo.message || 'Não foi possível entrar. Tente novamente.', 'error');
      return;
    }

    morfarBotaoSucesso(botao);
    setTimeout(() => irParaDepoisDaAnimacao('/'), PREFERE_MENOS_MOVIMENTO ? 0 : 480);
  });
}

function initAvisoNomeSemelhante(campoId = 'nome', avisoId = 'avisoNomeSemelhante', avisoTextoId = 'avisoNomeSemelhanteTexto', endpoint = '/api/auth/verificar-nome', montarMensagem = (nomeExistente) => `Já existe um usuário cadastrado com um nome parecido (${nomeExistente}). Você ainda pode continuar.`){
  const campoNome = document.getElementById(campoId);
  const aviso = document.getElementById(avisoId);
  const avisoTexto = document.getElementById(avisoTextoId);
  if(!campoNome || !aviso) return;

  let timeoutId = null;
  let ultimaRequisicaoId = 0;

  function esconderAviso(){
    esconderAvisoAnimado(aviso);
  }

  campoNome.addEventListener('input', () => {
    const nome = campoNome.value.trim();
    if(timeoutId) clearTimeout(timeoutId);
    esconderAviso();

    if(nome.length < 3) return;

    const requisicaoId = ++ultimaRequisicaoId;
    timeoutId = setTimeout(async () => {
      try{
        const resposta = await fetch(`${endpoint}?nome=${encodeURIComponent(nome)}`, {
          credentials: 'same-origin'
        });
        const corpo = await resposta.json().catch(() => ({}));

        if(requisicaoId !== ultimaRequisicaoId) return;
        if(campoNome.value.trim() !== nome) return;

        if(resposta.ok && corpo.semelhante){
          avisoTexto.textContent = montarMensagem(corpo.nome_existente);
          mostrarAvisoAnimado(aviso);
        } else {
          esconderAviso();
        }
      } catch(_e){
        // Falha de rede: aviso é só informativo, não impede o cadastro.
      }
    }, 500);
  });
}

function initCadastroForm(){
  const form = document.getElementById('cadastroForm');
  if(!form) return;

  const campoNome = document.getElementById('nome');
  const campoEmail = document.getElementById('email');
  const campoSenha = document.getElementById('senha');
  const campoConfirmar = document.getElementById('confirmarSenha');
  const campoCargo = document.getElementById('cargo');
  const erroNome = document.getElementById('erro-nome');
  const erroEmail = document.getElementById('erro-email');
  const erroConfirmar = document.getElementById('erro-confirmarSenha');
  const erroCargo = document.getElementById('erro-cargo');

  campoConfirmar.addEventListener('input', () => {
    if(!campoConfirmar.value) return;
    if(campoConfirmar.value !== campoSenha.value){
      marcarErro(campoConfirmar, erroConfirmar, 'As senhas não coincidem.');
    } else {
      marcarValido(campoConfirmar, erroConfirmar);
    }
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const nome = campoNome.value.trim();
    const email = campoEmail.value.trim();
    const telefone = telefoneParaEnvio(document.getElementById('telefone').value);
    const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
    const cargo = campoCargo.value.trim();
    const departamento = document.getElementById('departamento').value.trim();
    const senha = campoSenha.value;
    const confirmarSenha = campoConfirmar.value;

    let valido = true;

    if(!nome){
      marcarErro(campoNome, erroNome, 'Informe seu nome completo.');
      valido = false;
    } else {
      marcarValido(campoNome, erroNome);
    }

    if(!REGEX_EMAIL.test(email)){
      marcarErro(campoEmail, erroEmail, 'Informe um e-mail válido.');
      valido = false;
    } else if(campoEmail.dataset.emailIndisponivel === 'true'){
      marcarErro(campoEmail, erroEmail, 'Este e-mail já está cadastrado.');
      valido = false;
    } else {
      marcarValido(campoEmail, erroEmail);
    }

    if(!cargo){
      marcarErro(campoCargo, erroCargo, 'Selecione seu cargo na empresa.');
      valido = false;
    } else {
      marcarValido(campoCargo, erroCargo);
    }

    if(senha !== confirmarSenha){
      marcarErro(campoConfirmar, erroConfirmar, 'As senhas não coincidem.');
      valido = false;
    }

    if(!valido) return;

    const botao = document.getElementById('submitBtn');
    alternarCarregando(botao, true, 'Criar conta');
    const { ok, corpo } = await enviarJSON('/api/auth/cadastro', {
      nome, email, senha, telefone, cpf, cargo, departamento
    });
    alternarCarregando(botao, false, 'Criar conta');

    if(!ok){
      mostrarAlerta(corpo.message || 'Não foi possível concluir o cadastro.', 'error');
      return;
    }

    morfarBotaoSucesso(botao);
    setTimeout(() => irParaDepoisDaAnimacao('/'), PREFERE_MENOS_MOVIMENTO ? 0 : 480);
  });
}

function initTabsCadastro(){
  const tabPessoa = document.getElementById('tabPessoa');
  const tabEmpresa = document.getElementById('tabEmpresa');
  const formPessoa = document.getElementById('cadastroForm');
  const formEmpresa = document.getElementById('cadastroEmpresaForm');
  const titulo = document.getElementById('cadastroTitulo');
  const subtitulo = document.getElementById('cadastroSubtitulo');
  if(!tabPessoa || !tabEmpresa || !formPessoa || !formEmpresa) return;

  const textos = {
    pessoa: {
      titulo: 'Criar conta',
      subtitulo: 'Leva menos de dois minutos para começar a monitorar sua infraestrutura com o Nexus Air.',
    },
    empresa: {
      titulo: 'Cadastrar empresa',
      subtitulo: 'Cadastre sua empresa e crie o acesso do responsável pela conta no Nexus Air.',
    },
  };

  function selecionar(tipo){
    const ehEmpresa = tipo === 'empresa';

    tabPessoa.classList.toggle('is-active', !ehEmpresa);
    tabEmpresa.classList.toggle('is-active', ehEmpresa);
    tabPessoa.setAttribute('aria-selected', String(!ehEmpresa));
    tabEmpresa.setAttribute('aria-selected', String(ehEmpresa));

    formPessoa.hidden = ehEmpresa;
    formEmpresa.hidden = !ehEmpresa;

    if(titulo) titulo.textContent = textos[tipo].titulo;
    if(subtitulo) subtitulo.textContent = textos[tipo].subtitulo;

    esconderAvisoAnimado(document.getElementById('formAlert'));
    esconderAvisoAnimado(document.getElementById('avisoNomeSemelhante'));
    esconderAvisoAnimado(document.getElementById('avisoNomeEmpresaSemelhante'));
  }

  tabPessoa.addEventListener('click', () => selecionar('pessoa'));
  tabEmpresa.addEventListener('click', () => selecionar('empresa'));
}

function initCadastroEmpresaForm(){
  const form = document.getElementById('cadastroEmpresaForm');
  if(!form) return;

  const campoNomeEmpresa = document.getElementById('nomeEmpresa');
  const campoCnpj = document.getElementById('cnpj');
  const campoTelefoneEmpresa = document.getElementById('telefoneEmpresa');
  const campoEmailEmpresa = document.getElementById('emailEmpresa');
  const campoEndereco = document.getElementById('enderecoEmpresa');
  const campoNomeResponsavel = document.getElementById('nomeResponsavel');
  const campoSenha = document.getElementById('senhaEmpresa');
  const campoConfirmar = document.getElementById('confirmarSenhaEmpresa');

  const erroNomeEmpresa = document.getElementById('erro-nomeEmpresa');
  const erroCnpj = document.getElementById('erro-cnpj');
  const erroTelefoneEmpresa = document.getElementById('erro-telefoneEmpresa');
  const erroEmailEmpresa = document.getElementById('erro-emailEmpresa');
  const erroEndereco = document.getElementById('erro-enderecoEmpresa');
  const erroNomeResponsavel = document.getElementById('erro-nomeResponsavel');
  const erroConfirmar = document.getElementById('erro-confirmarSenhaEmpresa');

  campoConfirmar.addEventListener('input', () => {
    if(!campoConfirmar.value) return;
    if(campoConfirmar.value !== campoSenha.value){
      marcarErro(campoConfirmar, erroConfirmar, 'As senhas não coincidem.');
    } else {
      marcarValido(campoConfirmar, erroConfirmar);
    }
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const nome_empresa = campoNomeEmpresa.value.trim();
    const cnpj = campoCnpj.value.replace(/\D/g, '');
    const telefone = telefoneParaEnvio(campoTelefoneEmpresa.value);
    const digitosTelefoneEmpresa = digitosNacionaisTelefone(campoTelefoneEmpresa.value);
    const email = campoEmailEmpresa.value.trim();
    const endereco = campoEndereco.value.trim();
    const setor = document.getElementById('setorEmpresa').value.trim();
    const departamentos = document.getElementById('departamentosEmpresa').value.trim();
    const nome_responsavel = campoNomeResponsavel.value.trim();
    const senha = campoSenha.value;
    const confirmarSenha = campoConfirmar.value;

    let valido = true;

    if(!nome_empresa){
      marcarErro(campoNomeEmpresa, erroNomeEmpresa, 'Informe o nome da empresa.');
      valido = false;
    } else {
      marcarValido(campoNomeEmpresa, erroNomeEmpresa);
    }

    if(cnpj.length !== 14){
      marcarErro(campoCnpj, erroCnpj, 'Informe um CNPJ válido.');
      valido = false;
    } else if(campoCnpj.dataset.cnpjIndisponivel === 'true'){
      marcarErro(campoCnpj, erroCnpj, 'Este CNPJ já está cadastrado.');
      valido = false;
    } else {
      marcarValido(campoCnpj, erroCnpj);
    }

    if(digitosTelefoneEmpresa.length !== 10 && digitosTelefoneEmpresa.length !== 11){
      marcarErro(campoTelefoneEmpresa, erroTelefoneEmpresa, digitosTelefoneEmpresa ? 'Informe um telefone válido.' : 'Informe o telefone da empresa.');
      valido = false;
    } else {
      marcarValido(campoTelefoneEmpresa, erroTelefoneEmpresa);
    }

    if(!REGEX_EMAIL.test(email)){
      marcarErro(campoEmailEmpresa, erroEmailEmpresa, 'Informe um e-mail válido.');
      valido = false;
    } else if(campoEmailEmpresa.dataset.emailIndisponivel === 'true'){
      marcarErro(campoEmailEmpresa, erroEmailEmpresa, 'Este e-mail já está cadastrado.');
      valido = false;
    } else {
      marcarValido(campoEmailEmpresa, erroEmailEmpresa);
    }

    if(!endereco){
      marcarErro(campoEndereco, erroEndereco, 'Informe o endereço da empresa.');
      valido = false;
    } else {
      marcarValido(campoEndereco, erroEndereco);
    }

    if(!nome_responsavel){
      marcarErro(campoNomeResponsavel, erroNomeResponsavel, 'Informe o nome do responsável.');
      valido = false;
    } else {
      marcarValido(campoNomeResponsavel, erroNomeResponsavel);
    }

    if(senha.length < 6){
      valido = false;
    }

    if(senha !== confirmarSenha){
      marcarErro(campoConfirmar, erroConfirmar, 'As senhas não coincidem.');
      valido = false;
    }

    if(!valido) return;

    const botao = document.getElementById('submitBtnEmpresa');
    alternarCarregando(botao, true, 'Cadastrar empresa');
    const { ok, corpo } = await enviarJSON('/api/auth/cadastro-empresa', {
      nome_empresa, cnpj, telefone, email, endereco, setor, departamentos,
      nome_responsavel, senha
    });
    alternarCarregando(botao, false, 'Cadastrar empresa');

    if(!ok){
      mostrarAlerta(corpo.message || 'Não foi possível concluir o cadastro da empresa.', 'error');
      return;
    }

    morfarBotaoSucesso(botao);
    setTimeout(() => irParaDepoisDaAnimacao('/'), PREFERE_MENOS_MOVIMENTO ? 0 : 480);
  });
}

window.NexusInitAuth = ()=>{
  initLoginForm();
  initCadastroForm();
  initCadastroEmpresaForm();
  initTabsCadastro();
  initChecagemEmail('email', 'erro-email', '/api/auth/verificar-email');
  initChecagemEmail('emailEmpresa', 'erro-emailEmpresa', '/api/auth/verificar-email-empresa');
  initChecagemCNPJ();
  initValidacaoTelefone('telefoneEmpresa', 'erro-telefoneEmpresa');
  initAvisoNomeSemelhante('nome', 'avisoNomeSemelhante', 'avisoNomeSemelhanteTexto', '/api/auth/verificar-nome',
    (nomeExistente) => `Já existe um usuário cadastrado com um nome parecido (${nomeExistente}). Você ainda pode continuar.`);
  initAvisoNomeSemelhante('nomeEmpresa', 'avisoNomeEmpresaSemelhante', 'avisoNomeEmpresaSemelhanteTexto', '/api/auth/verificar-nome-empresa',
    (nomeExistente) => `Já existe uma empresa cadastrada com um nome parecido (${nomeExistente}). Você ainda pode continuar.`);
  initMascaras();
  initTogglesSenha();
  initMedidorSenha('senha', 'pwMeter', 'pwMeterFill', 'pwMeterLabel');
  initMedidorSenha('senhaEmpresa', 'pwMeterEmpresa', 'pwMeterEmpresaFill', 'pwMeterEmpresaLabel');
  initRipple();
  initTiltMagnetico();
};

window.addEventListener('DOMContentLoaded', window.NexusInitAuth);

