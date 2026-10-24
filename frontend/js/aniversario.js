(function(){
  'use strict';
  const FINALIZADO_KEY = 'nexusBirthdayFinished';
  let audioContext = null;
  let musicTimer = null;
  let birthdayOpen = false;
  let dataAniversarioAtual = null;
  let musicWasPlayingBeforeBirthday = false;

  // Data de hoje no fuso do próprio navegador do usuário.
  function hojeLocal(){
    const agora = new Date();
    return { year:agora.getFullYear(), month:agora.getMonth() + 1, day:agora.getDate() };
  }

  function isBirthday(data){
    if(!data) return false;
    const valor = String(data).slice(0,10);
    const partes = valor.split('-').map(Number);
    const hoje = hojeLocal();
    return partes.length === 3 && partes[1] === hoje.month && partes[2] === hoje.day;
  }
  // A mensagem é exibida uma vez por ano, para cada data de aniversário cadastrada.
  function chaveDoDia(dataAniversario){
    const valor = String(dataAniversario || '').slice(5,10);
    return `${hojeLocal().year}|${valor}`;
  }
  function jaFinalizou(dataAniversario){
    try{return localStorage.getItem(FINALIZADO_KEY) === chaveDoDia(dataAniversario);}catch(e){return false;}
  }
  function tocarJingle(){
    try{
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.();
      if(musicTimer) clearTimeout(musicTimer);
      const notas=[523.25,659.25,783.99,1046.5,783.99,1046.5,1318.5];
      const duracoes=[.18,.18,.18,.38,.18,.18,.65];
      let atraso=0;
      notas.forEach((frequencia,i)=>{
        const inicio=audioContext.currentTime+atraso;
        const osc=audioContext.createOscillator(); const ganho=audioContext.createGain();
        osc.type=i%2?'triangle':'sine'; osc.frequency.value=frequencia;
        ganho.gain.setValueAtTime(.0001,inicio); ganho.gain.exponentialRampToValueAtTime(.12,inicio+.025); ganho.gain.exponentialRampToValueAtTime(.0001,inicio+duracoes[i]);
        osc.connect(ganho); ganho.connect(audioContext.destination); osc.start(inicio); osc.stop(inicio+duracoes[i]+.03); atraso+=duracoes[i]*.72;
      });
      musicTimer=setTimeout(tocarJingle,Math.max(3500,atraso*1000+2200));
    }catch(e){}
  }
  function criarConfetes(){
    const area=document.querySelector('.birthday-confetti'); if(!area) return;
    area.innerHTML='';
    const cores=['#ffd166','#ff5d8f','#64dfdf','#9b7bff','#7ee081','#fff'];
    for(let i=0;i<72;i++){const el=document.createElement('i');el.style.setProperty('--x',`${Math.random()*100}%`);el.style.setProperty('--delay',`${Math.random()*1.8}s`);el.style.setProperty('--duration',`${2.8+Math.random()*2.5}s`);el.style.setProperty('--color',cores[i%cores.length]);el.style.setProperty('--rotation',`${Math.random()*360}deg`);area.appendChild(el);}
  }
  function abrir(data, forcar=false){
    const dataAniversario = data && typeof data === 'object' ? data.data_nascimento : data;
    if(birthdayOpen || (!forcar && jaFinalizou(dataAniversario)) || (!forcar && !isBirthday(dataAniversario))) return;
    dataAniversarioAtual = dataAniversario;
    const layer=document.getElementById('birthdayCelebration'); if(!layer) return;
    birthdayOpen=true; layer.hidden=false; layer.setAttribute('aria-hidden','false'); document.documentElement.classList.add('birthday-theme-active');
    const nome=((data && data.nome)||'você').split(' ')[0]; const nomeEl=document.getElementById('birthdayUserName'); if(nomeEl) nomeEl.textContent=nome;
    criarConfetes();
    try{ musicWasPlayingBeforeBirthday = Boolean(window.NexusSons?.getMusicState?.().playing); window.NexusSons?.stopMusic?.(); }catch(e){ musicWasPlayingBeforeBirthday=false; }
    tocarJingle();
    setTimeout(()=>document.getElementById('birthdayFinishBtn')?.focus(),120);
  }
  function fechar(){
    const layer=document.getElementById('birthdayCelebration'); if(!layer) return;
    birthdayOpen=false; layer.classList.add('birthday-closing'); document.documentElement.classList.remove('birthday-theme-active');
    try{if(musicTimer) clearTimeout(musicTimer); audioContext?.close?.(); audioContext=null;}catch(e){}
    try{localStorage.setItem(FINALIZADO_KEY,chaveDoDia(dataAniversarioAtual));}catch(e){}
    setTimeout(()=>{layer.hidden=true;layer.classList.remove('birthday-closing');layer.setAttribute('aria-hidden','true');try{if(musicWasPlayingBeforeBirthday) window.NexusSons?.startMusic?.();}catch(e){} musicWasPlayingBeforeBirthday=false;},450);
  }
  function avaliar(data){
    window.__nexusBirthdayData=data;
    if(document.querySelector('.view.active')?.id==='view-perfil' || document.querySelector('.app')) abrir(data);
  }
  document.addEventListener('usuarioAutenticado',event=>avaliar(event.detail||{}));
  document.addEventListener('aniversarioDataAlterada',event=>avaliar(event.detail||{}));
  // Delegado no document: o roteador troca o <body>, então o botão pode ser recriado.
  document.addEventListener('click',event=>{ if(event.target.closest?.('#birthdayFinishBtn')) fechar(); });
  document.addEventListener('nexusRotaAlterada',()=>{ birthdayOpen=false; document.documentElement.classList.remove('birthday-theme-active'); });
  document.addEventListener('DOMContentLoaded',()=>{
    const data=window.__nexusBirthdayData; if(data) avaliar(data);
  });
  window.NexusBirthday={open:abrir,close:fechar,isBirthday};
})();
