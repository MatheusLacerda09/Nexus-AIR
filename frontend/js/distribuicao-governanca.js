(function () {
  'use strict';

  const CHAVE = 'nexusDG_v1';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, som) => { if (typeof mostrarToast === 'function') mostrarToast(msg, som); };
  const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const ic = (id, cls = 'dg-ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  function agora(minAtras = 0) { return new Date(Date.now() - minAtras * 60000).toISOString(); }

  function estadoInicial() {
    return {
      listas: [
        { id: 'l1', nome: 'Diretoria', emails: ['diretoria@empresa.com.br', 'ceo@empresa.com.br'] },
        { id: 'l2', nome: 'Equipe de TI', emails: ['ti@empresa.com.br', 'suporte@empresa.com.br', 'infra@empresa.com.br'] },
        { id: 'l3', nome: 'Clientes', emails: ['contato@cliente.com.br'] },
      ],
      listaAtiva: 'todas',
      envios: [
        { id: 'REL-00455', quando: agora(35), dest: 'infra@empresa.com.br', lista: 'Equipe de TI', status: 'enviado', assunto: 'Relatório semanal de suporte', tentativas: 1 },
        { id: 'REL-00454', quando: agora(36), dest: 'suporte@empresa.com.br', lista: 'Equipe de TI', status: 'enviado', assunto: 'Relatório semanal de suporte', tentativas: 1 },
        { id: 'REL-00453', quando: agora(37), dest: 'ti@empresa.com.br', lista: 'Equipe de TI', status: 'enviado', assunto: 'Relatório semanal de suporte', tentativas: 1 },
        { id: 'REL-00452', quando: agora(1500), dest: 'ceo@empresa.com.br', lista: 'Diretoria', status: 'enviado', assunto: 'Resumo executivo', tentativas: 1 },
        { id: 'REL-00451', quando: agora(1501), dest: 'diretoria@empresa.com.br', lista: 'Diretoria', status: 'enviado', assunto: 'Resumo executivo', tentativas: 1 },
        { id: 'REL-00450', quando: agora(2900), dest: 'contato@cliente.com.br', lista: 'Clientes', status: 'erro', erro: 'Caixa de entrada do destinatário indisponível (550).', assunto: 'Relatório mensal', tentativas: 2 },
      ],
      seq: 455,
      config: { remetente: 'relatorios@nexusair.com.br', assunto: 'Relatório Nexus Air', frequencia: 'manual', hora: '08:00', anexarPdf: true },
      links: [],
      gov: { webUrl: '', sessao: '60', exigirWeb: false, versionar: false, bkAtivo: false, bkFreq: 'diario', bkHora: '02:00' },
      statusUsuarios: {},
      versoes: [],
      backups: [],
      log: [],
    };
  }

  let S = carregar();
  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) return Object.assign(estadoInicial(), JSON.parse(bruto));
    } catch (e) {  }
    return estadoInicial();
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {  } }

  const usuarioAtual = () => ($('userChipNome')?.textContent || '').trim() || 'Usuário';
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);

  function dataBR(iso) { const d = new Date(iso); return d.toLocaleDateString('pt-BR'); }
  function horaBR(iso) { const d = new Date(iso); return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function dataHoraBR(iso) { return `${dataBR(iso)} às ${horaBR(iso)}`; }

  function registrarLog(acao, objeto, tipo, detalhe) {
    S.log.unshift({ id: uid('g'), quando: agora(), usuario: usuarioAtual(), acao, objeto, tipo, detalhe: detalhe || '' });
    S.log = S.log.slice(0, 60);
    salvar();
    if ($('dgLogLista')) renderLog();
  }

  let modalFecharCb = null;
  function abrirModal(html, aoMontar) {
    const m = $('dgModal'), ov = $('dgOverlay');
    m.innerHTML = html;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden', 'false');
    m.querySelectorAll('[data-dg-fechar]').forEach((b) => b.addEventListener('click', fecharModal));
    if (aoMontar) aoMontar(m);
    const primeiro = m.querySelector('input:not([type=hidden]),select,textarea');
    if (primeiro) setTimeout(() => primeiro.focus(), 120);
  }
  function fecharModal() {
    const ov = $('dgOverlay');
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden', 'true');
    if (modalFecharCb) { modalFecharCb(); modalFecharCb = null; }
  }
  function cabecalhoModal(icone, titulo, sub) {
    return `<div class="dg-modal-head"><span class="dg-title-ico">${ic(icone)}</span><div><h3 id="dgModalTitulo">${esc(titulo)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button type="button" class="dg-icon-btn dg-modal-x" data-dg-fechar aria-label="Fechar">${ic('ic-x')}</button></div>`;
  }
  function confirmar({ titulo, texto, rotulo, perigo, aoConfirmar }) {
    abrirModal(`${cabecalhoModal(perigo ? 'ic-alert-triangle' : 'ic-shield', titulo)}
      <div class="dg-aviso ${perigo ? '' : 'dg-aviso--info'}">${ic(perigo ? 'ic-alert-triangle' : 'ic-sparkle')}<span>${texto}</span></div>
      <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Cancelar</button><button type="button" class="dg-btn ${perigo ? 'dg-btn--danger' : 'dg-btn--primary'}" id="dgConfirmarOk">${esc(rotulo || 'Confirmar')}</button></div>`,
    (m) => m.querySelector('#dgConfirmarOk').addEventListener('click', () => { fecharModal(); aoConfirmar(); }));
  }
  function copiar(texto) {
    const ok = () => toast('Link copiado.', 'confirm');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).then(ok, () => fallbackCopiar(texto, ok));
    else fallbackCopiar(texto, ok);
  }
  function fallbackCopiar(texto, ok) {
    const t = document.createElement('textarea'); t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); ok(); } catch (e) { toast('Não foi possível copiar.'); }
    t.remove();
  }

  const ROTULO_STATUS = { enviado: 'Enviado', erro: 'Erro', fila: 'Na fila' };
  let filtroStatus = 'todos';
  let termoBusca = '';

  function listaSelecionada() { return S.listas.find((l) => l.id === S.listaAtiva) || null; }

  function renderKpis() {
    const c = (s) => S.envios.filter((e) => e.status === s).length;
    const ativos = S.links.filter((l) => linkAtivo(l)).length;
    const kpis = [
      { cls: 'dg-kpi--ok', ico: 'ic-check', n: c('enviado'), t: 'Enviados' },
      { cls: 'dg-kpi--erro', ico: 'ic-alert-triangle', n: c('erro'), t: 'Com erro' },
      { cls: 'dg-kpi--fila', ico: 'ic-clock', n: c('fila'), t: 'Na fila' },
      { cls: '', ico: 'ic-link', n: ativos, t: 'Links ativos' },
    ];
    $('dgKpis').innerHTML = kpis.map((k, i) => `<div class="dg-kpi ${k.cls}" style="--i:${i}"><span class="dg-kpi-ico">${ic(k.ico)}</span><div><strong>${k.n}</strong><span>${k.t}</span></div></div>`).join('');
  }

  function renderListas() {
    const itens = [{ id: 'todas', nome: 'Todos os contatos', n: S.listas.reduce((a, l) => a + l.emails.length, 0), fixa: true }]
      .concat(S.listas.map((l) => ({ id: l.id, nome: l.nome, n: l.emails.length })));
    $('dgListas').innerHTML = itens.map((l) => `
      <div class="dg-lista ${S.listaAtiva === l.id ? 'is-ativa' : ''}" role="option" tabindex="0" aria-selected="${S.listaAtiva === l.id}" data-lista="${esc(l.id)}">
        <span class="dg-lista-ico">${ic(l.fixa ? 'ic-users' : 'ic-mail')}</span>
        <span class="dg-lista-txt"><strong>${esc(l.nome)}</strong><small>${l.n} contato${l.n === 1 ? '' : 's'}</small></span>
        ${l.fixa ? '' : `<button type="button" class="dg-lista-x" data-lista-del="${esc(l.id)}" title="Excluir lista" aria-label="Excluir lista ${esc(l.nome)}">${ic('ic-trash')}</button>`}
      </div>`).join('');
    const sel = listaSelecionada();
    const form = $('dgAddEmail');
    form.style.display = sel ? '' : 'none';
    $('dgContatos').innerHTML = sel
      ? (sel.emails.length
        ? sel.emails.map((e) => `<span class="dg-email"><span>${esc(e)}</span><button type="button" data-email-del="${esc(e)}" aria-label="Remover ${esc(e)}">${ic('ic-x')}</button></span>`).join('')
        : '<p class="dg-dica">Esta lista ainda não tem contatos. Adicione um e-mail acima.</p>')
      : '<p class="dg-dica">Selecione uma lista para editar seus contatos ou filtrar o histórico.</p>';
  }

  function enviosFiltrados() {
    const sel = listaSelecionada();
    const t = termoBusca.trim().toLowerCase();
    return S.envios.filter((e) => (!sel || e.lista === sel.nome)
      && (filtroStatus === 'todos' || e.status === filtroStatus)
      && (!t || e.id.toLowerCase().includes(t) || e.dest.toLowerCase().includes(t)));
  }

  function renderEnvios() {
    const base = S.envios.filter((e) => !listaSelecionada() || e.lista === listaSelecionada().nome);
    const cont = { todos: base.length, enviado: 0, fila: 0, erro: 0 };
    base.forEach((e) => { cont[e.status] = (cont[e.status] || 0) + 1; });
    document.querySelectorAll('#dgFiltros .dg-chip').forEach((b) => {
      b.classList.toggle('is-ativo', b.dataset.dgFiltro === filtroStatus);
      b.querySelector('b').textContent = cont[b.dataset.dgFiltro] ?? 0;
    });
    const linhas = enviosFiltrados().sort((a, b) => new Date(b.quando) - new Date(a.quando));
    $('dgEnviosBody').innerHTML = linhas.map((e, i) => `
      <tr style="--i:${Math.min(i, 12)}">
        <td><span class="dg-id">${esc(e.id)}</span></td>
        <td><span class="dg-data">${dataBR(e.quando)}<small>${horaBR(e.quando)}</small></span></td>
        <td><span class="dg-dest"><strong title="${esc(e.dest)}">${esc(e.dest)}</strong><small>${esc(e.lista)}</small></span></td>
        <td><span class="dg-pill dg-pill--${e.status === 'enviado' ? 'ok' : e.status}"><i></i>${ROTULO_STATUS[e.status]}</span></td>
        <td><div class="dg-acoes">
          <button type="button" class="dg-icon-btn" data-envio-ver="${esc(e.id)}" title="Ver detalhes" aria-label="Ver detalhes de ${esc(e.id)}">${ic('ic-eye')}</button>
          ${e.status === 'erro' ? `<button type="button" class="dg-icon-btn dg-icon-btn--ok" data-envio-reenviar="${esc(e.id)}" title="Reenviar" aria-label="Reenviar ${esc(e.id)}">${ic('dg-refresh')}</button>` : ''}
          <button type="button" class="dg-icon-btn dg-icon-btn--danger" data-envio-del="${esc(e.id)}" title="Excluir do histórico" aria-label="Excluir ${esc(e.id)}">${ic('ic-trash')}</button>
        </div></td>
      </tr>`).join('');
    $('dgEnviosVazio').hidden = linhas.length > 0;
    $('dgEnviosBody').closest('.dg-table-wrap').hidden = linhas.length === 0;
  }

  function linkAtivo(l) { return l.ativo && (!l.expira || new Date(l.expira) > new Date()); }
  function rotuloExpira(l) {
    if (!l.ativo) return 'Revogado';
    if (!l.expira) return 'Sem expiração';
    if (new Date(l.expira) <= new Date()) return 'Expirado';
    return 'Expira ' + dataHoraBR(l.expira);
  }
  function urlLink(l) { return `${location.origin}/compartilhado/${l.token}`; }

  function renderLinks() {
    $('dgLinksCount').textContent = S.links.filter(linkAtivo).length;
    if (!S.links.length) {
      $('dgLinks').innerHTML = `<div class="dg-vazio" style="grid-column:1/-1">${ic('dg-lock')}<strong>Nenhum link compartilhado</strong><span>Use "Gerar link" para liberar um relatório com acesso seguro.</span></div>`;
      return;
    }
    $('dgLinks').innerHTML = S.links.map((l, i) => `
      <div class="dg-link ${linkAtivo(l) ? '' : 'is-inativo'}" style="animation-delay:${i * 40}ms">
        <div class="dg-link-top"><strong title="${esc(l.rotulo)}">${esc(l.rotulo)}</strong><span class="dg-pill ${linkAtivo(l) ? 'dg-pill--ok' : ''}"><i></i>${linkAtivo(l) ? 'Ativo' : 'Inativo'}</span></div>
        <div class="dg-link-url"><span>${esc(urlLink(l))}</span><button type="button" class="dg-icon-btn" style="width:28px;height:28px" data-link-copiar="${esc(l.id)}" title="Copiar link" aria-label="Copiar link">${ic('dg-copy')}</button></div>
        <div class="dg-link-meta"><span>${ic('ic-clock')} <b>${esc(rotuloExpira(l))}</b></span><span>${ic(l.senha ? 'dg-lock' : 'ic-globe')} <b>${l.senha ? 'Com senha' : 'Somente leitura'}</b></span></div>
        ${linkAtivo(l) ? `<button type="button" class="dg-btn dg-btn--danger dg-btn--sm" data-link-revogar="${esc(l.id)}">${ic('ic-x')}<span>Revogar acesso</span></button>` : `<button type="button" class="dg-btn dg-btn--ghost dg-btn--sm" data-link-del="${esc(l.id)}">${ic('ic-trash')}<span>Remover</span></button>`}
      </div>`).join('');
  }

  function renderDistribuicao() { renderKpis(); renderListas(); renderEnvios(); renderLinks(); }

  function adicionarEmail(email) {
    const l = listaSelecionada(); if (!l) return;
    email = email.trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) return toast('Informe um e-mail válido.');
    if (l.emails.includes(email)) return toast('Esse e-mail já está na lista.');
    l.emails.push(email); salvar(); renderListas(); renderKpis();
    registrarLog('Contato adicionado', `Lista ${l.nome}`, 'alteracao', email);
  }
  function modalNovaLista() {
    abrirModal(`${cabecalhoModal('ic-users', 'Nova lista de contatos', 'Agrupe quem deve receber os mesmos relatórios.')}
      <form class="dg-form" id="dgFormLista" autocomplete="off"><label class="dg-campo"><span>Nome da lista</span><input id="dgListaNome" maxlength="40" placeholder="Ex.: Financeiro" required></label>
      <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Cancelar</button><button type="submit" class="dg-btn dg-btn--primary">Criar lista</button></div></form>`,
    (m) => m.querySelector('#dgFormLista').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nome = m.querySelector('#dgListaNome').value.trim();
      if (!nome) return;
      if (S.listas.some((l) => l.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe uma lista com esse nome.');
      const nova = { id: uid('l'), nome, emails: [] };
      S.listas.push(nova); S.listaAtiva = nova.id; salvar(); fecharModal(); renderDistribuicao();
      registrarLog('Lista criada', `Lista ${nome}`, 'criacao');
      toast('Lista criada.');
    }));
  }
  function excluirLista(id) {
    const l = S.listas.find((x) => x.id === id); if (!l) return;
    confirmar({ titulo: 'Excluir lista?', perigo: true, rotulo: 'Excluir', texto: `A lista <b>${esc(l.nome)}</b> e seus ${l.emails.length} contato(s) serão removidos. O histórico de envios é mantido.`,
      aoConfirmar: () => { S.listas = S.listas.filter((x) => x.id !== id); if (S.listaAtiva === id) S.listaAtiva = 'todas'; salvar(); renderDistribuicao(); registrarLog('Lista excluída', `Lista ${l.nome}`, 'exclusao'); toast('Lista excluída.'); } });
  }

  function proximoId() { S.seq += 1; return 'REL-' + String(S.seq).padStart(5, '0'); }

  function processarFila(ids) {
    setTimeout(() => {
      ids.forEach((id) => {
        const e = S.envios.find((x) => x.id === id); if (!e || e.status !== 'fila') return;
        if (REGEX_EMAIL.test(e.dest)) { e.status = 'enviado'; delete e.erro; }
        else { e.status = 'erro'; e.erro = 'Endereço de e-mail inválido.'; }
      });
      salvar(); renderKpis(); renderEnvios();
      const falhas = ids.filter((id) => S.envios.find((x) => x.id === id)?.status === 'erro').length;
      toast(falhas ? `${falhas} envio(s) com erro. Veja o histórico.` : 'Relatório enviado com sucesso.', falhas ? 'error' : 'chimeSuccess');
    }, 1300);
  }

  function modalEnviar() {
    if (!S.listas.some((l) => l.emails.length)) return toast('Crie uma lista com pelo menos um contato antes de enviar.');
    const opcoes = S.listas.filter((l) => l.emails.length).map((l) => `<option value="${esc(l.id)}" ${l.id === S.listaAtiva ? 'selected' : ''}>${esc(l.nome)} (${l.emails.length})</option>`).join('');
    abrirModal(`${cabecalhoModal('dg-send', 'Enviar relatório', 'Dispara para todos os contatos da lista escolhida.')}
      <form class="dg-form" id="dgFormEnvio" autocomplete="off">
        <label class="dg-campo"><span>Lista de destinatários</span><select id="dgEnvLista">${opcoes}</select></label>
        <label class="dg-campo"><span>Assunto</span><input id="dgEnvAssunto" value="${esc(S.config.assunto)}" maxlength="120" required></label>
        <div class="dg-switch-row"><button type="button" class="dg-switch" id="dgEnvPdf" role="switch" aria-checked="${S.config.anexarPdf}" aria-label="Anexar PDF"><i></i></button><div><strong>Anexar relatório em PDF</strong><small>O PDF gerado na tela Visualização de Relatórios segue junto.</small></div></div>
        <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Cancelar</button><button type="submit" class="dg-btn dg-btn--primary">${ic('dg-send')}<span>Enviar agora</span></button></div>
      </form>`,
    (m) => {
      ligarSwitch(m.querySelector('#dgEnvPdf'));
      m.querySelector('#dgFormEnvio').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const l = S.listas.find((x) => x.id === m.querySelector('#dgEnvLista').value); if (!l) return;
        const assunto = m.querySelector('#dgEnvAssunto').value.trim() || S.config.assunto;
        const ids = l.emails.map((dest) => { const id = proximoId(); S.envios.unshift({ id, quando: agora(), dest, lista: l.nome, status: 'fila', assunto, tentativas: 1 }); return id; });
        salvar(); fecharModal(); renderKpis(); renderEnvios();
        registrarLog('Relatório enviado', `Lista ${l.nome}`, 'criacao', `${ids.length} destinatário(s) · ${assunto}`);
        toast(`${ids.length} envio(s) na fila.`);
        processarFila(ids);
      });
    });
  }

  function modalDetalheEnvio(id) {
    const e = S.envios.find((x) => x.id === id); if (!e) return;
    abrirModal(`${cabecalhoModal('ic-mail', e.id, 'Detalhes do envio')}
      <div class="dg-detalhe">
        <div><span>Status</span><b><span class="dg-pill dg-pill--${e.status === 'enviado' ? 'ok' : e.status}"><i></i>${ROTULO_STATUS[e.status]}</span></b></div>
        <div><span>Data e hora</span><b>${esc(dataHoraBR(e.quando))}</b></div>
        <div><span>Destinatário</span><b>${esc(e.dest)}</b></div>
        <div><span>Lista</span><b>${esc(e.lista)}</b></div>
        <div><span>Assunto</span><b>${esc(e.assunto || '—')}</b></div>
        <div><span>Tentativas</span><b>${e.tentativas || 1}</b></div>
      </div>
      ${e.status === 'erro' ? `<div class="dg-aviso" style="margin-top:12px">${ic('ic-alert-triangle')}<span>${esc(e.erro || 'Falha no envio.')}</span></div>` : ''}
      <div class="dg-modal-foot">${e.status === 'erro' ? `<button type="button" class="dg-btn dg-btn--ok" id="dgDetReenviar">${ic('dg-refresh')}<span>Reenviar</span></button>` : ''}<button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Fechar</button></div>`,
    (m) => m.querySelector('#dgDetReenviar')?.addEventListener('click', () => { fecharModal(); reenviar(id); }));
  }
  function reenviar(id) {
    const e = S.envios.find((x) => x.id === id); if (!e) return;
    e.status = 'fila'; e.tentativas = (e.tentativas || 1) + 1; e.quando = agora(); delete e.erro;
    salvar(); renderKpis(); renderEnvios();
    registrarLog('Envio reenviado', e.id, 'alteracao', e.dest);
    toast('Reenviando…'); processarFila([id]);
  }
  function excluirEnvio(id) {
    confirmar({ titulo: 'Excluir do histórico?', perigo: true, rotulo: 'Excluir', texto: `O registro <b>${esc(id)}</b> deixa de aparecer no histórico de rastreabilidade.`,
      aoConfirmar: () => { S.envios = S.envios.filter((e) => e.id !== id); salvar(); renderKpis(); renderEnvios(); registrarLog('Envio excluído', id, 'exclusao'); toast('Registro excluído.'); } });
  }

  function modalConfigEmail() {
    const c = S.config;
    abrirModal(`${cabecalhoModal('ic-mail', 'Configuração de e-mails', 'Envio automático de relatórios para listas configuráveis.')}
      <form class="dg-form" id="dgFormCfg" autocomplete="off">
        <label class="dg-campo"><span>Remetente</span><input type="email" id="dgCfgRem" value="${esc(c.remetente)}" required></label>
        <label class="dg-campo"><span>Assunto padrão</span><input id="dgCfgAss" value="${esc(c.assunto)}" maxlength="120" required></label>
        <div class="dg-form-2">
          <label class="dg-campo"><span>Envio automático</span><select id="dgCfgFreq">
            <option value="manual" ${c.frequencia === 'manual' ? 'selected' : ''}>Somente manual</option>
            <option value="diario" ${c.frequencia === 'diario' ? 'selected' : ''}>Todos os dias</option>
            <option value="semanal" ${c.frequencia === 'semanal' ? 'selected' : ''}>Toda semana</option>
            <option value="mensal" ${c.frequencia === 'mensal' ? 'selected' : ''}>Todo mês</option></select></label>
          <label class="dg-campo"><span>Horário</span><input type="time" id="dgCfgHora" value="${esc(c.hora)}"></label>
        </div>
        <div class="dg-switch-row"><button type="button" class="dg-switch" id="dgCfgPdf" role="switch" aria-checked="${c.anexarPdf}" aria-label="Anexar PDF por padrão"><i></i></button><div><strong>Anexar PDF por padrão</strong><small>Vale para novos envios manuais e automáticos.</small></div></div>
        <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Cancelar</button><button type="submit" class="dg-btn dg-btn--primary">${ic('ic-check')}<span>Salvar</span></button></div>
      </form>`,
    (m) => {
      ligarSwitch(m.querySelector('#dgCfgPdf'));
      m.querySelector('#dgFormCfg').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const rem = m.querySelector('#dgCfgRem').value.trim();
        if (!REGEX_EMAIL.test(rem)) return toast('Informe um remetente válido.');
        S.config = { remetente: rem, assunto: m.querySelector('#dgCfgAss').value.trim() || 'Relatório Nexus Air', frequencia: m.querySelector('#dgCfgFreq').value, hora: m.querySelector('#dgCfgHora').value || '08:00', anexarPdf: m.querySelector('#dgCfgPdf').getAttribute('aria-checked') === 'true' };
        salvar(); fecharModal();
        registrarLog('Configuração de e-mail alterada', 'Distribuição', 'alteracao', `Remetente ${rem} · ${S.config.frequencia}`);
        toast('Configuração de e-mails salva.');
      });
    });
  }

  function token() {
    const a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function modalGerarLink() {
    abrirModal(`${cabecalhoModal('ic-link', 'Gerar link compartilhável', 'Acesso externo seguro, somente leitura.')}
      <form class="dg-form" id="dgFormLink" autocomplete="off">
        <label class="dg-campo"><span>Relatório ou descrição</span><input id="dgLkRot" maxlength="60" placeholder="Ex.: Resolução de suporte · Outubro" required></label>
        <div class="dg-form-2">
          <label class="dg-campo"><span>Validade</span><select id="dgLkVal"><option value="60">1 hora</option><option value="1440" selected>24 horas</option><option value="10080">7 dias</option><option value="43200">30 dias</option><option value="0">Sem expiração</option></select></label>
          <label class="dg-campo"><span>Senha (opcional)</span><input type="text" id="dgLkSenha" maxlength="40" placeholder="Protege o acesso"></label>
        </div>
        <div class="dg-aviso dg-aviso--info">${ic('dg-lock')}<span>O link é aleatório e pode ser revogado a qualquer momento no painel de Controle de acesso.</span></div>
        <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Cancelar</button><button type="submit" class="dg-btn dg-btn--primary">${ic('ic-link')}<span>Gerar link</span></button></div>
      </form>`,
    (m) => m.querySelector('#dgFormLink').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const min = parseInt(m.querySelector('#dgLkVal').value, 10);
      const l = { id: uid('k'), token: token(), rotulo: m.querySelector('#dgLkRot').value.trim(), criado: agora(), expira: min ? new Date(Date.now() + min * 60000).toISOString() : null, senha: !!m.querySelector('#dgLkSenha').value.trim(), ativo: true };
      S.links.unshift(l); salvar(); renderKpis(); renderLinks();
      registrarLog('Link compartilhável gerado', l.rotulo, 'criacao', rotuloExpira(l));
      abrirModal(`${cabecalhoModal('ic-check', 'Link gerado', 'Copie e envie para quem deve acessar.')}
        <div class="dg-url-gerada"><span>${esc(urlLink(l))}</span><button type="button" class="dg-btn dg-btn--primary dg-btn--sm" id="dgLkCopiar">${ic('dg-copy')}<span>Copiar</span></button></div>
        <div class="dg-detalhe" style="margin-top:12px"><div><span>Relatório</span><b>${esc(l.rotulo)}</b></div><div><span>Validade</span><b>${esc(rotuloExpira(l))}</b></div><div><span>Proteção</span><b>${l.senha ? 'Senha exigida' : 'Somente leitura'}</b></div></div>
        <div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Concluir</button></div>`,
      (m2) => m2.querySelector('#dgLkCopiar').addEventListener('click', () => copiar(urlLink(l))));
    }));
  }

  function ligarDistribuicao() {
    $('dgBtnConfig').addEventListener('click', modalConfigEmail);
    $('dgBtnLink').addEventListener('click', modalGerarLink);
    $('dgBtnEnviar').addEventListener('click', modalEnviar);
    $('dgNovaLista').addEventListener('click', modalNovaLista);
    $('dgAddEmail').addEventListener('submit', (ev) => { ev.preventDefault(); const i = $('dgAddEmailInput'); adicionarEmail(i.value); i.value = ''; i.focus(); });
    $('dgBusca').addEventListener('input', (ev) => { termoBusca = ev.target.value; renderEnvios(); });
    $('dgFiltros').addEventListener('click', (ev) => { const b = ev.target.closest('[data-dg-filtro]'); if (!b) return; filtroStatus = b.dataset.dgFiltro; renderEnvios(); });

    $('dgListas').addEventListener('click', (ev) => {
      const del = ev.target.closest('[data-lista-del]');
      if (del) { ev.stopPropagation(); return excluirLista(del.dataset.listaDel); }
      const it = ev.target.closest('[data-lista]'); if (!it) return;
      S.listaAtiva = it.dataset.lista; salvar(); renderListas(); renderEnvios();
    });
    $('dgListas').addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-lista]')) { ev.preventDefault(); ev.target.click(); } });
    $('dgContatos').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-email-del]'); const l = listaSelecionada(); if (!b || !l) return;
      l.emails = l.emails.filter((e) => e !== b.dataset.emailDel); salvar(); renderListas();
      registrarLog('Contato removido', `Lista ${l.nome}`, 'exclusao', b.dataset.emailDel);
    });
    $('dgEnviosBody').addEventListener('click', (ev) => {
      const v = ev.target.closest('[data-envio-ver]'); if (v) return modalDetalheEnvio(v.dataset.envioVer);
      const r = ev.target.closest('[data-envio-reenviar]'); if (r) return reenviar(r.dataset.envioReenviar);
      const d = ev.target.closest('[data-envio-del]'); if (d) excluirEnvio(d.dataset.envioDel);
    });
    $('dgLinks').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-link-copiar]'); if (c) { const l = S.links.find((x) => x.id === c.dataset.linkCopiar); if (l) copiar(urlLink(l)); return; }
      const r = ev.target.closest('[data-link-revogar]');
      if (r) { const l = S.links.find((x) => x.id === r.dataset.linkRevogar); if (!l) return;
        return confirmar({ titulo: 'Revogar acesso?', perigo: true, rotulo: 'Revogar', texto: `Quem tiver o link de <b>${esc(l.rotulo)}</b> deixa de conseguir abrir o relatório.`,
          aoConfirmar: () => { l.ativo = false; salvar(); renderKpis(); renderLinks(); registrarLog('Link revogado', l.rotulo, 'seguranca'); toast('Acesso revogado.'); } }); }
      const d = ev.target.closest('[data-link-del]'); if (d) { S.links = S.links.filter((x) => x.id !== d.dataset.linkDel); salvar(); renderKpis(); renderLinks(); }
    });
  }

  let usuarios = [];
  let selecionados = new Set();

  function ligarSwitch(el, aoMudar) {
    if (!el) return;
    el.addEventListener('click', () => {
      const novo = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(novo));
      if (aoMudar) aoMudar(novo);
    });
  }
  function setSwitch(el, v) { if (el) el.setAttribute('aria-checked', String(!!v)); }

  function iniciais(nome) { return (String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase(); }
  const ativoUsuario = (u) => S.statusUsuarios[u.id] !== false;

  function renderUsuarios() {
    $('dgUsuariosCount').textContent = usuarios.length;
    $('dgUsuariosBody').innerHTML = usuarios.map((u, i) => `
      <tr style="--i:${Math.min(i, 12)}">
        <td><label class="dg-check"><input type="checkbox" data-sel="${u.id}" ${selecionados.has(u.id) ? 'checked' : ''} aria-label="Selecionar ${esc(u.nome)}"><i></i></label></td>
        <td><div class="dg-perfil"><span class="dg-avatar">${esc(iniciais(u.nome))}</span><span class="dg-perfil-txt"><strong title="${esc(u.nome)}">${esc(u.nome)}</strong><small>${esc(u.email || '')}</small></span></div></td>
        <td><select class="dg-nivel" data-nivel="${u.id}" aria-label="Nível de acesso de ${esc(u.nome)}"><option value="admin" ${u.tipo_acesso === 'admin' ? 'selected' : ''}>Administrador</option><option value="padrao" ${u.tipo_acesso !== 'admin' ? 'selected' : ''}>Usuário comum</option></select></td>
        <td><span class="dg-status"><button type="button" class="dg-switch dg-switch--verde" data-ativo="${u.id}" role="switch" aria-checked="${ativoUsuario(u)}" aria-label="Conta ativa de ${esc(u.nome)}"><i></i></button>${ativoUsuario(u) ? 'Ativo' : 'Inativo'}</span></td>
      </tr>`).join('');
    const vazio = usuarios.length === 0;
    $('dgUsuariosVazio').hidden = !vazio;
    $('dgUsuariosBody').closest('.dg-table-wrap').hidden = vazio;
    atualizarBulk();
  }
  function atualizarBulk() {
    const n = selecionados.size;
    $('dgBulk').hidden = n === 0;
    $('dgBulkN').textContent = n;
    const all = $('dgUsersAll');
    all.checked = n > 0 && n === usuarios.length;
    all.indeterminate = n > 0 && n < usuarios.length;
  }

  async function carregarUsuariosGov() {
    try {
      const r = await fetch('/api/usuarios', { credentials: 'same-origin', cache: 'no-store' });
      const corpo = await r.json().catch(() => ({}));
      if (r.status === 403 || r.status === 401) { usuarios = []; $('dgUsuariosVazioTxt').textContent = 'Somente administradores podem gerenciar permissões.'; return renderUsuarios(); }
      if (!r.ok) throw new Error();
      usuarios = Array.isArray(corpo.data) ? corpo.data : [];
      selecionados = new Set([...selecionados].filter((id) => usuarios.some((u) => u.id === id)));
      renderUsuarios();
    } catch (e) { usuarios = []; $('dgUsuariosVazioTxt').textContent = 'Não foi possível carregar os usuários agora.'; renderUsuarios(); }
  }

  async function salvarNivel(id, tipo) {
    const r = await fetch(`/api/usuarios/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo_acesso: tipo }) });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.message || 'Falha ao salvar o nível de acesso.');
    return corpo;
  }
  const rotuloNivel = (t) => (t === 'admin' ? 'Administrador' : 'Usuário comum');

  async function mudarNivel(id, tipo, select) {
    const u = usuarios.find((x) => x.id === id); if (!u || u.tipo_acesso === tipo) return;
    const anterior = u.tipo_acesso;
    try {
      await salvarNivel(id, tipo); u.tipo_acesso = tipo;
      registrarLog('Nível de acesso alterado', u.nome, 'alteracao', `${rotuloNivel(anterior)} → ${rotuloNivel(tipo)}`);
      toast(`${u.nome}: ${rotuloNivel(tipo)}.`);
    } catch (e) { if (select) select.value = anterior; toast(e.message); }
  }

  function ligarUsuarios() {
    $('dgUsuariosBody').addEventListener('change', (ev) => {
      const sel = ev.target.closest('[data-sel]');
      if (sel) { const id = Number(sel.dataset.sel); sel.checked ? selecionados.add(id) : selecionados.delete(id); return atualizarBulk(); }
      const nv = ev.target.closest('[data-nivel]'); if (nv) mudarNivel(Number(nv.dataset.nivel), nv.value, nv);
    });
    $('dgUsuariosBody').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ativo]'); if (!b) return;
      const id = Number(b.dataset.ativo); const u = usuarios.find((x) => x.id === id); if (!u) return;
      const ativo = !ativoUsuario(u); S.statusUsuarios[id] = ativo; salvar(); renderUsuarios();
      registrarLog(ativo ? 'Conta ativada' : 'Conta desativada', u.nome, 'seguranca');
    });
    $('dgUsersAll').addEventListener('change', (ev) => { selecionados = ev.target.checked ? new Set(usuarios.map((u) => u.id)) : new Set(); renderUsuarios(); });
    $('dgBulkAplicar').addEventListener('click', async () => {
      const tipo = $('dgBulkNivel').value; const ids = [...selecionados]; let ok = 0;
      for (const id of ids) { const u = usuarios.find((x) => x.id === id); if (!u || u.tipo_acesso === tipo) continue;
        try { await salvarNivel(id, tipo); const ant = u.tipo_acesso; u.tipo_acesso = tipo; ok++; registrarLog('Nível de acesso alterado', u.nome, 'alteracao', `${rotuloNivel(ant)} → ${rotuloNivel(tipo)}`); } catch (e) { toast(e.message); } }
      selecionados = new Set(); renderUsuarios(); if (ok) toast(`${ok} usuário(s) atualizado(s).`);
    });
  }

  const ROTULO_TIPO = { criacao: 'Criação', alteracao: 'Alteração', restauracao: 'Restauração', exclusao: 'Exclusão', seguranca: 'Segurança' };
  function renderLog() {
    $('dgLogVazio').hidden = S.log.length > 0;
    $('dgLogLista').innerHTML = S.log.map((e, i) => `
      <div class="dg-evento" data-tipo="${esc(e.tipo)}" style="animation-delay:${Math.min(i, 10) * 30}ms">
        <span class="dg-ponto"></span>
        <div class="dg-evento-txt"><strong>${esc(e.acao)}${e.objeto ? ` · <span style="font-weight:600;color:var(--text-muted)">${esc(e.objeto)}</span>` : ''}</strong><small>${esc(e.usuario)} · ${esc(dataHoraBR(e.quando))}</small></div>
        <div class="dg-evento-lado"><span class="dg-tag">${ROTULO_TIPO[e.tipo] || 'Alteração'}</span><button type="button" class="dg-linkbtn" data-log="${esc(e.id)}">Ver log</button></div>
      </div>`).join('');
  }
  function modalLog(id) {
    const e = S.log.find((x) => x.id === id); if (!e) return;
    abrirModal(`${cabecalhoModal('dg-history', e.acao, 'Detalhes do registro')}
      <div class="dg-detalhe" data-tipo="${esc(e.tipo)}">
        <div><span>Data e hora</span><b>${esc(dataHoraBR(e.quando))}</b></div><div><span>Usuário</span><b>${esc(e.usuario)}</b></div>
        <div><span>Ação</span><b>${esc(e.acao)}</b></div><div><span>Objeto</span><b>${esc(e.objeto || '—')}</b></div>
        <div><span>Tipo</span><b>${ROTULO_TIPO[e.tipo] || 'Alteração'}</b></div>${e.detalhe ? `<div><span>Detalhe</span><b>${esc(e.detalhe)}</b></div>` : ''}
      </div><div class="dg-modal-foot"><button type="button" class="dg-btn dg-btn--ghost" data-dg-fechar>Fechar</button></div>`);
  }

  function snapshot() {
    return { gov: JSON.parse(JSON.stringify(S.gov)), statusUsuarios: { ...S.statusUsuarios }, niveis: Object.fromEntries(usuarios.map((u) => [u.id, u.tipo_acesso])), config: { ...S.config } };
  }
  function criarVersao(rotulo) {
    S.versoes.unshift({ id: uid('v'), quando: agora(), rotulo, snap: snapshot(), por: usuarioAtual() });
    S.versoes = S.versoes.slice(0, 15); salvar(); renderSeguranca();
  }
  function renderVersoes() {
    setSwitch($('dgVersionar'), S.gov.versionar);
    $('dgNovaVersao').disabled = !S.gov.versionar;
    $('dgVersoes').innerHTML = !S.gov.versionar
      ? '<p class="dg-dica">Ative o versionamento para guardar o histórico de versões das configurações.</p>'
      : (S.versoes.length ? S.versoes.map((v, i) => `<div class="dg-versao" style="animation-delay:${i * 30}ms"><span class="dg-versao-ico">${ic('dg-layers')}</span><span class="dg-versao-txt"><strong>${esc(v.rotulo)}</strong><small>${esc(dataHoraBR(v.quando))} · ${esc(v.por)}</small></span><button type="button" class="dg-btn dg-btn--ghost dg-btn--sm" data-versao-rest="${esc(v.id)}">${ic('dg-restore')}<span>Restaurar</span></button></div>`).join('') : '<p class="dg-dica">Nenhuma versão ainda. Use "Criar versão agora".</p>');
  }
  function restaurarVersao(id) {
    const v = S.versoes.find((x) => x.id === id); if (!v) return;
    confirmar({ titulo: 'Restaurar versão anterior?', rotulo: 'Restaurar', texto: `As configurações voltam ao estado de <b>${esc(dataHoraBR(v.quando))}</b>, incluindo os níveis de acesso dos usuários. Uma cópia do estado atual é salva antes.`,
      aoConfirmar: async () => {
        criarVersao('Antes de restaurar ' + horaBR(v.quando));
        S.gov = Object.assign({}, S.gov, v.snap.gov, { versionar: true }); S.statusUsuarios = { ...v.snap.statusUsuarios }; S.config = { ...S.config, ...v.snap.config };
        let falhas = 0;
        for (const u of usuarios) { const alvo = v.snap.niveis?.[u.id]; if (alvo && alvo !== u.tipo_acesso) { try { await salvarNivel(u.id, alvo); u.tipo_acesso = alvo; } catch (e) { falhas++; } } }
        salvar(); renderGov(); renderUsuarios();
        registrarLog('Versão restaurada', dataHoraBR(v.quando), 'restauracao', falhas ? `${falhas} nível(is) não puderam ser restaurados` : 'Configurações e níveis de acesso');
        toast(falhas ? 'Restaurado, mas alguns níveis não puderam ser revertidos.' : 'Versão restaurada.', falhas ? 'error' : 'chimeSuccess');
      } });
  }

  const FREQ = { diario: 'todos os dias', semanal: 'toda semana', mensal: 'todo mês' };
  function proximoBackup() {
    if (!S.gov.bkAtivo) return null;
    const [h, m] = (S.gov.bkHora || '02:00').split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    const passo = { diario: 1, semanal: 7, mensal: 30 }[S.gov.bkFreq] || 1;
    while (d <= new Date()) d.setDate(d.getDate() + passo);
    return d.toISOString();
  }
  function renderBackup() {
    $('dgBkFreq').value = S.gov.bkFreq; $('dgBkHora').value = S.gov.bkHora; window.NexusPicker?.sync($('dgBkHora').closest('[data-nx-picker]'));
    const st = $('dgBackupStatus'); st.className = 'dg-pill' + (S.gov.bkAtivo ? ' dg-pill--ok' : ''); st.innerHTML = `<i></i>${S.gov.bkAtivo ? 'Agendado' : 'Desligado'}`;
    const ult = S.backups[0]; const prox = proximoBackup();
    $('dgBkInfo').innerHTML = `<span>${ic('ic-clock')} Último: <b>${ult ? esc(dataHoraBR(ult.quando)) : 'nenhum'}</b></span><span>${ic('ic-calendar')} Próximo: <b>${prox ? esc(dataHoraBR(prox)) : 'não agendado'}</b></span>`;
    $('dgBackups').innerHTML = S.backups.slice(0, 5).map((b, i) => `<div class="dg-versao" style="animation-delay:${i * 30}ms"><span class="dg-versao-ico">${ic('dg-cloud')}</span><span class="dg-versao-txt"><strong>Backup ${b.tipo === 'automatico' ? 'automático' : 'manual'}</strong><small>${esc(dataHoraBR(b.quando))} · ${esc(b.itens)}</small></span><button type="button" class="dg-btn dg-btn--ghost dg-btn--sm" data-bk-rec="${esc(b.id)}">${ic('dg-restore')}<span>Recuperar</span></button></div>`).join('');
  }
  function fazerBackup(tipo) {
    const b = { id: uid('b'), quando: agora(), tipo, itens: `${S.listas.length} lista(s), ${S.envios.length} envio(s), ${S.links.length} link(s), configurações`, dados: { listas: S.listas, envios: S.envios, links: S.links, config: S.config, gov: S.gov, statusUsuarios: S.statusUsuarios } };
    S.backups.unshift(b); S.backups = S.backups.slice(0, 8); salvar(); renderBackup();
    registrarLog(tipo === 'automatico' ? 'Backup automático realizado' : 'Backup manual realizado', 'Dados', 'criacao', b.itens);
  }
  function recuperarBackup(id) {
    const b = S.backups.find((x) => x.id === id); if (!b) return;
    confirmar({ titulo: 'Recuperar dados deste backup?', rotulo: 'Recuperar', texto: `Listas, histórico de envios, links e configurações voltam ao estado de <b>${esc(dataHoraBR(b.quando))}</b>. O estado atual não será guardado, então faça um backup antes se precisar dele.`, perigo: true,
      aoConfirmar: () => { Object.assign(S, JSON.parse(JSON.stringify(b.dados))); salvar(); renderDistribuicao(); renderGov(); registrarLog('Dados recuperados de backup', dataHoraBR(b.quando), 'restauracao'); toast('Dados recuperados.'); } });
  }

  function rodarBackupVencido() {
    if (!S.gov.bkAtivo) return;
    const passoH = { diario: 24, semanal: 168, mensal: 720 }[S.gov.bkFreq] || 24;
    const ult = S.backups[0]; if (!ult) return;
    if ((Date.now() - new Date(ult.quando)) / 3600000 >= passoH) fazerBackup('automatico');
  }

  function renderSeguranca() { renderVersoes(); renderBackup(); }
  function renderGov() {
    setSwitch($('dgExigirWeb'), S.gov.exigirWeb);
    $('dgWebStatus').innerHTML = `<i></i>${S.gov.exigirWeb ? 'Navegador exigido' : 'Acesso liberado'}`;
    $('dgWebUrl').value = S.gov.webUrl || ''; $('dgSessao').value = S.gov.sessao || '60';
    renderSeguranca(); renderLog();
  }

  function relogio() {
    const d = new Date();
    if ($('dgRelData')) $('dgRelData').textContent = d.toLocaleDateString('pt-BR');
    if ($('dgRelHora')) $('dgRelHora').textContent = d.toLocaleTimeString('pt-BR');
  }

  function gerarRelatorioGov() {
    const d = new Date();
    const admins = usuarios.filter((u) => u.tipo_acesso === 'admin').length;
    const linhas = (arr, f) => arr.map(f).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de governança · Nexus Air</title><style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#231a3d;margin:0;padding:40px;background:#f7f4ff}.c{max-width:860px;margin:auto;background:#fff;border-radius:20px;padding:36px;box-shadow:0 10px 30px rgba(60,30,140,.12)}
      h1{margin:0 0 4px;color:#5b2ee0}h2{margin:28px 0 10px;font-size:15px;color:#5b2ee0;border-bottom:2px solid #efe9ff;padding-bottom:6px}p{color:#8a86a0;margin:0}
      table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:8px 10px;border-bottom:1px solid #eee7fb;text-align:left}th{color:#5b2ee0;font-size:11px;text-transform:uppercase;letter-spacing:.8px}
      .k{display:flex;gap:12px;margin-top:18px}.k div{flex:1;background:#efe9ff;border-radius:14px;padding:14px}.k b{display:block;font-size:24px;color:#3d1f8c}</style></head><body><div class="c">
      <h1>Relatório de governança</h1><p>Nexus Air · gerado em ${esc(d.toLocaleString('pt-BR'))} por ${esc(usuarioAtual())}</p>
      <div class="k"><div><b>${usuarios.length}</b>Usuários</div><div><b>${admins}</b>Administradores</div><div><b>${S.versoes.length}</b>Versões</div><div><b>${S.backups.length}</b>Backups</div></div>
      <h2>Acesso web</h2><p>Endereço: ${esc(S.gov.webUrl || 'não definido')} · Sessão: ${esc(S.gov.sessao)} min · Navegador web ${S.gov.exigirWeb ? 'exigido' : 'não exigido'}</p>
      <h2>Usuários e permissões</h2><table><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Status</th></tr>${linhas(usuarios, (u) => `<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${rotuloNivel(u.tipo_acesso)}</td><td>${ativoUsuario(u) ? 'Ativo' : 'Inativo'}</td></tr>`)}</table>
      <h2>Segurança de dados</h2><p>Versionamento ${S.gov.versionar ? 'ativo' : 'desligado'} · Backup ${S.gov.bkAtivo ? 'agendado (' + FREQ[S.gov.bkFreq] + ' às ' + esc(S.gov.bkHora) + ')' : 'desligado'} · Último backup: ${S.backups[0] ? esc(dataHoraBR(S.backups[0].quando)) : 'nenhum'}</p>
      <h2>Últimas alterações</h2><table><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Objeto</th></tr>${linhas(S.log.slice(0, 20), (e) => `<tr><td>${esc(dataHoraBR(e.quando))}</td><td>${esc(e.usuario)}</td><td>${esc(e.acao)}</td><td>${esc(e.objeto)}</td></tr>`)}</table></div></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-governanca-${d.toISOString().slice(0, 10)}.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    registrarLog('Relatório de governança gerado', 'Governança', 'criacao');
    toast('Relatório de governança gerado.');
  }

  function ligarGovernanca() {
    ligarSwitch($('dgExigirWeb'), (v) => { S.gov.exigirWeb = v; salvar(); $('dgWebStatus').innerHTML = `<i></i>${v ? 'Navegador exigido' : 'Acesso liberado'}`; registrarLog('Exigir navegador web ' + (v ? 'ativado' : 'desativado'), 'Acesso web', 'seguranca'); });
    $('dgWebUrl').addEventListener('change', (ev) => { S.gov.webUrl = ev.target.value.trim(); salvar(); registrarLog('Endereço de acesso alterado', 'Acesso web', 'alteracao', S.gov.webUrl); });
    $('dgSessao').addEventListener('change', (ev) => { S.gov.sessao = ev.target.value; salvar(); registrarLog('Tempo de sessão alterado', 'Acesso web', 'alteracao', ev.target.selectedOptions[0].textContent); });
    ligarSwitch($('dgVersionar'), (v) => { S.gov.versionar = v; salvar(); if (v && !S.versoes.length) criarVersao('Versão inicial'); registrarLog('Versionamento ' + (v ? 'ativado' : 'desativado'), 'Segurança e dados', 'seguranca'); renderVersoes(); });
    $('dgNovaVersao').addEventListener('click', () => { criarVersao('Versão manual'); registrarLog('Versão criada', 'Segurança e dados', 'criacao'); toast('Versão criada.'); });
    $('dgVersoes').addEventListener('click', (ev) => { const b = ev.target.closest('[data-versao-rest]'); if (b) restaurarVersao(b.dataset.versaoRest); });
    $('dgBackups').addEventListener('click', (ev) => { const b = ev.target.closest('[data-bk-rec]'); if (b) recuperarBackup(b.dataset.bkRec); });
    $('dgBkAgendar').addEventListener('click', () => {
      S.gov.bkAtivo = true; S.gov.bkFreq = $('dgBkFreq').value; S.gov.bkHora = $('dgBkHora').value || '02:00';
      if (!S.backups.length) fazerBackup('automatico'); salvar(); renderBackup();
      registrarLog('Backup agendado', 'Segurança e dados', 'seguranca', `${FREQ[S.gov.bkFreq]} às ${S.gov.bkHora}`);
      toast('Backup agendado: ' + FREQ[S.gov.bkFreq] + ' às ' + S.gov.bkHora + '.');
    });
    $('dgBkAgora').addEventListener('click', () => { fazerBackup('manual'); toast('Backup concluído.'); });
    $('dgLogLista').addEventListener('click', (ev) => { const b = ev.target.closest('[data-log]'); if (b) modalLog(b.dataset.log); });
    $('dgContinuar').addEventListener('click', () => {
      S.gov.webUrl = $('dgWebUrl').value.trim(); salvar(); toast('Configurações salvas.');
      if (S.gov.versionar) criarVersao('Ao salvar configurações');
      if (window.NexusMostrarView) window.NexusMostrarView('config');
    });
    $('dgRelGov').addEventListener('click', gerarRelatorioGov);
  }

  function aoAbrir(id, fn) {
    const v = $(id); if (!v) return;
    let ativo = v.classList.contains('active');
    const abrir = () => { v.classList.add('dg-entrando'); setTimeout(() => v.classList.remove('dg-entrando'), 1100); fn(); };
    if (ativo) abrir();
    new MutationObserver(() => { const agoraAtivo = v.classList.contains('active'); if (agoraAtivo && !ativo) abrir(); ativo = agoraAtivo; }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }

  function iniciar() {
    if (!$('view-seguranca') || !$('view-sistema')) return;
    ligarDistribuicao(); ligarUsuarios(); ligarGovernanca();
    $('dgOverlay').addEventListener('mousedown', (ev) => { if (ev.target === $('dgOverlay')) fecharModal(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('dgOverlay').classList.contains('show')) fecharModal(); });
    renderDistribuicao(); renderGov(); relogio(); setInterval(relogio, 1000);
    if (!S.log.length) {
      S.log = [
        { id: uid('g'), quando: agora(180), usuario: 'Sistema', acao: 'Backup automático realizado', objeto: 'Dados', tipo: 'restauracao', detalhe: 'Rotina inicial' },
        { id: uid('g'), quando: agora(60), usuario: 'Sistema', acao: 'Lista criada', objeto: 'Lista Equipe de TI', tipo: 'criacao', detalhe: '' },
      ]; salvar(); renderLog();
    }
    aoAbrir('view-seguranca', () => { renderDistribuicao(); });
    aoAbrir('view-sistema', () => { rodarBackupVencido(); carregarUsuariosGov(); renderGov(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

