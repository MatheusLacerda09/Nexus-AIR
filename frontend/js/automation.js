(() => {
  const $ = (s) => document.querySelector(s);
  const api = async (url, options={}) => { const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const body=await r.json().catch(()=>({})); if(!r.ok) throw new Error((body.errors||[body.message||'Erro na operação']).join ? (body.errors||[body.message||'Erro na operação']).join(' ') : 'Erro na operação'); return body; };
  const feedback = (id, msg, error=false) => { const el=$('#'+id); if(el){el.textContent=msg; el.classList.toggle('is-error',error); el.classList.toggle('is-success',!error);} };
  let conectores=[], fluxos=[], nomesConectores={}, fluxoSel=null;
  const esc = (v) => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function carregarConectores(){ try{ const b=await api('/api/conectores'); conectores=b.itens||[]; const body=$('#conectoresBody'); if(body) body.innerHTML=conectores.map(c=>`<tr><td>${esc(c.nome)}</td><td>${esc(c.tipo)}</td><td><span class="automation-status">${esc(c.status||'não validado')}</span></td><td><button class="action-icon" data-validar-conector="${c.id}">Validar</button><button class="action-icon" data-excluir-conector="${c.id}">Excluir</button></td></tr>`).join(''); $('#conectoresVazio')?.toggleAttribute('hidden',conectores.length>0); await preencherConectorDoFluxo(); }catch(e){ feedback('conectorFeedback',e.message,true); } }
  const ROTULOS={linux:'Servidor Linux',windows:'Servidor Windows',banco:'Banco de dados',outro:'Host',api:'API',sql:'SQL',planilha:'Planilha'};
  // O que foi cadastrado em "Conectores de Dados" (máquinas e fontes) aparece como opção do fluxo.
  async function preencherConectorDoFluxo(){
    const select=$('#fluxoConector'); if(!select) return;
    let maquinas=[]; try{ maquinas=(await api('/api/maquinas')).itens||[]; }catch(e){}
    const op=(id,nome,tipo)=>`<option value="${esc(id)}">${esc(nome)} · ${esc(ROTULOS[tipo]||tipo||'')}</option>`;
    const atual=select.value;
    let html='<option value="">Selecione o conector</option>';
    if(maquinas.length) html+='<optgroup label="Máquinas e bancos">'+maquinas.map(m=>op(m.id,m.nome,m.tipo)).join('')+'</optgroup>';
    if(conectores.length) html+='<optgroup label="Fontes de dados">'+conectores.map(c=>op(c.id,c.nome,c.tipo)).join('')+'</optgroup>';
    select.innerHTML=html;
    if(atual) select.value=atual;
    nomesConectores={}; maquinas.forEach(m=>nomesConectores[m.id]=m.nome); conectores.forEach(c=>nomesConectores[c.id]=c.nome);
    renderFluxos();
  }
  const FREQ={manual:'Manual',diaria:'Diária',semanal:'Semanal',mensal:'Mensal'};
  const ICO=(n)=>`<svg class="ic"><use href="#ic-${n}"/></svg>`;
  const classeStatus=(st)=>/conclu|sucesso|ok/i.test(st)?'is-ok':/falh|erro/i.test(st)?'is-bad':/agend|execut/i.test(st)?'is-run':'';
  const fmtData=(iso)=>{ try{ return iso?new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):''; }catch(e){ return ''; } };
  function renderFluxos(){
    const body=$('#fluxosBody'); if(!body) return;
    if(fluxoSel && !fluxos.some(f=>f.id===fluxoSel)) fluxoSel=null;
    if(!fluxoSel && fluxos.length) fluxoSel=fluxos[0].id;
    body.innerHTML=fluxos.map(f=>{
      const sel=f.id===fluxoSel, origem=nomesConectores[f.conector_id]||'Conector removido', ult=fmtData(f.ultima_execucao);
      return `<article class="fx-item${sel?' is-sel':''}" role="option" tabindex="0" aria-selected="${sel}" data-fluxo-id="${esc(f.id)}">
        <span class="fx-item-ico">${ICO('workflow')}</span>
        <div class="fx-item-info"><strong title="${esc(f.nome)}">${esc(f.nome)}</strong>
          <div class="fx-meta"><span>${ICO('database')}${esc(origem)}</span><span>${ICO('clock')}${esc(FREQ[f.frequencia]||f.frequencia||'Manual')}</span>${ult?`<span>${ICO('check')}Última: ${esc(ult)}</span>`:''}</div></div>
        <div class="fx-item-lado"><span class="fx-badge ${classeStatus(f.status)}">${esc(f.status||'pronto')}</span>
          <button class="fx-icbtn" type="button" title="Visualizar PDF" aria-label="Visualizar PDF do fluxo ${esc(f.nome)}" data-pdf-fluxo="${esc(f.id)}">${ICO('eye')}</button>
          <button class="fx-icbtn" type="button" title="Baixar PDF" aria-label="Baixar PDF do fluxo ${esc(f.nome)}" data-baixar-fluxo="${esc(f.id)}">${ICO('download')}</button>
          <button class="fx-icbtn" type="button" title="Executar e gerar PDF" aria-label="Executar fluxo ${esc(f.nome)}" data-executar-fluxo="${esc(f.id)}">${ICO('play')}</button>
          <button class="fx-icbtn is-del" type="button" title="Excluir" aria-label="Excluir fluxo ${esc(f.nome)}" data-excluir-fluxo="${esc(f.id)}">${ICO('trash')}</button></div>
      </article>`;}).join('');
    $('#fluxosVazio')?.toggleAttribute('hidden',fluxos.length>0);
    const set=(id,v)=>{const el=$(id); if(el) el.textContent=v;};
    set('#fxStatTotal',fluxos.length); set('#fxStatAuto',fluxos.filter(f=>f.frequencia&&f.frequencia!=='manual').length);
    const run=$('#fluxoExecutarBtn'); if(run) run.disabled=!fluxos.length;
    const atual=fluxos.find(f=>f.id===fluxoSel); set('#fxHeroSel',atual?atual.nome:'Nenhum fluxo');
  }
  async function carregarFluxos(){ try{ const b=await api('/api/fluxos'); fluxos=b.itens||[]; renderFluxos(); }catch(e){ feedback('fluxoFeedback',e.message,true); } }
  const baixar=(url,nome)=>{ const a=document.createElement('a'); a.href=url; a.download=nome||''; document.body.appendChild(a); a.click(); a.remove(); };
  let blobModal=null;
  async function abrirPdf(url,titulo,nome,opcoes){
    const r=await fetch(url,{credentials:'same-origin',...(opcoes||{})}); if(!r.ok) throw new Error('Não foi possível gerar o PDF.');
    const u=URL.createObjectURL(await r.blob()); if(blobModal) URL.revokeObjectURL(blobModal); blobModal=u;
    $('#pdfModalTitulo').textContent=titulo; $('#pdfModalFrame').src=u+'#toolbar=0&navpanes=0'; const b=$('#pdfModalBaixar'); b.href=u; b.download=nome; $('#pdfModal').hidden=false;
  }
  const fecharPdf=()=>{ $('#pdfModal').hidden=true; $('#pdfModalFrame').src='about:blank'; };
  document.addEventListener('click',async e=>{
    if(e.target.closest('#pdfModalFechar')||e.target.id==='pdfModal') return fecharPdf();
    const v=e.target.closest('[data-pdf-fluxo]'), d=e.target.closest('[data-baixar-fluxo]');
    try{
      if(v){ const f=fluxos.find(x=>x.id===v.dataset.pdfFluxo); await abrirPdf('/api/fluxos/'+v.dataset.pdfFluxo+'/pdf?inline=1','PDF · '+(f?.nome||'Fluxo'),'nexus-fluxo.pdf'); }
      if(d){ baixar('/api/fluxos/'+d.dataset.baixarFluxo+'/pdf','nexus-fluxo.pdf'); feedback('fluxoFeedback','PDF do fluxo gerado e baixado.'); }
    }catch(x){ feedback('fluxoFeedback',x.message,true); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#pdfModal').hidden) fecharPdf(); });
  const selecionarFluxo=(el)=>{ const c=el.closest('[data-fluxo-id]'); if(!c) return; fluxoSel=c.dataset.fluxoId; renderFluxos(); $(`[data-fluxo-id="${CSS.escape(fluxoSel)}"]`)?.focus(); };
  document.addEventListener('click',e=>{ if(e.target.closest('button')) return; if(e.target.closest('#fluxosBody')) selecionarFluxo(e.target); });
  document.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.fx-item')){ e.preventDefault(); selecionarFluxo(e.target); } });
  $('#fluxoExecutarBtn')?.addEventListener('click',()=>{ if(!fluxoSel){ feedback('fluxoFeedback','Selecione um fluxo na lista.',true); return; } $(`[data-executar-fluxo="${CSS.escape(fluxoSel)}"]`)?.click(); });
  // Abas do Orquestrador: Fluxos | Relatórios por e-mail (delegado: o roteador troca o body).
  function abrirAba(nome){
    document.querySelectorAll('[data-fx-tab]').forEach(t=>{ const on=t.dataset.fxTab===nome; t.classList.toggle('is-active',on); t.setAttribute('aria-selected',String(on)); t.tabIndex=on?0:-1; });
    const f=$('#fxPainelFluxos'), a=$('#fxPainelAgend');
    if(f) f.hidden=nome!=='fluxos'; if(a) a.hidden=nome!=='agendados';
  }
  document.addEventListener('click',e=>{ const t=e.target.closest('[data-fx-tab]'); if(t) abrirAba(t.dataset.fxTab); });
  document.addEventListener('keydown',e=>{
    const t=e.target.closest?.('[data-fx-tab]'); if(!t||!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    const abas=[...document.querySelectorAll('[data-fx-tab]')], i=abas.indexOf(t), n=abas[(i+(e.key==='ArrowRight'?1:abas.length-1))%abas.length];
    abrirAba(n.dataset.fxTab); n.focus();
  });
  window.NexusOrquestradorAba=abrirAba;
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-fx-exemplo]'); if(!b) return; const t=$('#fluxoRegras'); if(t){ t.value=b.dataset.fxExemplo==='[]'?'':b.dataset.fxExemplo; t.focus(); } });
  function dadosRelatorio(){ return tarefas.map(t=>({...t,status:t.status.toLowerCase(),categoria:t.tarefa})); }
  document.addEventListener('submit', async e=>{ if(e.target.id==='conectorForm'){e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); try{await api('/api/conectores',{method:'POST',body:JSON.stringify(d)}); e.target.reset(); feedback('conectorFeedback','Conector adicionado com sucesso.'); carregarConectores();}catch(x){feedback('conectorFeedback',x.message,true);}} if(e.target.id==='fluxoForm'){e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); try{d.etapas=[]; d.regras=d.regras?JSON.parse(d.regras):[]; await api('/api/fluxos',{method:'POST',body:JSON.stringify(d)}); e.target.reset(); feedback('fluxoFeedback','Fluxo salvo e pronto para execução.'); carregarFluxos();}catch(x){feedback('fluxoFeedback',x.message,true);}} });
  document.addEventListener('click', async e=>{ const c=e.target.closest('[data-validar-conector]'); if(c){try{const b=await api('/api/conectores/'+c.dataset.validarConector+'/validar',{method:'POST'}); feedback('conectorFeedback',b.valido?'Conector válido.':'Conector inválido.',!b.valido); carregarConectores();}catch(x){feedback('conectorFeedback',x.message,true);}} const ec=e.target.closest('[data-excluir-conector]'); if(ec&&confirm('Excluir este conector?')){await api('/api/conectores/'+ec.dataset.excluirConector,{method:'DELETE'});carregarConectores();} const ef=e.target.closest('[data-excluir-fluxo]'); if(ef&&confirm('Excluir este fluxo?')){await api('/api/fluxos/'+ef.dataset.excluirFluxo,{method:'DELETE'});carregarFluxos();} const ex=e.target.closest('[data-executar-fluxo]'); if(ex){try{const b=await api('/api/fluxos/'+ex.dataset.executarFluxo+'/executar',{method:'POST'}); feedback('fluxoFeedback',`${b.mensagem} Linhas: ${b.linhas_processadas}. PDF baixado.`); baixar('/api/fluxos/'+ex.dataset.executarFluxo+'/pdf','nexus-fluxo.pdf'); carregarFluxos();}catch(x){feedback('fluxoFeedback',x.message,true);}} });
  $('#validarDadosBtn')?.addEventListener('click',async()=>{try{const linhas=JSON.parse($('#dadosValidacao').value||'[]');const obrigatorios=($('#camposObrigatorios').value||'').split(',').map(x=>x.trim()).filter(Boolean);const b=await api('/api/conectores/validar-dados',{method:'POST',body:JSON.stringify({linhas,obrigatorios})});feedback('validacaoFeedback',b.valido?`Dados válidos: ${b.total_linhas} linhas.`:`Encontrados ${b.erros.length} problemas.`,!b.valido);}catch(e){feedback('validacaoFeedback',e.message,true);}});
  async function relatorio(preview=false){
    const payload={titulo:$('#templateNome')?.value||'Relatório Nexus Air',conteudo:$('#templateConteudo')?.value||'{{dados}}',dados:dadosRelatorio(),filtros:{busca:$('#relatorioBusca')?.value||'',categoria:$('#relatorioCategoria')?.value||'',status:$('#relatorioStatus')?.value||''}};
    const r=await fetch('/api/relatorios/pdf',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,inline:preview})});
    if(!r.ok) throw new Error('Não foi possível gerar o PDF.');
    const url=URL.createObjectURL(await r.blob());
    if(preview){ const fr=$('#relatorioPdfFrame'); if(fr.dataset.url) URL.revokeObjectURL(fr.dataset.url); fr.dataset.url=url; fr.src=url+'#toolbar=0&navpanes=0'; fr.hidden=false; $('#relatorioPreview').hidden=true; feedback('relatorioFeedback','Prévia gerada no modelo padrão Nexus.'); }
    else { baixar(url,'nexus-air-relatorio.pdf'); setTimeout(()=>URL.revokeObjectURL(url),4000); feedback('relatorioFeedback','PDF gerado e baixado.'); }
  }
  $('#relatorioPreviewBtn')?.addEventListener('click',()=>relatorio(true).catch(e=>feedback('relatorioFeedback',e.message,true))); $('#relatorioPdfBtn')?.addEventListener('click',()=>relatorio(false).catch(e=>feedback('relatorioFeedback',e.message,true)));
  document.addEventListener('usuarioAutenticado',()=>{carregarConectores();carregarFluxos();});document.addEventListener('nexusMaquinasAtualizadas',()=>{if($('#view-orquestrador'))preencherConectorDoFluxo();});document.addEventListener('nexusRotaAlterada',()=>{if($('#view-conectores'))carregarConectores();if($('#view-orquestrador')){carregarConectores();carregarFluxos();}}); document.addEventListener('DOMContentLoaded',()=>{carregarConectores();carregarFluxos();});
})();
