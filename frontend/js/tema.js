function obterTemaAtual(){
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function aplicarPaletaSalva(){
  try{
    const paleta = localStorage.getItem('nexusAccentGlobal1');
    if(['violet','ocean','emerald','sunset','rose'].includes(paleta)){
      document.documentElement.setAttribute('data-accent', paleta);
    }
  }catch(e){  }
}

const NEXUS_SCROLLBAR_KEY = 'nexusScrollbarStyle';
const NEXUS_SCROLLBAR_STYLES = new Set(['glow','solid','minimal']);
function aplicarScrollbarEstilo(estilo, persistir=true){
  const valor = NEXUS_SCROLLBAR_STYLES.has(estilo) ? estilo : 'glow';
  document.documentElement.setAttribute('data-scrollbar', valor);
  document.querySelectorAll('[data-scrollbar-choice]').forEach(botao=>botao.classList.toggle('is-active', botao.dataset.scrollbarChoice === valor));
  if(persistir){ try{ localStorage.setItem(NEXUS_SCROLLBAR_KEY, valor); }catch(e){} }
}

function aplicarScrollbarSalva(){
  aplicarScrollbarEstilo('glow', false);
  try{ localStorage.removeItem(NEXUS_SCROLLBAR_KEY); }catch(e){}
}

function atualizarControlesDeTema(tema){
  const escuro = tema === 'dark';
  const texto = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';
  document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn').forEach(botao=>{
    botao.setAttribute('aria-pressed', String(escuro));
    botao.setAttribute('aria-label', texto);
    botao.setAttribute('title', texto);
  });
}

function aplicarTema(tema, persistir){
  if(tema === 'dark'){
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  if(persistir){
    try{ localStorage.setItem('nexusTheme', tema); }catch(e){  }
  }
  atualizarControlesDeTema(tema);
  document.querySelectorAll('.theme-switch-input, #themeSwitchInput').forEach(input=>{
    input.checked = tema === 'dark';
  });
  document.dispatchEvent(new CustomEvent('temaAlterado', { detail:{ tema, persistir } }));
}

function centroDoElemento(elemento){
  const rect = elemento.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

let timeoutFadeFallback = null;
function aplicarTemaComFadeSimples(tema){
  clearTimeout(timeoutFadeFallback);
  document.documentElement.classList.add('theme-fade');
  aplicarTema(tema, true);
  timeoutFadeFallback = setTimeout(()=> document.documentElement.classList.remove('theme-fade'), 200);
}

function aplicarTemaComTransicao(tema, origem){
  const suportaViewTransition = typeof document.startViewTransition === 'function';
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(reduzMovimento){
    aplicarTemaComFadeSimples(tema);
    return;
  }
  if(!suportaViewTransition || !origem){
    aplicarTemaComFadeSimples(tema);
    return;
  }

  const raio = Math.hypot(
    Math.max(origem.x, window.innerWidth - origem.x),
    Math.max(origem.y, window.innerHeight - origem.y)
  );

  document.documentElement.setAttribute('data-vt-theme', '');
  const transicao = document.startViewTransition(()=> aplicarTema(tema, true));

  transicao.ready
    .then(()=>{
      document.documentElement.animate(
        {
          clipPath:[
            `circle(0px at ${origem.x}px ${origem.y}px)`,
            `circle(${raio}px at ${origem.x}px ${origem.y}px)`
          ]
        },
        { duration:220, easing:'cubic-bezier(.4,0,.2,1)', pseudoElement:'::view-transition-new(root)' }
      );
    })
    .catch(()=>{  });

  transicao.finished.finally(()=> document.documentElement.removeAttribute('data-vt-theme'));
}

function initTema(){
  const botoes = document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn');
  const switches = document.querySelectorAll('.theme-switch-input, #themeSwitchInput');

  // Garante o estado visual (botão/switch) coerente com o que já foi
  // aplicado antes do parse do body (ver script inline anti-flash).
  aplicarPaletaSalva();
  aplicarScrollbarSalva();
  aplicarTema(obterTemaAtual(), false);

  botoes.forEach(botao => botao.addEventListener('click', ()=>{
    const novoTema = obterTemaAtual() === 'dark' ? 'light' : 'dark';
    aplicarTemaComTransicao(novoTema, centroDoElemento(botao));
  }));

  switches.forEach(input => input.addEventListener('change', ()=>{
    const novoTema = input.checked ? 'dark' : 'light';
    const alvoVisual = input.closest('.theme-switch')?.querySelector('.theme-switch-track') || input;
    aplicarTemaComTransicao(novoTema, centroDoElemento(alvoVisual));
  }));

  document.querySelectorAll('[data-scrollbar-choice]').forEach(botao=>botao.addEventListener('click', ()=>{
    aplicarScrollbarEstilo(botao.dataset.scrollbarChoice);
    document.dispatchEvent(new CustomEvent('scrollbarAlterada', { detail:{ estilo:botao.dataset.scrollbarChoice } }));
  }));
}

window.NexusSetTheme = (tema)=> aplicarTemaComTransicao(tema, null);
window.NexusSetScrollbarStyle = aplicarScrollbarEstilo;
window.NexusInitTema = initTema;
window.addEventListener('DOMContentLoaded', window.NexusInitTema);

