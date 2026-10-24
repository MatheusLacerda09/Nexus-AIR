(function(){
  'use strict';

  const rotas = new Set(['/', '/entrar', '/criar-conta']);
  let navegando = false;
  let pendente = null;   // destino pedido pela seta do navegador enquanto outra troca ainda rodava

  function normalizar(url){
    const valor = new URL(url, window.location.origin);
    return valor.origin === window.location.origin ? valor.pathname : null;
  }

  // O roteador só troca o <body>; sem isto, os CSS que existem apenas no <head>
  // da tela de destino (ex.: ajustes-finais.css do painel) nunca eram carregados
  // quando se chegava lá pelo login. Anexa os que faltam e espera carregarem.
  function carregarEstilosFaltantes(documento){
    const chave = href => { try{ return new URL(href, window.location.origin).pathname; }catch(e){ return href; } };
    const existentes = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>chave(l.getAttribute('href'))));
    const pendentes = [];
    documento.querySelectorAll('link[rel="stylesheet"]').forEach(origem=>{
      const href = origem.getAttribute('href');
      if(!href || existentes.has(chave(href))) return;
      existentes.add(chave(href));
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      pendentes.push(new Promise(resolve=>{
        link.addEventListener('load', resolve, { once:true });
        link.addEventListener('error', resolve, { once:true });
        setTimeout(resolve, 2500);
      }));
      document.head.appendChild(link);
    });
    return Promise.all(pendentes);
  }

  // O mesmo problema vale para scripts: login.html e cadastro.html não carregam alguns
  // scripts do painel (selects.js, automation.js, agendamentos.js, idioma.js...), e os
  // <script> de um body trocado não rodam. Resultado: quem entrava pelo login via listas
  // nativas (azul do navegador) e telas sem a lógica. Aqui carregamos, em ordem, os que
  // a tela de destino pede e ainda não existem. A abertura tem carregamento próprio.
  // Registro dos scripts que de fato rodaram. Não dá para olhar o DOM: depois de trocar o
  // body, os <script> da tela nova estão lá, mas inertes (nunca executaram).
  const scriptsRodados = new Set();
  const caminhoScript = src => { try{ return new URL(src, window.location.origin).pathname; }catch(e){ return src; } };
  const registrarScriptsDaPagina = () => document.querySelectorAll('script[src]').forEach(sc=>scriptsRodados.add(caminhoScript(sc.getAttribute('src'))));
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registrarScriptsDaPagina, { once:true });
  else registrarScriptsDaPagina();

  // Lê quais scripts faltam. Precisa rodar ANTES de trocar o body: replaceWith move o body
  // para fora do documento analisado e a lista ficaria vazia.
  function listarScriptsFaltantes(documento){
    const fila = [];
    documento.querySelectorAll('script[src]').forEach(origem=>{
      const src = origem.getAttribute('src');
      if(!src) return;
      const caminho = caminhoScript(src);
      if(scriptsRodados.has(caminho) || caminho.endsWith('/abertura.js')) return;
      fila.push(src);
    });
    return fila;
  }

  function carregarScripts(fila){
    fila.forEach(src=>scriptsRodados.add(caminhoScript(src)));
    return fila.reduce((anterior, src)=>anterior.then(()=>new Promise(resolve=>{
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      let fim = false;
      const acabou = ()=>{ if(!fim){ fim = true; resolve(); } };
      script.addEventListener('load', acabou, { once:true });
      script.addEventListener('error', acabou, { once:true });
      setTimeout(acabou, 4000);
      document.head.appendChild(script);
    })), Promise.resolve());
  }

  // abertura.js só vem no HTML do painel (e scripts de um body trocado não rodam).
  // Quem chega pelo login e volta para "/" precisaria dele: carrega sob demanda.
  function carregarAbertura(){
    if(window.NexusInitAbertura) return Promise.resolve();
    return new Promise(resolve=>{
      const script = document.createElement('script');
      script.src = '/js/abertura.js?v=20261022-abertura6';
      scriptsRodados.add('/js/abertura.js');
      script.addEventListener('load', resolve, { once:true });
      script.addEventListener('error', resolve, { once:true });
      document.head.appendChild(script);
    });
  }

  async function prepararAbertura(viaHistorico){
    const splash = document.getElementById('nexusSplash');
    if(!splash) return;
    if(viaHistorico){
      // Voltou (seta do navegador) até a abertura: ela precisa nascer de novo, completa.
      window.__NexusSplashShown = false;
      window.NexusSplashCleanup?.();
      splash.classList.remove('is-hidden', 'is-leaving');
      splash.removeAttribute('aria-hidden');
      await carregarAbertura();
      window.NexusInitAbertura?.();
      if(!window.NexusInitAbertura) splash.classList.add('is-hidden'); // sem o script, melhor não cobrir a tela
    }else{
      // Navegação normal (ex.: depois do login): a abertura já foi vista.
      splash.classList.add('is-hidden');
      splash.setAttribute('aria-hidden', 'true');
    }
  }

  async function aplicarDocumento(html, caminho, viaHistorico){
    const documento = new DOMParser().parseFromString(html, 'text/html');
    const novoBody = documento.body;
    if(!novoBody) throw new Error('Tela inválida');
    await carregarEstilosFaltantes(documento);
    const scriptsFaltantes = listarScriptsFaltantes(documento);
    document.title = documento.title;
    document.body.replaceWith(novoBody);
    document.body.className = novoBody.className;
    window.scrollTo(0, 0);
    await carregarScripts(scriptsFaltantes);
    window.NexusSons?.syncControls();
    window.NexusInitTema?.();
    window.NexusInitTopo?.();
    if(caminho === '/'){
      await prepararAbertura(viaHistorico);
      window.NexusInitDashboard?.();
    }
    else window.NexusInitAuth?.();
    document.dispatchEvent(new CustomEvent('nexusRotaAlterada', { detail:{ caminho } }));
  }

  async function irPara(url, registrar=true){
    const caminho = normalizar(url);
    if(!caminho || !rotas.has(caminho)) return false;
    if(navegando){ if(!registrar) pendente = caminho; return false; }
    navegando = true;
    try{
      const resposta = await fetch(caminho, { credentials:'same-origin', cache:'no-store' });
      if(!resposta.ok) throw new Error('Falha ao carregar tela');
      await aplicarDocumento(await resposta.text(), caminho, !registrar);
      if(registrar) history.pushState({ caminho }, '', caminho);
      return true;
    }catch(e){
      window.location.href = caminho;
      return false;
    }finally{
      navegando = false;
      if(pendente && pendente !== window.location.pathname){ pendente = null; irPara(window.location.pathname, false); }
      else pendente = null;
    }
  }

  window.NexusRouter = { go: irPara };

  // Antes de trocar login <-> cadastro, toca a animação de saída do cartão
  // (sem isso a tela sumia de uma vez e a nova entrava "do nada").
  let saindo = false;
  function sairDaTelaAuth(){
    return new Promise(resolve=>{
      const shell = document.querySelector('.auth-shell');
      if(!shell || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return resolve();
      shell.classList.add('auth-shell--leaving');
      let feito = false;
      const fim = ()=>{ if(!feito){ feito = true; resolve(); } };
      shell.addEventListener('animationend', e=>{
        if(e.target === shell && e.animationName === 'authShellOut') fim();
      });
      setTimeout(fim, 700);
    });
  }

  document.addEventListener('click', event=>{
    const link = event.target.closest('a[href]');
    if(!link || event.defaultPrevented || link.target === '_blank' || link.hasAttribute('download')) return;
    if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const caminho = normalizar(link.href);
    if(!caminho || !rotas.has(caminho)) return;
    event.preventDefault();
    if(saindo || navegando) return;
    saindo = true;
    sairDaTelaAuth().then(()=>irPara(caminho)).finally(()=>{ saindo = false; });
  }, true);

  window.addEventListener('popstate', ()=>irPara(window.location.pathname, false));

  // Voltou de uma página guardada pelo navegador (cache de ida e volta): se a abertura
  // ficou visível mas "morta" (sem a lógica ligada), liga de novo.
  window.addEventListener('pageshow', event=>{
    if(!event.persisted) return;
    const splash = document.getElementById('nexusSplash');
    if(splash && !splash.classList.contains('is-hidden') && splash.dataset.initialized !== 'true') prepararAbertura(true);
  });
})();
