(function(){
  'use strict';

  const SOUND_KEY = 'nexusSoundsEnabled';
  const MUSIC_ENABLED_KEY = 'nexusMusicEnabled';
  const MUSIC_VOLUME_KEY = 'nexusMusicVolume';
  const MUSIC_VOLUME_VERSION_KEY = 'nexusMusicVolumeVersion';
  const MUSIC_KEY = 'nexusMusicState';
  const MUSIC_PLAYING_KEY = 'nexusMusicPlaying';
  const BASE = '/assets/sounds/';
  const REQUESTED = `${BASE}pixabay-requested/`;
  const MUSIC_BASE = '/assets/music/';
  const MUSIC_VOLUME_DEFAULT = .14;

  const arquivos = {
    click: `${BASE}click.mp3`,
    confirm: `${BASE}confirm.mp3`,
    open: `${BASE}open.mp3`,
    close: `${BASE}slide-out.mp3`,
    tab: `${BASE}notification.mp3`,
    page: `${BASE}slide-in.mp3`,
    off: `${BASE}off.mp3`,
    error: `${BASE}error.mp3`,
    softPop: `${BASE}soft-pop.mp3`,
    debug: `${BASE}debug-ui.mp3`,
    whoosh: `${BASE}whoosh3.mp3`,
    packTwo: `${BASE}ui-pack-2-sound-2.mp3`,
    packFour: `${BASE}ui-pack-2-sound-4.mp3`,
    whip: `${BASE}whip.mp3`,
    appNotification: `${BASE}app-notification.mp3`,
    popupClose: `${BASE}popup-close.mp3`,
    swipeConfirm: `${REQUESTED}ui-swipe-confirm-522221.mp3`,
    menuSlideOut: `${REQUESTED}ui-menu-slide-out-516941.mp3`,
    deepChime: `${REQUESTED}deep-ui-chime-585839.mp3`,
    chimeConfirm: `${REQUESTED}ui-chime-confirm-567486.mp3`,
    chimeAlert: `${REQUESTED}ui-chime-alert-554690.mp3`,
    chimeNotification: `${REQUESTED}ui-chime-notification-553111.mp3`,
    chimeSuccess: `${REQUESTED}ui-chime-success-551841.mp3`,
    accessGranted: `${REQUESTED}ui-access-granted-534603.mp3`,
    modalClose: `${REQUESTED}ui-modal-close-soft-tap-523151.mp3`,
    swipeNavigation: `${REQUESTED}ui-swipe-navigation-soft-523625.mp3`,
    notificationPop: `${REQUESTED}ui-notification-pop-minimal-523149.mp3`,
    loadingEndSuccess: `${REQUESTED}ui-loading-end-success-522861.mp3`,
    loadingEndFail: `${REQUESTED}ui-loading-end-fail-522858.mp3`,
    loadingStart: `${REQUESTED}ui-loading-start-522857.mp3`,
    swipeCancel: `${REQUESTED}ui-swipe-cancel-522217.mp3`,
    dropSuccess: `${REQUESTED}ui-drop-success-521938.mp3`,
    tapMedium: `${REQUESTED}ui-button-tap-medium-525032.mp3`,
    tapLow: `${REQUESTED}ui-button-tap-low-525031.mp3`,
    tapHigh: `${REQUESTED}ui-button-tap-high-525030.mp3`,
    menuSlideIn: `${REQUESTED}ui-menu-slide-in-516940.mp3`,
    switchOff: `${REQUESTED}ui-switch-off-516361.mp3`,
    switchOn: `${REQUESTED}ui-switch-on-516359.mp3`,
    clickHard: `${REQUESTED}ui-click-hard-514141.mp3`,
    clickSoft: `${REQUESTED}ui-click-soft-512213.mp3`,
    clickBright: `${REQUESTED}ui-click-bright-512212.mp3`,
    clickDeep: `${REQUESTED}ui-click-deep-512211.mp3`
  };

  const playlist = [
    `${MUSIC_BASE}abyss.mp3`,
    `${MUSIC_BASE}clouds.mp3`,
    `${MUSIC_BASE}dark-beach.mp3`,
    `${MUSIC_BASE}embrace.mp3`,
    `${MUSIC_BASE}iris.mp3`,
    `${MUSIC_BASE}lilacs.mp3`,
    `${MUSIC_BASE}shadows.mp3`,
    `${MUSIC_BASE}skeleton.mp3`,
    `${MUSIC_BASE}silhouette.mp3`,
    `${MUSIC_BASE}when-you-sleep.mp3`
  ];

  const players = {};
  const fadeConfig = {
    menuSlideIn: { in: .055, out: .12 },
    menuSlideOut: { in: .035, out: .16 },
    modalClose: { in: .025, out: .12 },
    swipeNavigation: { in: .04, out: .13 },
    loadingStart: { in: .06, out: .10 },
    loadingEndSuccess: { in: .03, out: .16 },
    loadingEndFail: { in: .02, out: .13 },
    whoosh: { in: .03, out: .14 },
    deepChime: { in: .025, out: .20 },
    chimeSuccess: { in: .02, out: .18 },
    accessGranted: { in: .02, out: .18 }
  };

  let enabled = true;
  let musicEnabled = true;
  let musicVolume = MUSIC_VOLUME_DEFAULT;
  let musicAudio = null;
  let musicIndex = -1;
  let musicTimer = null;
  let musicFadeTimer = null;
  let musicStarted = false;
  let musicResumeOnLoad = true;
  let musicChanging = false;
  // Intenção de estar tocando: evita o ícone voltar para "play" no intervalo
  // em que a nova faixa (ao pular/voltar) ainda está carregando.
  let musicQuerTocar = false;
  let volumeSaveTimer = null;
  let playedTracks = [];
  let historico = [];
  let posHistorico = -1;

  try{
    enabled = localStorage.getItem(SOUND_KEY) !== 'false';
    musicEnabled = localStorage.getItem(MUSIC_ENABLED_KEY) !== 'false';
    musicResumeOnLoad = localStorage.getItem(MUSIC_PLAYING_KEY) !== 'false';
    const volumeSalvoRaw = localStorage.getItem(MUSIC_VOLUME_KEY);
    if(volumeSalvoRaw !== null){
      const volumeSalvo = Number(volumeSalvoRaw);
      const versaoVolume = localStorage.getItem(MUSIC_VOLUME_VERSION_KEY);
      if(Number.isFinite(volumeSalvo)){
        // A versão anterior podia gravar 0% ao iniciar sem preferência.
        // Corrige esse caso uma única vez; depois, 0% escolhido pelo usuário é respeitado.
        musicVolume = volumeSalvo === 0 && versaoVolume !== '2'
          ? MUSIC_VOLUME_DEFAULT
          : Math.max(0, Math.min(1, volumeSalvo));
      }
    }
    localStorage.setItem(MUSIC_VOLUME_VERSION_KEY, '2');
  }catch(e){}
  try{
    const navigation = performance.getEntriesByType('navigation')[0];
    if(navigation?.type === 'reload') sessionStorage.removeItem(MUSIC_KEY);
  }catch(e){}

  function carregar(tipo){
    if(!players[tipo]){
      const audio = new Audio(arquivos[tipo]);
      audio.preload = 'auto';
      players[tipo] = audio;
    }
    return players[tipo];
  }

  function volumeBase(tipo){
    if(tipo === 'off' || tipo === 'switchOff') return .10;
    if(tipo === 'deepChime' || tipo === 'whoosh' || tipo === 'swipeNavigation') return .13;
    if(tipo === 'clickSoft' || tipo === 'tapLow') return .12;
    return .15;
  }

  function tocar(tipo='click'){
    if(!enabled || !arquivos[tipo]) return;
    const audio = carregar(tipo);
    const base = volumeBase(tipo);
    const fade = fadeConfig[tipo];
    audio.pause();
    audio.currentTime = 0;
    audio.volume = fade ? 0 : base;
    audio.play().then(()=>{
      if(!fade) return;
      const inicio = performance.now();
      const animar = agora => {
        if(audio.paused) return;
        const decorrido = (agora - inicio) / 1000;
        const restante = Number.isFinite(audio.duration) ? audio.duration - audio.currentTime : Infinity;
        let fator = 1;
        if(decorrido < fade.in) fator = decorrido / fade.in;
        if(restante < fade.out) fator = Math.min(fator, Math.max(0, restante / fade.out));
        audio.volume = Math.max(0, Math.min(base, base * fator));
        if(!audio.ended) requestAnimationFrame(animar);
      };
      requestAnimationFrame(animar);
    }).catch(()=>{});
  }

  function lerEstadoMusica(){
    try{ return JSON.parse(sessionStorage.getItem(MUSIC_KEY) || 'null'); }catch(e){ return null; }
  }

  function salvarEstadoMusica(){
    if(!musicAudio || musicIndex < 0) return;
    try{
      sessionStorage.setItem(MUSIC_KEY, JSON.stringify({
        index: musicIndex,
        position: musicAudio.currentTime || 0,
        played: playedTracks
      }));
    }catch(e){}
  }

  function limparFade(){
    if(musicFadeTimer){ clearInterval(musicFadeTimer); musicFadeTimer = null; }
  }

  function escolherProxima(){
    const disponiveis = playlist.map((_, index)=>index).filter(index=>!playedTracks.includes(index));
    if(!disponiveis.length){ playedTracks = []; return Math.floor(Math.random() * playlist.length); }
    return disponiveis[Math.floor(Math.random() * disponiveis.length)];
  }

  function iniciarFaixa(index, position=0){
    limparFade();
    musicChanging = false;
    const retomando = position > 0;
    if(musicAudio){ musicAudio.pause(); musicAudio.removeAttribute('src'); musicAudio.load(); }
    musicIndex = index;
    musicQuerTocar = true;
    playedTracks = [...new Set([...playedTracks, index])];
    musicAudio = new Audio(playlist[index]);
    musicAudio.preload = 'auto';
    const faixaAtual = musicAudio;
    ['play','playing','pause'].forEach(evento=>faixaAtual.addEventListener(evento, ()=>{
      if(faixaAtual === musicAudio) document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
    }));
    document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
    musicAudio.volume = retomando ? musicVolume : 0;
    let playRequested = false;
    const reproduzirFaixa = ()=>{
      if(playRequested || !musicAudio || faixaAtual !== musicAudio) return;
      // O usuário pausou enquanto a faixa ainda carregava: não toca sozinha depois.
      if(!musicQuerTocar) return;
      playRequested = true;
      if(position > 0 && Number.isFinite(musicAudio.duration) && position < musicAudio.duration - 1) musicAudio.currentTime = position;
      musicAudio.muted = false;
      musicAudio.volume = retomando ? musicVolume : 0;
      musicAudio.play().then(()=>{
        if(!retomando) fadeMusica(musicVolume, 1.8);
      }).catch(()=>{
        playRequested = false;
        musicStarted = false;
        musicQuerTocar = false;
        document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
      });
    };
    musicAudio.addEventListener('loadedmetadata', reproduzirFaixa, { once:true });
    musicAudio.addEventListener('canplay', reproduzirFaixa, { once:true });
    musicAudio.addEventListener('error', ()=>iniciarFaixa(escolherProxima()));
    musicAudio.load();
  }

  function fadeMusica(alvo, duracao, aoFinal){
    limparFade();
    const inicio = musicAudio ? musicAudio.volume : 0;
    const comeco = performance.now();
    musicFadeTimer = setInterval(()=>{
      if(!musicAudio){ limparFade(); return; }
      const proporcao = Math.min(1, (performance.now() - comeco) / (duracao * 1000));
      musicAudio.volume = inicio + (alvo - inicio) * proporcao;
      if(proporcao >= 1){
        limparFade();
        if(aoFinal) aoFinal();
      }
    }, 50);
  }

  function trocarMusica(){
    if(!musicAudio || !musicEnabled || musicChanging) return;
    musicChanging = true;
    const antiga = musicAudio;
    fadeMusica(0, 4, ()=>{
      antiga.pause();
      const proxima = escolherProxima();
      registrarHistorico(proxima);
      iniciarFaixa(proxima);
    });
  }

  function monitorarMusica(){
    if(musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(()=>{
      if(!musicAudio || musicAudio.paused) return;
      salvarEstadoMusica();
      if(Number.isFinite(musicAudio.duration) && musicAudio.duration - musicAudio.currentTime <= 4.2) trocarMusica();
    }, 1000);
  }

  function iniciarMusica(){
    if(!musicEnabled) return;
    try{ localStorage.setItem(MUSIC_PLAYING_KEY, 'true'); }catch(e){}
    // O carregamento automático pode ser bloqueado pelo navegador. No clique
    // do botão da abertura, tenta reproduzir novamente o mesmo elemento.
    if(musicAudio && musicAudio.paused){
      limparFade();
      musicChanging = false;
      musicAudio.muted = false;
      musicAudio.volume = Math.max(musicAudio.volume, musicVolume);
      musicQuerTocar = true;
      musicStarted = true;
      const faixa = musicAudio;
      faixa.play().then(()=>{
        musicStarted = true;
        document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
      }).catch(()=>{
        musicStarted = false;
        musicQuerTocar = false;
        // Faixa com erro ou sem arquivo carregado: em vez de ficar "muda", sorteia outra.
        if(faixa === musicAudio && (faixa.error || !faixa.src)){ iniciarFaixa(escolherProxima()); monitorarMusica(); return; }
        document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
      });
      monitorarMusica();
      return;
    }
    if(musicStarted) return;
    musicStarted = true;
    const estado = lerEstadoMusica();
    playedTracks = Array.isArray(estado?.played) ? estado.played.filter(index=>Number.isInteger(index) && index >= 0 && index < playlist.length) : [];
    const index = Number.isInteger(estado?.index) && estado.index >= 0 && estado.index < playlist.length ? estado.index : escolherProxima();
    historico = [index];
    posHistorico = 0;
    iniciarFaixa(index, Number(estado?.position) || 0);
    monitorarMusica();
  }

  function registrarHistorico(index){
    historico = historico.slice(0, posHistorico + 1);
    historico.push(index);
    posHistorico = historico.length - 1;
  }

  // Avança (+1) ou volta (-1) uma faixa. "Voltar" segue o histórico do que já
  // tocou; se estiver na primeira faixa, apenas reinicia ela do começo.
  function pularMusica(direcao=1){
    if(!musicEnabled) return;
    if(!musicAudio){
      musicStarted = true;
      const inicial = escolherProxima();
      historico = [inicial];
      posHistorico = 0;
      iniciarFaixa(inicial);
      monitorarMusica();
      return;
    }
    if(musicChanging) return;
    const voltando = direcao < 0;
    if(voltando && posHistorico <= 0){
      limparFade();
      musicAudio.currentTime = 0;
      musicAudio.muted = false;
      musicAudio.volume = Math.max(musicAudio.volume, musicVolume);
      musicAudio.play().then(()=>{ musicStarted = true; }).catch(()=>{});
      salvarEstadoMusica();
      document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
      return;
    }
    let alvo;
    if(voltando){
      posHistorico -= 1;
      alvo = historico[posHistorico];
    }else if(posHistorico < historico.length - 1){
      posHistorico += 1;
      alvo = historico[posHistorico];
    }else{
      alvo = escolherProxima();
      registrarHistorico(alvo);
    }
    musicChanging = true;
    const antiga = musicAudio;
    const trocar = ()=>{
      antiga.pause();
      musicStarted = true;
      iniciarFaixa(alvo);
      monitorarMusica();
    };
    if(antiga.paused) trocar();
    else fadeMusica(0, .25, trocar);
  }

  // "dark-beach.mp3" -> "Dark Beach"
  function nomeDaFaixa(caminho){
    const base = decodeURIComponent(String(caminho).split('/').pop()).replace(/\.mp3$/i, '');
    return base.replace(/[-_]+/g, ' ').trim().replace(/\S+/g, palavra=>palavra.charAt(0).toUpperCase() + palavra.slice(1));
  }

  function estadoMusica(){
    const arquivo = musicIndex >= 0 ? nomeDaFaixa(playlist[musicIndex]) : '';
    return {
      enabled: musicEnabled,
      playing: Boolean(musicAudio && (!musicAudio.paused || musicQuerTocar)),
      index: musicIndex,
      track: arquivo,
      currentTime: musicAudio?.currentTime || 0,
      duration: Number.isFinite(musicAudio?.duration) ? musicAudio.duration : 0,
      volume: musicAudio?.volume || 0,
      configuredVolume: musicVolume
    };
  }
  function pararMusica(){
    salvarEstadoMusica();
    try{ localStorage.setItem(MUSIC_PLAYING_KEY, 'false'); }catch(e){}
    limparFade();
    // Se a pausa vier no meio da troca de faixa (fade de 4 s), o fade é cancelado e
    // a troca nunca terminava: musicChanging ficava preso e os botões morriam.
    musicChanging = false;
    musicQuerTocar = false;
    if(musicAudio){ musicAudio.pause(); musicAudio.volume = 0; }
    musicStarted = false;
    document.dispatchEvent(new CustomEvent('nexusMusicTrackChanged', { detail: estadoMusica() }));
  }

  // Um único "tocar/pausar" para todos os botões do site (config, abertura, login...).
  function alternarMusica(){
    if(estadoMusica().playing){ pararMusica(); return false; }
    if(!musicEnabled){
      try{ localStorage.setItem(MUSIC_ENABLED_KEY, 'true'); }catch(e){}
      musicEnabled = true;
      document.dispatchEvent(new CustomEvent('musicaAlterada', { detail:{ enabled:true } }));
    }
    iniciarMusica();
    return true;
  }

  function setEnabled(novoEstado){
    enabled = Boolean(novoEstado);
    try{ localStorage.setItem(SOUND_KEY, String(enabled)); }catch(e){}
    document.dispatchEvent(new CustomEvent('sonsAlterados', { detail:{ enabled } }));
  }

  function setMusicEnabled(novoEstado){
    musicEnabled = Boolean(novoEstado);
    try{ localStorage.setItem(MUSIC_ENABLED_KEY, String(musicEnabled)); }catch(e){}
    if(musicEnabled){ iniciarMusica(); if(musicAudio) musicAudio.play().catch(()=>{}); }
    else pararMusica();
    document.dispatchEvent(new CustomEvent('musicaAlterada', { detail:{ enabled:musicEnabled } }));
  }

  function setMusicVolume(novoVolume){
    const valor = Number(novoVolume);
    if(!Number.isFinite(valor)) return;
    musicVolume = Math.max(0, Math.min(1, valor > 1 ? valor / 100 : valor));
    try{
      localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
      localStorage.setItem(MUSIC_VOLUME_VERSION_KEY, '2');
    }catch(e){}
    if(musicAudio && musicEnabled) musicAudio.volume = musicVolume;
    agendarSalvarVolumeNoBanco();
    document.dispatchEvent(new CustomEvent('musicaVolumeAlterado', { detail:{ volume:musicVolume } }));
  }

  function agendarSalvarVolumeNoBanco(){
    clearTimeout(volumeSaveTimer);
    volumeSaveTimer = setTimeout(async ()=>{
      try{
        await fetch('/api/auth/preferencias', {
          method:'PATCH',
          credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({volume_musica:musicVolume})
        });
      }catch(e){}
    }, 350);
  }

  async function sincronizarPreferenciasDoUsuario(){
    try{
      const resposta = await fetch('/api/auth/preferencias', { credentials:'same-origin', cache:'no-store' });
      if(!resposta.ok) return false;
      const corpo = await resposta.json();
      const volume = Number(corpo?.preferencias?.volume_musica);
      if(!Number.isFinite(volume)) return false;
      musicVolume = Math.max(0, Math.min(1, volume));
      try{ localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume)); }catch(e){}
      if(musicAudio && musicEnabled) musicAudio.volume = musicVolume;
      document.dispatchEvent(new CustomEvent('musicaVolumeAlterado', { detail:{ volume:musicVolume, origem:'banco' } }));
      return true;
    }catch(e){ return false; }
  }

  function setUnifiedEnabled(novoEstado){
    setEnabled(novoEstado);
    setMusicEnabled(novoEstado);
  }

  window.NexusSons = {
    play:tocar,
    playError:()=>tocar('chimeAlert'),
    setEnabled,
    setMusicEnabled,
    setUnifiedEnabled,
    isEnabled:()=>enabled,
    isMusicEnabled:()=>musicEnabled,
    startMusic:iniciarMusica,
    stopMusic:pararMusica,
    getMusicState:estadoMusica,
    setMusicVolume,
    getMusicVolume:()=>musicVolume,
    syncUserPreferences:sincronizarPreferenciasDoUsuario,
    skipMusic:pularMusica,
    toggleMusic:alternarMusica,
    syncControls:sincronizarControles
  };

  function sincronizarControles(){
    const estadoMusical = estadoMusica();
    document.querySelectorAll('[data-music-track]').forEach(el=>el.textContent = estadoMusical.track || 'Preparando a trilha sonora');
    document.querySelectorAll('[data-music-state]').forEach(el=>el.textContent = estadoMusical.playing ? 'Reproduzindo agora' : 'Em pausa');
    document.querySelectorAll('[data-music-play]').forEach(btn=>{
      const tocando = estadoMusical.playing;
      btn.setAttribute('aria-label', tocando ? 'Pausar música' : 'Tocar música');
      btn.title = tocando ? 'Pausar música' : 'Tocar música';
      const icon = btn.querySelector('[data-music-play-icon] use');
      if(icon){
        const href = tocando ? '#ic-pause' : '#ic-play';
        icon.setAttribute('href', href);
        icon.setAttributeNS?.('http://www.w3.org/1999/xlink', 'xlink:href', href);
      }
    });
    document.querySelectorAll('[data-sound-toggle]').forEach(controle=>{
      const unificado = controle.matches('[data-music-toggle]');
      const estado = unificado ? enabled && musicEnabled : enabled;
      const rotulo = unificado
        ? (estado ? 'Desativar sons e música' : 'Ativar sons e música')
        : (estado ? 'Desativar sons da interface' : 'Ativar sons da interface');
      if(controle.matches('input[type="checkbox"]')) controle.checked = estado;
      if(controle.matches('button')){
        controle.setAttribute('aria-pressed', String(estado));
        controle.title = rotulo;
      }
      controle.setAttribute('aria-label', rotulo);
    });
    document.querySelectorAll('[data-music-toggle]:not([data-sound-toggle])').forEach(controle=>{
      const rotulo = musicEnabled ? 'Desativar música de fundo' : 'Ativar música de fundo';
      if(controle.matches('input[type="checkbox"]')) controle.checked = musicEnabled;
      if(controle.matches('button')){
        controle.setAttribute('aria-pressed', String(musicEnabled));
        controle.title = rotulo;
      }
      controle.setAttribute('aria-label', rotulo);
    });
    document.querySelectorAll('[data-music-volume]').forEach(controle=>{
      const porcentagem = Math.round(musicVolume * 100);
      controle.value = String(porcentagem);
      controle.style.setProperty('--music-volume-progress', `${porcentagem}%`);
      const output = document.getElementById('musicVolumeValue');
      if(output) output.value = `${porcentagem}%`;
      const aviso = document.querySelector('[data-music-volume-warning]');
      if(aviso){
        const volumeAlto = porcentagem > 50;
        aviso.hidden = false;
        aviso.classList.toggle('is-visible', volumeAlto);
        aviso.setAttribute('aria-hidden', String(!volumeAlto));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    sincronizarControles();
    // Tenta iniciar assim que a abertura é carregada; se o navegador bloquear
    // autoplay, o clique em Entrar no painel repete a tentativa com gesto real.
    if(musicResumeOnLoad) iniciarMusica();
    else sincronizarControles();
  });
  document.addEventListener('sonsAlterados', sincronizarControles);
  document.addEventListener('musicaAlterada', sincronizarControles);
  document.addEventListener('musicaVolumeAlterado', sincronizarControles);
  document.addEventListener('nexusMusicTrackChanged', sincronizarControles);
  document.addEventListener('usuarioAutenticado', sincronizarPreferenciasDoUsuario);
  window.addEventListener('pagehide', salvarEstadoMusica);
  window.addEventListener('beforeunload', salvarEstadoMusica);
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'hidden') salvarEstadoMusica();
  });

  document.addEventListener('click', event=>{
    const elemento = event.target.closest('button, a, [role="button"], [role="option"], select, .sidebar-overlay');
    if(!elemento || elemento.disabled || elemento.matches('[data-sound-toggle], [data-music-toggle]')) return;
    if(elemento.closest('.theme-switch')) return;
    const id = elemento.id || '';
    const titulo = (elemento.getAttribute('title') || '').toLowerCase();
    const acao = elemento.dataset.action || '';
    if(acao === 'delete' || acao === 'excluir'){ tocar('swipeCancel'); window.NexusSoundToastMuted = true; return; }
    if(acao === 'start'){ tocar('loadingStart'); window.NexusSoundToastMuted = true; return; }
    if(acao === 'stop'){ tocar('loadingEndFail'); window.NexusSoundToastMuted = true; return; }
    if(id === 'sidebarOverlay') tocar('menuSlideOut');
    else if(elemento.matches('.nav-item')) tocar('notificationPop');
    else if(elemento.matches('.auth-type-tab')) tocar('tapMedium');
    else if(id === 'burgerBtn'){
      const sidebar = document.getElementById('sidebar');
      const mobile = window.innerWidth <= 900;
      const aberto = mobile ? sidebar?.classList.contains('mobile-open') : !sidebar?.classList.contains('collapsed');
      tocar(aberto ? 'menuSlideOut' : 'menuSlideIn');
    }else if(elemento.matches('#notifBtn')) tocar('chimeNotification');
    else if(elemento.matches('#userChipBtn, .user-chip, .cargo-select-trigger')) tocar('menuSlideIn');
    else if(elemento.matches('.modal-close, #usuarioCancelarBtn')) tocar('modalClose');
    else if(id === 'logoutBtn') tocar('swipeNavigation');
    else if(elemento.matches('.field-toggle-pw')) tocar('clickSoft');
    else if(elemento.matches('[role="option"]')) tocar('tapLow');
    else if(elemento.matches('#themeToggleBtn, .theme-toggle-btn')) tocar('deepChime');
    else if(titulo.includes('buscar')) tocar('clickBright');
    else if(titulo.includes('ajuda')) tocar('chimeConfirm');
    else if(elemento.matches('#dateRange')) tocar('clickDeep');
    else if(elemento.matches('#relatorioFiltrarBtn')) tocar('chimeNotification');
    else if(elemento.matches('#relatorioLimparBtn')) tocar('swipeCancel');
    else if(elemento.matches('.btn-email-corporativo')) tocar('dropSuccess');
    else if(elemento.matches('#novoUsuarioBtn')) tocar('clickHard');
    else if(elemento.matches('a[href]') && elemento.getAttribute('href')?.startsWith('/') && !elemento.getAttribute('href').startsWith('/#')) tocar('swipeNavigation');
    else if(elemento.matches('.btn-primary, button[type="submit"]')) tocar('swipeConfirm');
    else if(elemento.matches('.action-icon')) tocar('tapHigh');
    else tocar('clickSoft');
  }, true);

  document.addEventListener('click', event=>{
    const playerButton = event.target.closest('[data-music-play], [data-music-prev], [data-music-next]');
    if(playerButton){
      if(playerButton.matches('[data-music-prev]')) pularMusica(-1);
      else if(playerButton.matches('[data-music-next]')) pularMusica(1);
      else alternarMusica();
      setTimeout(sincronizarControles, 30);
      return;
    }
    const controle = event.target.closest('button[data-sound-toggle], button[data-music-toggle]');
    if(!controle) return;
    const unificado = controle.matches('[data-sound-toggle][data-music-toggle]');
    // Música pausada (ou que ainda não começou) não é "desligada": o clique deve tocar,
    // e não desligar tudo. Antes era preciso clicar duas vezes para despausar.
    const musicaParada = (unificado || controle.matches('[data-music-toggle]')) && musicEnabled && !estadoMusica().playing;
    const ativar = unificado
      ? (!(enabled && musicEnabled) || musicaParada)
      : controle.matches('[data-music-toggle]') ? (!musicEnabled || musicaParada) : !enabled;
    if(ativar){
      if(unificado) setUnifiedEnabled(true);
      else if(controle.matches('[data-music-toggle]')) setMusicEnabled(true);
      else setEnabled(true);
      tocar('switchOn');
    }else{
      tocar('switchOff');
      if(unificado) setUnifiedEnabled(false);
      else if(controle.matches('[data-music-toggle]')) setMusicEnabled(false);
      else setEnabled(false);
    }
  });

  document.addEventListener('change', event=>{
    const elemento = event.target;
    if(elemento.matches('[data-music-volume]')){
      setMusicVolume(elemento.value);
    }else if(elemento.matches('[data-sound-toggle][data-music-toggle]')){
      if(elemento.checked){ setUnifiedEnabled(true); tocar('switchOn'); }
      else{ tocar('switchOff'); setUnifiedEnabled(false); }
    }else if(elemento.matches('[data-music-toggle]')){
      if(elemento.checked){ setMusicEnabled(true); tocar('switchOn'); }
      else{ tocar('switchOff'); setMusicEnabled(false); }
    }else if(elemento.matches('[data-sound-toggle]')){
      if(elemento.checked){ setEnabled(true); tocar('switchOn'); }
      else{ tocar('switchOff'); setEnabled(false); }
    }else if(elemento.matches('#themeSwitchInput')) tocar('deepChime');
    else if(elemento.matches('select, input[type="checkbox"]')) tocar('tapLow');
  });
  document.addEventListener('input', event=>{
    const elemento = event.target;
    if(elemento.matches('[data-music-volume]')) setMusicVolume(elemento.value);
  });
})();
