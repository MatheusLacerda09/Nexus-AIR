(function(){
  'use strict';
  const inputId = 'perfilDataNascimentoInput';
  let picker = null;
  let cliqueFora = null;
  let viewDate = new Date();
  let selectedDate = null;

  const labels = {
    pt: { choose:'Selecionar data', clear:'Limpar data', prev:'Mês anterior', next:'Próximo mês', month:'Mês', year:'Ano', months:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'], weekdays:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] },
    en: { choose:'Select date', clear:'Clear date', prev:'Previous month', next:'Next month', month:'Month', year:'Year', months:['January','February','March','April','May','June','July','August','September','October','November','December'], weekdays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] }
  };
  const lang = ()=> String(document.documentElement.lang || document.documentElement.dataset.lang || '').toLowerCase().startsWith('en') ? labels.en : labels.pt;
  const pad = n => String(n).padStart(2,'0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromIso = value => {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const [y,m,d] = value.split('-').map(Number);
    const date = new Date(y,m-1,d);
    return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? date : null;
  };
  const formatSelected = date => date ? new Intl.DateTimeFormat(lang() === labels.en ? 'en-US' : 'pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(date) : lang().choose;

  function montarPicker(){
    const input = document.getElementById(inputId);
    if(!input) return;
    // O roteador (navegacao.js) troca o <body> inteiro: se o picker guardado
    // pertence a um DOM antigo, descarta e monta de novo no DOM atual.
    if(picker && picker.isConnected && picker.contains(input)) return;
    picker = null;
    const wrapper = input.closest('[data-birthday-date-picker]');
    if(!wrapper) return;
    const trigger = wrapper.querySelector('[data-date-trigger]');
    const popover = wrapper.querySelector('[data-date-popover]');
    const grid = wrapper.querySelector('[data-date-grid]');
    const label = wrapper.querySelector('[data-date-label]');
    const weekdayRow = wrapper.querySelector('[data-date-weekdays]');
    const monthBtn = wrapper.querySelector('[data-date-month-btn]');
    const yearBtn = wrapper.querySelector('[data-date-year-btn]');
    const monthLabel = wrapper.querySelector('[data-date-month-label]');
    const yearLabel = wrapper.querySelector('[data-date-year-label]');
    const prevBtn = wrapper.querySelector('[data-date-prev]');
    const nextBtn = wrapper.querySelector('[data-date-next]');
    const body = wrapper.querySelector('[data-date-body]');
    const monthsView = wrapper.querySelector('[data-date-view="months"]');
    const yearsView = wrapper.querySelector('[data-date-view="years"]');
    const daysView = wrapper.querySelector('[data-date-view="days"]');
    if(!trigger || !popover || !grid || !label || !weekdayRow || !monthBtn || !yearBtn || !monthsView || !yearsView || !daysView || !body) return;
    picker = wrapper;

    const today = new Date();
    const maxYear = today.getFullYear();
    const minYear = maxYear - 120;
    let mode = 'days';

    function setMode(next, focusActive){
      mode = next;
      [['days',daysView],['months',monthsView],['years',yearsView]].forEach(([nome,el])=>el.classList.toggle('is-active', nome===next));
      monthBtn.classList.toggle('is-open', next==='months');
      yearBtn.classList.toggle('is-open', next==='years');
      monthBtn.setAttribute('aria-expanded', String(next==='months'));
      yearBtn.setAttribute('aria-expanded', String(next==='years'));
      wrapper.dataset.dateMode = next;
      if(next==='years'){
        const ativo = yearsView.querySelector('.is-current');
        if(ativo) yearsView.scrollTop = Math.max(0, ativo.offsetTop - yearsView.clientHeight/2 + ativo.offsetHeight/2);
        if(focusActive) ativo?.focus({preventScroll:true});
      } else if(next==='months' && focusActive){
        monthsView.querySelector('.is-current')?.focus({preventScroll:true});
      }
      updateNav();
    }

    function setSelected(value, close=false){
      const date = fromIso(value);
      selectedDate = date;
      input.value = date ? iso(date) : '';
      label.textContent = formatSelected(date);
      trigger.classList.toggle('has-value', Boolean(date));
      trigger.setAttribute('aria-label', date ? formatSelected(date) : lang().choose);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      if(date){ viewDate = new Date(date.getFullYear(),date.getMonth(),1); }
      render();
      if(close) closePicker();
    }

    function closePicker(){
      popover.hidden = true;
      trigger.setAttribute('aria-expanded','false');
      wrapper.classList.remove('is-open');
      setMode('days');
    }

    function updateNav(){
      const y = viewDate.getFullYear(), m = viewDate.getMonth();
      if(mode==='days'){
        prevBtn.disabled = new Date(y,m-1,1).getFullYear() < minYear;
        nextBtn.disabled = new Date(y,m+1,1) > new Date(maxYear,today.getMonth(),1);
      } else {
        prevBtn.disabled = y-1 < minYear;
        nextBtn.disabled = y+1 > maxYear;
      }
    }

    function render(){
      const t = lang();
      const y = viewDate.getFullYear(), m = viewDate.getMonth();
      monthLabel.textContent = t.months[m];
      yearLabel.textContent = String(y);
      monthBtn.setAttribute('aria-label', `${t.month}: ${t.months[m]}`);
      yearBtn.setAttribute('aria-label', `${t.year}: ${y}`);
      prevBtn.setAttribute('aria-label', t.prev);
      nextBtn.setAttribute('aria-label', t.next);
      wrapper.querySelector('[data-date-clear]').textContent = t.clear;
      label.textContent = formatSelected(selectedDate);
      weekdayRow.innerHTML = t.weekdays.map(day=>`<span>${day}</span>`).join('');

      const first = new Date(y,m,1);
      const days = new Date(y,m+1,0).getDate();
      const cells = [];
      for(let i=0;i<first.getDay();i++) cells.push('<span class="birthday-date-empty" aria-hidden="true"></span>');
      for(let day=1;day<=days;day++){
        const date = new Date(y,m,day);
        const value = iso(date);
        const isSelected = selectedDate && value===iso(selectedDate);
        const isToday = value===iso(today);
        const disabled = date>today;
        cells.push(`<button type="button" class="birthday-date-day${isSelected?' is-selected':''}${isToday?' is-today':''}" data-date-value="${value}"${disabled?' disabled':''} aria-label="${formatSelected(date)}"${isSelected?' aria-pressed="true"':''}>${day}</button>`);
      }
      grid.innerHTML = cells.join('');

      monthsView.innerHTML = t.months.map((nome,i)=>{
        const futuro = y===maxYear && i>today.getMonth();
        return `<button type="button" role="option" class="birthday-date-chip${i===m?' is-current':''}" data-month="${i}"${futuro?' disabled':''} aria-selected="${i===m}">${nome.slice(0,3)}</button>`;
      }).join('');

      const anos = [];
      for(let ano=maxYear; ano>=minYear; ano--) anos.push(`<button type="button" role="option" class="birthday-date-chip${ano===y?' is-current':''}" data-year="${ano}" aria-selected="${ano===y}">${ano}</button>`);
      yearsView.innerHTML = anos.join('');
      updateNav();
    }

    function goTo(year, month){
      let alvo = new Date(year, month, 1);
      const limite = new Date(maxYear, today.getMonth(), 1);
      if(alvo > limite) alvo = limite;
      viewDate = alvo;
      render();
    }

    function openPicker(){
      if(!selectedDate){ const now = new Date(); viewDate = new Date(now.getFullYear(),now.getMonth(),1); }
      mode = 'days';
      render();
      setMode('days');
      popover.hidden = false;
      trigger.setAttribute('aria-expanded','true');
      wrapper.classList.add('is-open');
      posicionar();
    }

    // Se não couber abaixo do campo, abre para cima; se também não couber,
    // rola a tela até o calendário ficar inteiro visível.
    function posicionar(){
      popover.classList.remove('opens-up');
      const campo = trigger.getBoundingClientRect();
      const altura = popover.offsetHeight + 16;
      const abaixo = window.innerHeight - campo.bottom;
      const acima = campo.top;
      if(abaixo < altura && acima > abaixo) popover.classList.add('opens-up');
      const ponta = popover.getBoundingClientRect();
      if(ponta.top < 0 || ponta.bottom > window.innerHeight){
        popover.scrollIntoView({ block:'nearest', behavior:'smooth' });
      }
    }

    trigger.addEventListener('click',()=>popover.hidden?openPicker():closePicker());
    grid.addEventListener('click',event=>{
      const btn = event.target.closest('[data-date-value]');
      if(btn && !btn.disabled) setSelected(btn.dataset.dateValue,true);
    });
    prevBtn.addEventListener('click',()=>{
      if(mode==='days') goTo(viewDate.getFullYear(), viewDate.getMonth()-1);
      else goTo(viewDate.getFullYear()-1, viewDate.getMonth());
    });
    nextBtn.addEventListener('click',()=>{
      if(mode==='days') goTo(viewDate.getFullYear(), viewDate.getMonth()+1);
      else goTo(viewDate.getFullYear()+1, viewDate.getMonth());
    });
    monthBtn.addEventListener('click',()=>setMode(mode==='months'?'days':'months', true));
    yearBtn.addEventListener('click',()=>setMode(mode==='years'?'days':'years', true));
    monthsView.addEventListener('click',event=>{
      const btn = event.target.closest('[data-month]');
      if(!btn || btn.disabled) return;
      goTo(viewDate.getFullYear(), Number(btn.dataset.month));
      setMode('days');
    });
    yearsView.addEventListener('click',event=>{
      const btn = event.target.closest('[data-year]');
      if(!btn) return;
      goTo(Number(btn.dataset.year), viewDate.getMonth());
      setMode('days');
    });
    popover.addEventListener('keydown',event=>{
      if(event.key!=='Escape') return;
      event.stopPropagation();
      if(mode!=='days'){ setMode('days'); yearBtn.focus(); }
      else { closePicker(); trigger.focus(); }
    });
    wrapper.querySelector('[data-date-clear]').addEventListener('click',()=>setSelected('',true));
    // composedPath: o botão clicado pode ter sido recriado por render() antes deste handler rodar.
    if(cliqueFora) document.removeEventListener('click',cliqueFora);
    cliqueFora = event=>{if(!event.composedPath().includes(wrapper)) closePicker();};
    document.addEventListener('click',cliqueFora);
    input._birthdayPickerRefresh = ()=>{setSelected(input.value,false);};
    setSelected(input.value,false);
  }
  function init(){
    montarPicker();
    if(!picker) setTimeout(montarPicker, 120);
    document.addEventListener('nexusRotaAlterada',()=>setTimeout(montarPicker,0));
    document.addEventListener('nexusIdiomaAlterado',()=>{
      const input=document.getElementById(inputId);
      input?._birthdayPickerRefresh?.();
    });
  }
  window.NexusAtualizarDataAniversario=()=>document.getElementById(inputId)?._birthdayPickerRefresh?.();
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-date-trigger]');
    if(trigger && (!picker || !picker.isConnected)){
      montarPicker();
      setTimeout(()=>picker?.querySelector('[data-date-trigger]')?.click(),0);
    }
  },true);
  if(document.readyState === 'loading') window.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
