(function(){
  'use strict';
  const nomeArtista = 'Pastel Ghost';

  function iniciarAbertura(){
    const splash = document.getElementById('nexusSplash');
    if(!splash || splash.dataset.initialized === 'true') return;
    if(window.NexusSplashCleanup) window.NexusSplashCleanup();
    if(window.__NexusSplashShown){
      splash.classList.add('is-hidden');
      splash.setAttribute('aria-hidden', 'true');
      return;
    }
    window.__NexusSplashShown = true;
    splash.dataset.initialized = 'true';

    const entrar = document.getElementById('nexusSplashEnter');
    const trackLabel = document.getElementById('nexusSplashTrack');
    const statusLabel = document.getElementById('nexusSplashStatus');
    const progressBar = document.getElementById('nexusSplashProgress');
    const stage = splash.querySelector('.ns-stage');
    const fundo = splash.querySelector('.ns-bg');
    const btnPrev = document.getElementById('nexusSplashPrev');
    const btnNext = document.getElementById('nexusSplashNext');
    const btnPlay = document.getElementById('nexusSplashPlay');
    let ponteiroFrame = 0;
    let pausadoPeloUsuario = false;
    let envelope = 0;
    let ultimoQuadro = 0;
    const ondas = [1,2,3,4,5].map(n=>document.getElementById('nsWave' + n));
    // Anéis concêntricos, com movimento orgânico e amplitudes pequenas para
    // uma animação mais elegante, sem transformar a logo em um elemento chamativo.
    const configOndas = [
      { raio:82,  k:3, vel:.0008,  amp:4.5 },
      { raio:112, k:5, vel:-.0010, amp:6.5 },
      { raio:144, k:7, vel:.0012,  amp:8 },
      { raio:178, k:9, vel:-.0014, amp:9.5 },
      { raio:212, k:11, vel:.0016, amp:11 }
    ];
    const desenharOndas = (agora, niveis)=>{
      const passos = 120;
      ondas.forEach((caminho, i)=>{
        if(!caminho) return;
        const { raio, k, vel, amp } = configOndas[i];
        const nivel = niveis[i];
        const fase = agora * vel;
        let d = '';
        for(let n=0; n<=passos; n++){
          const ang = (n / passos) * Math.PI * 2;
          const onda = Math.sin(k * ang + fase) * .68 + Math.sin((k + 2) * ang - fase * 1.25) * .32;
          const r = raio + onda * amp * nivel;
          d += `${n ? 'L' : 'M'}${(Math.cos(ang) * r).toFixed(2)} ${(Math.sin(ang) * r).toFixed(2)}`;
        }
        caminho.setAttribute('d', d + 'Z');
        caminho.style.strokeOpacity = (.28 + nivel * .6).toFixed(3);
      });
    };
    const suave = { l1:0, l2:0, l3:0, nivel:0 };
    const bars = [...document.querySelectorAll('#nexusSplashVisualizer span')];
    const dust = document.getElementById('nexusSplashDust');
    let fechando = false;
    let visualizerFrame = 0;
    let ultimaBatida = -1;

    if(dust && !dust.children.length){
      for(let i=0; i<88; i++){
        const particula = document.createElement('i');
        particula.style.left = `${Math.random() * 100}%`;
        particula.style.top = `${Math.random() * 100}%`;
        particula.style.setProperty('--float-x', `${Math.random() * 34 - 17}px`);
        particula.style.setProperty('--float-y', `${Math.random() * 30 - 15}px`);
        particula.style.setProperty('--float-duration', `${7 + Math.random() * 12}s`);
        particula.style.setProperty('--float-delay', `${Math.random() * -12}s`);
        particula.style.setProperty('--burst-x', `${Math.random() * 22 - 11}px`);
        particula.style.setProperty('--burst-y', `${Math.random() * 22 - 11}px`);
        particula.style.setProperty('--dust-size', `${1.4 + Math.random() * 4.2}px`);
        particula.style.opacity = `${.25 + Math.random() * .6}`;
        dust.appendChild(particula);
      }
    }

    const iniciarMusica = ()=>{
      try{ window.NexusSons?.startMusic?.(); }catch(e){}
    };
    const consultarSessao = async ()=>{
      try{
        const resposta = await fetch('/api/auth/me', { credentials:'same-origin', cache:'no-store' });
        return resposta.ok;
      }catch(e){ return false; }
    };
    const dispararBatida = batida => {
      if(batida === ultimaBatida) return;
      ultimaBatida = batida;
      splash.classList.remove('is-beat');
      dust?.classList.remove('is-burst');
      void splash.offsetWidth;
      splash.classList.add('is-beat');
      dust?.classList.add('is-burst');
      window.setTimeout(()=>{
        splash.classList.remove('is-beat');
        dust?.classList.remove('is-burst');
      }, 420);
    };
    const atualizarRotulos = ()=>{
      const estado = window.NexusSons?.getMusicState?.() || {};
      if(trackLabel && estado.track){
        const nome = String(estado.track);
        if(trackLabel.textContent !== nome){
          trackLabel.textContent = nome;
          trackLabel.classList.remove('ns-swap');
          void trackLabel.offsetWidth;
          trackLabel.classList.add('ns-swap');
        }
      }
    };
    const animarMusica = agora => {
      const estado = window.NexusSons?.getMusicState?.() || {};
      const ativo = Boolean(estado.playing);
      const progresso = estado.duration ? estado.currentTime / estado.duration : 0;
      const dt = Math.min(.1, (agora - (ultimoQuadro || agora)) / 1000);
      ultimoQuadro = agora;
      atualizarRotulos();
      if(statusLabel){
        statusLabel.textContent = `${nomeArtista} · ${ativo ? 'tocando agora' : (pausadoPeloUsuario ? 'pausado' : 'aguardando interação')}`;
      }
      splash.classList.toggle('is-playing', ativo);
      if(progressBar) progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progresso)).toFixed(4)})`;
      if(ativo){
        const batida = Math.floor((estado.currentTime || 0) * 2.15);
        const chave = batida + (Number(estado.index) || 0) * 100000;
        if(chave !== ultimaBatida) envelope = 1;
        dispararBatida(chave);
      }
      envelope = Math.max(0, envelope - dt * 2.4);

      const niveis = bars.map((barra, index)=>{
        const onda = Math.sin(agora / (180 + index * 23) + index * .85 + progresso * 8);
        const pulso = ativo ? .48 + Math.abs(onda) * .52 : .22 + Math.abs(onda) * .15;
        barra.style.setProperty('--music-bar-level', pulso.toFixed(3));
        return pulso;
      });
      const media = (de, ate)=>{
        const parte = niveis.slice(de, ate);
        return parte.length ? parte.reduce((x, y)=>x + y, 0) / parte.length : 0;
      };
      // Graves, médios e agudos alimentam cada anel; a batida dá o "soco".
      const alvo = ativo
        ? { l1:media(0, 3) * .46 + envelope * .58, l2:media(3, 6) * .52 + envelope * .42, l3:media(6, 9) * .58 + envelope * .28 }
        : { l1:media(0, 3) * .22, l2:media(3, 6) * .22, l3:media(6, 9) * .22 };
      suave.l1 += (alvo.l1 - suave.l1) * .3;
      suave.l2 += (alvo.l2 - suave.l2) * .3;
      suave.l3 += (alvo.l3 - suave.l3) * .3;
      suave.nivel += (Math.max((suave.l1 + suave.l2 + suave.l3) / 3, envelope * .9) - suave.nivel) * .3;
      if(stage){
        stage.style.setProperty('--ns-l1', suave.l1.toFixed(3));
        stage.style.setProperty('--ns-l2', suave.l2.toFixed(3));
        stage.style.setProperty('--ns-l3', suave.l3.toFixed(3));
        stage.style.setProperty('--ns-env', envelope.toFixed(3));
      }
      fundo?.style.setProperty('--ns-level', suave.nivel.toFixed(3));
      desenharOndas(agora, [suave.l1, suave.l2, suave.l3]);
      visualizerFrame = requestAnimationFrame(animarMusica);
    };
    const fecharComDestino = async ()=>{
      if(fechando) return;
      fechando = true;
      if(!pausadoPeloUsuario) iniciarMusica();
      const autenticado = await consultarSessao();
      if(!autenticado){
        // Mantém a abertura cobrindo a página até a rota de login substituir o body.
        window.NexusRouter?.go('/entrar') || (window.location.href = '/entrar');
        return;
      }
      splash.classList.add('is-leaving');
      cancelAnimationFrame(visualizerFrame);
      window.setTimeout(()=>{
        splash.classList.add('is-hidden');
        splash.setAttribute('aria-hidden', 'true');
        window.NexusSplashCleanup?.();
      }, 720);
    };
    const aoClicar = event=>{
      event.preventDefault();
      fecharComDestino();
    };

    // Parallax suave: logo e luzes acompanham o ponteiro.
    const aoMoverPonteiro = event=>{
      if(ponteiroFrame) return;
      ponteiroFrame = requestAnimationFrame(()=>{
        ponteiroFrame = 0;
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        splash.style.setProperty('--px', ((x - .5) * 2).toFixed(3));
        splash.style.setProperty('--py', ((y - .5) * 2).toFixed(3));
        splash.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        splash.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    };
    splash.addEventListener('pointermove', aoMoverPonteiro, { passive:true });

    const clique = ()=>{ try{ window.NexusSons?.play?.('clickSoft'); }catch(e){} };
    const aoVoltar = ()=>{ clique(); pausadoPeloUsuario = false; window.NexusSons?.skipMusic?.(-1); };
    const aoAvancar = ()=>{ clique(); pausadoPeloUsuario = false; window.NexusSons?.skipMusic?.(1); };
    const aoAlternar = ()=>{
      clique();
      // Mesma lógica de todos os botões do site (sons.js): pausar aqui ou nas
      // configurações e retomar em qualquer outro lugar.
      const agoraTocando = window.NexusSons?.toggleMusic
        ? window.NexusSons.toggleMusic()
        : (()=>{ const t = Boolean(window.NexusSons?.getMusicState?.().playing); if(t) window.NexusSons?.stopMusic?.(); else iniciarMusica(); return !t; })();
      pausadoPeloUsuario = !agoraTocando;
    };
    btnPrev?.addEventListener('click', aoVoltar);
    btnNext?.addEventListener('click', aoAvancar);
    btnPlay?.addEventListener('click', aoAlternar);

    // Somente o botão "Entrar no painel" libera a abertura. Clique fora e teclado não fazem nada.
    entrar?.addEventListener('click', aoClicar);
    window.NexusSplashCleanup = ()=>{
      entrar?.removeEventListener('click', aoClicar);
      splash.removeEventListener('pointermove', aoMoverPonteiro);
      btnPrev?.removeEventListener('click', aoVoltar);
      btnNext?.removeEventListener('click', aoAvancar);
      btnPlay?.removeEventListener('click', aoAlternar);
      cancelAnimationFrame(ponteiroFrame);
      document.removeEventListener('nexusMusicTrackChanged', atualizarRotulos);
      cancelAnimationFrame(visualizerFrame);
      window.NexusSplashCleanup = null;
    };
    requestAnimationFrame(()=>splash.classList.add('is-ready'));
    visualizerFrame = requestAnimationFrame(animarMusica);
    document.addEventListener('nexusMusicTrackChanged', atualizarRotulos);
  }

  window.NexusInitAbertura = iniciarAbertura;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarAbertura, { once:true });
  else iniciarAbertura();
})();
