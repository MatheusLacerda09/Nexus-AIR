function initTopbarActions() {
  const searchBtn = document.getElementById('searchBtn');
  const helpBtn = document.getElementById('helpBtn');
  const topbarTitle = document.getElementById('topbarViewTitle');
  if (!searchBtn || !helpBtn) return;

  const atualizarTitulo = (item, rotulo) => {
    if (topbarTitle)
      topbarTitle.textContent = item?.querySelector('.nav-label')?.textContent || rotulo || 'Visão geral';
  };
  const normalizarBusca = valor =>
    String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const metadadosBusca = {
    dashboard: {
      descricao: 'Visão geral, CPU, RAM, tarefas e alertas do sistema.',
      termos:
        'visao geral monitoramento infraestrutura maquina virtual desempenho recursos memoria processador tarefas alertas saude status home inicio dashboard overview summary resumen'
    },
    usuarios: {
      descricao: 'Gerencie pessoas, cargos, permissões e acessos.',
      termos:
        'usuario usuarios pessoas equipe cadastro colaborador gerente funcionario conta cargo perfil acesso user users people employee employees team staff account role permission permissions usuario usuarios usuarios'
    },
    conectores: {
      descricao: 'Integrações com bancos, APIs e fontes de dados.',
      termos:
        'conector conectores integrar integracao oracle banco dados api fonte conexao serviço servico connector connectors integration integrations database data sources connection conexiones conectores integraciones'
    },
    orquestrador: {
      descricao: 'Automação e acompanhamento de fluxos de trabalho.',
      termos:
        'orquestrador fluxo fluxos automacao processo processos pipeline rotina execucao tarefas workflow workflows automation flow flows workstream flujos automatizacion'
    },
    relatorios: {
      descricao: 'Relatórios de suporte, filtros e registros operacionais.',
      termos:
        'relatorio relatorios suporte chamado atendimento agente registros historico filtro exportacao analise report reports support ticket service records history filter export analysis informe informes reportes'
    },
    seguranca: {
      descricao: 'Distribuição, proteção, permissões e controles de segurança.',
      termos:
        'seguranca segurança protecao proteção permissao permissoes acesso distribuicao distribuição politica politicas security protection permissions access distribution policy policies seguridad proteccion permisos'
    },
    sistema: {
      descricao: 'Governança, políticas, status e administração do sistema.',
      termos:
        'sistema governanca governança politica políticas status administracao administração regras conformidade system governance policy policies administration rules compliance sistema gobierno administracion'
    },
    config: {
      descricao: 'Tema, aparência, sons, música e preferências do painel.',
      termos:
        'config configuracao configurações configuracoes aparencia aparência tema claro escuro modo som sons musica música preferencia preferencias settings configuration appearance theme light dark mode sound sounds music preference preferences ajustes configuracion apariencia tema claro oscuro sonido musica preferencias'
    },
    perfil: {
      descricao: 'Nome, senha, aparência e preferências da sua conta.',
      termos:
        'meu usuario meu usuário meu perfil perfil conta dados pessoais informacoes pessoais informações pessoais nome alterar nome senha trocar senha alterar senha redefinir senha credenciais aparência aparencia tema cor cores personalizacao personalização preferências preferencias account profile personal data name password change password reset password credentials appearance theme color preferences user account my account my profile personal information edit name update password settings preferences usuario cuenta mi cuenta mi perfil datos personales informacion personal nombre cambiar nombre contraseña cambiar contraseña preferencias perfil utilisateur compte mon compte mon profil données personnelles informations personnelles nom mot de passe changer mot de passe préférences profil utente account il mio account il mio profilo dati personali nome password cambia password preferenze benutzer konto mein konto mein profil persönliche daten name passwort passwort ändern einstellungen',
      icone:
        '<svg class="ic search-profile-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19c.65-3.1 2.82-4.75 6.5-4.75s5.85 1.65 6.5 4.75" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".65"/></svg>'
    }
  };

  const obterIndiceBusca = () => {
    const indice = [...document.querySelectorAll('.nav-item')]
      .filter(item => getComputedStyle(item).display !== 'none')
      .map(item => {
        const chave = item.dataset.view;
        const rotulo = item.querySelector('.nav-label')?.textContent?.trim() || chave;
        const meta = metadadosBusca[chave] || { descricao: 'Abrir esta seção do painel.', termos: '' };
        return {
          item,
          chave,
          rotulo,
          descricao: meta.descricao,
          termos: normalizarBusca(`${rotulo} ${meta.termos}`)
        };
      });
    const botaoPerfil = document.getElementById('userProfileBtn');
    if (botaoPerfil) {
      const meta = metadadosBusca.perfil;
      indice.push({
        item: botaoPerfil,
        chave: 'perfil',
        rotulo: 'Meu usuário',
        descricao: meta.descricao,
        termos: normalizarBusca(`Meu usuário ${meta.termos}`),
        icone: meta.icone
      });
    }
    return indice;
  };

  const distanciaEdicao = (a, b) => {
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
    let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const atual = [i];
      for (let j = 1; j <= b.length; j++) {
        atual[j] = Math.min(
          atual[j - 1] + 1,
          anterior[j] + 1,
          anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      anterior = atual;
    }
    return anterior[b.length];
  };
  const palavrasSemelhantes = (palavra, tokens) => {
    if (palavra.length <= 3) return tokens.some(token => token === palavra);
    const limite = palavra.length >= 10 ? 3 : palavra.length >= 6 ? 2 : 1;
    return tokens.some(token => {
      if (token.includes(palavra) || palavra.includes(token)) return true;
      if (Math.abs(token.length - palavra.length) > limite) return false;
      return distanciaEdicao(palavra, token) <= limite;
    });
  };
  const pontuar = (entrada, termo) => {
    if (!termo) return 1;
    const palavras = termo.split(/\s+/).filter(Boolean);
    const alvo = normalizarBusca(`${entrada.rotulo} ${entrada.termos}`);
    const tokens = alvo.split(/\s+/).filter(Boolean);
    const correspondentes = palavras.filter(palavra => palavrasSemelhantes(palavra, tokens));
    if (correspondentes.length !== palavras.length) return -1;
    const rotulo = normalizarBusca(entrada.rotulo);
    if (rotulo === termo) return 120;
    if (rotulo.startsWith(termo)) return 110;
    if (rotulo.includes(termo)) return 100;
    const exatos = palavras.filter(palavra => alvo.includes(palavra)).length;
    const aproximados = correspondentes.length - exatos;
    return 65 + exatos * 8 + aproximados * 4;
  };

  const abrirBusca = async () => {
    if (document.getElementById('nexusSearchPanel')) {
      await fecharPainelFlutuante('nexusSearchPanel');
      return;
    }
    await fecharOutrosPaineis('nexusSearchPanel');
    const painel = document.createElement('div');
    painel.id = 'nexusSearchPanel';
    painel.className = 'command-panel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Busca inteligente do painel');
    painel.innerHTML = `<div class="command-panel-head"><div><span class="command-kicker">ATALHO RÁPIDO</span><strong>Buscar no Nexus Air</strong><small class="command-subtitle">Digite um assunto e vá direto para a área certa</small></div><button type="button" class="command-close" aria-label="Fechar busca">×</button></div><label class="command-input"><svg class="ic"><use href="#ic-search"/></svg><input id="nexusSearchInput" type="search" placeholder="Ex.: meu usuário, profile, contraseña..." autocomplete="off" aria-label="Pesquisar no painel" aria-controls="nexusSearchResults"></label><div class="command-results" id="nexusSearchResults" role="listbox" aria-label="Resultados da pesquisa"></div><div class="command-footer"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir <kbd>Esc</kbd> fechar</div>`;
    document.body.appendChild(painel);
    const input = painel.querySelector('#nexusSearchInput');
    const results = painel.querySelector('#nexusSearchResults');
    let resultadosAtuais = [];
    let indiceAtivo = 0;

    const selecionar = entrada => {
      if (!entrada) return;
      entrada.item.click();
      fecharPainelFlutuante('nexusSearchPanel');
      atualizarTitulo(entrada.item, entrada.rotulo);
    };
    const atualizarAtivo = indice => {
      const botoes = [...results.querySelectorAll('.command-result')];
      if (!botoes.length) return;
      indiceAtivo = (indice + botoes.length) % botoes.length;
      botoes.forEach((botao, i) => {
        botao.classList.toggle('is-active', i === indiceAtivo);
        botao.setAttribute('aria-selected', i === indiceAtivo ? 'true' : 'false');
      });
      botoes[indiceAtivo].scrollIntoView({ block: 'nearest' });
    };
    const render = valor => {
      const termo = normalizarBusca(valor);
      resultadosAtuais = obterIndiceBusca()
        .map(entrada => ({ entrada, nota: pontuar(entrada, termo) }))
        .filter(resultado => resultado.nota >= 0)
        .sort((a, b) => b.nota - a.nota)
        .map(resultado => resultado.entrada);
      indiceAtivo = 0;
      if (!resultadosAtuais.length) {
        results.innerHTML = `<div class="command-empty"><strong>Nenhum destino encontrado</strong><span>Tente "meu usuário", "perfil", "usuários", "integrações", "fluxos", "relatórios", "segurança" ou "configurações".</span></div>`;
        window.NexusTraduzirConteudo?.();
        return;
      }
      results.innerHTML = resultadosAtuais
        .map(
          (entrada, indice) =>
            `<button type="button" class="command-result${indice === 0 ? ' is-active' : ''}" data-command-index="${indice}" role="option" aria-selected="${indice === 0 ? 'true' : 'false'}"><span class="command-result-icon">${entrada.icone || entrada.item.querySelector('.nav-icon')?.innerHTML || ''}</span><span class="command-result-copy"><strong>${entrada.rotulo}</strong><small>${entrada.descricao}</small></span><kbd>↵</kbd></button>`
        )
        .join('');
      window.NexusTraduzirConteudo?.();
    };

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        atualizarAtivo(indiceAtivo + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        atualizarAtivo(indiceAtivo - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        selecionar(resultadosAtuais[indiceAtivo]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        fecharPainelFlutuante('nexusSearchPanel');
      }
    });
    results.addEventListener('click', event => {
      const botao = event.target.closest('.command-result');
      if (botao) selecionar(resultadosAtuais[Number(botao.dataset.commandIndex)]);
    });
    painel
      .querySelector('.command-close')
      .addEventListener('click', () => fecharPainelFlutuante('nexusSearchPanel'));
    render('');
    requestAnimationFrame(() => {
      painel.classList.add('show');
      input.focus();
    });
  };

  searchBtn.addEventListener('click', abrirBusca);
  helpBtn.addEventListener('click', async () => {
    if (document.getElementById('nexusHelpPanel')) {
      await fecharPainelFlutuante('nexusHelpPanel');
      return;
    }
    await fecharOutrosPaineis('nexusHelpPanel');
    const painel = document.createElement('div');
    painel.id = 'nexusHelpPanel';
    painel.className = 'command-panel help-panel';
    painel.innerHTML = `<div class="command-panel-head"><div><span class="command-kicker">NEXUS AIR</span><strong>Central de ajuda</strong></div><button type="button" class="command-close" aria-label="Fechar ajuda">×</button></div><div class="help-list"><div><span class="help-number">01</span><p><strong>Navegue pelo menu lateral</strong><small>Use as seções para alternar entre os módulos do painel.</small></p></div><div><span class="help-number">02</span><p><strong>Use a busca inteligente</strong><small>Pesquise por assunto, sinônimo ou recurso e pressione Enter.</small></p></div><div><span class="help-number">03</span><p><strong>Atalho rápido</strong><small>Pressione Ctrl + K (ou Command + K) para abrir a busca de qualquer lugar.</small></p></div></div>`;
    document.body.appendChild(painel);
    window.NexusTraduzirConteudo?.();
    painel
      .querySelector('.command-close')
      .addEventListener('click', () => fecharPainelFlutuante('nexusHelpPanel'));
    requestAnimationFrame(() => painel.classList.add('show'));
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!document.getElementById('nexusSearchPanel')) abrirBusca();
      else document.getElementById('nexusSearchInput')?.focus();
      return;
    }
    if (event.key === 'Escape') {
      fecharPainelFlutuante('nexusSearchPanel');
      fecharPainelFlutuante('nexusHelpPanel');
    }
  });
  document.addEventListener('click', event => {
    const painel = event.target.closest('.command-panel, #userDropdown, #notifDropdown');
    const botaoPainel = event.target.closest('#searchBtn, #helpBtn, #notifBtn, #userChipBtn');
    if (!painel && !botaoPainel) {
      fecharOutrosPaineis('__outside__');
    }
    const item = event.target.closest('.nav-item');
    if (item) atualizarTitulo(item);
  });
  atualizarTitulo(document.querySelector('.nav-item.active'));
}
