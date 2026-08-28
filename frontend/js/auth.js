function mostrarAlerta(mensagem, tipo){
  const alerta = document.getElementById('formAlert');
  if(!alerta) return;
  alerta.textContent = mensagem;
  alerta.className = `form-alert form-alert-${tipo}`;
  alerta.hidden = false;
}

function alternarCarregando(botao, carregando, textoNormal){
  botao.disabled = carregando;
  botao.textContent = carregando ? 'Aguarde...' : textoNormal;
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

    window.location.href = '/';
  });
}

function initCadastroForm(){
  const form = document.getElementById('cadastroForm');
  if(!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const botao = document.getElementById('submitBtn');
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if(senha !== confirmarSenha){
      mostrarAlerta('As senhas não coincidem.', 'error');
      return;
    }

    alternarCarregando(botao, true, 'Criar conta');
    const { ok, corpo } = await enviarJSON('/api/auth/cadastro', { nome, email, senha });
    alternarCarregando(botao, false, 'Criar conta');

    if(!ok){
      mostrarAlerta(corpo.message || 'Não foi possível concluir o cadastro.', 'error');
      return;
    }

    window.location.href = '/';
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  initLoginForm();
  initCadastroForm();
});
