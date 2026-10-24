function aplicarVisualFotoPerfil(url) {
  const imagens = [...document.querySelectorAll('#userChipFoto, #userDropdownFoto, #perfilFoto')];
  const fallback = [
    ...document.querySelectorAll(
      '.user-chip-avatar-fallback, .user-dropdown-avatar-fallback, .profile-avatar-fallback'
    )
  ];
  document.documentElement.classList.add('nexus-has-profile-photo');
  imagens.forEach(imagem => {
    imagem.src = url;
    imagem.hidden = false;
    imagem.style.display = 'block';
  });
  fallback.forEach(icone => {
    icone.hidden = true;
    icone.style.display = 'none';
  });
}

function atualizarFotosUsuario(temFoto) {
  const imagens = [...document.querySelectorAll('#userChipFoto, #userDropdownFoto, #perfilFoto')];
  const fallback = [
    ...document.querySelectorAll(
      '.user-chip-avatar-fallback, .user-dropdown-avatar-fallback, .profile-avatar-fallback'
    )
  ];
  if (!temFoto) {
    document.documentElement.classList.remove('nexus-has-profile-photo');
    imagens.forEach(imagem => {
      imagem.hidden = true;
      imagem.removeAttribute('src');
      imagem.style.display = 'none';
    });
    fallback.forEach(icone => {
      icone.hidden = false;
      icone.style.removeProperty('display');
    });
    return;
  }
  aplicarVisualFotoPerfil(`/api/auth/minha-foto?v=${Date.now()}`);
}

function abrirEditorFotoPerfil(arquivo, aoConfirmar) {
  const leitor = new FileReader();
  leitor.onload = () => {
    const editor = document.createElement('div');
    editor.className = 'profile-photo-editor-overlay';
    editor.innerHTML = `<div class="profile-photo-editor" role="dialog" aria-modal="true" aria-label="Editar foto de perfil"><div class="profile-photo-editor-head"><div><span class="profile-photo-editor-kicker">PERSONALIZE SUA FOTO</span><strong>Ajustar foto de perfil</strong><small>Arraste a imagem e use o zoom para escolher o enquadramento.</small></div><button type="button" class="profile-photo-editor-close" aria-label="Fechar editor">×</button></div><div class="profile-photo-crop-stage"><img class="profile-photo-crop-image" alt="Pré-visualização da foto"></div><label class="profile-photo-zoom">Zoom <input type="range" min="0" max="1" step="0.01" value="0" aria-label="Ajustar zoom da foto"><output>0%</output></label><div class="profile-photo-editor-actions"><button type="button" class="btn-secondary profile-photo-cancel">Cancelar</button><button type="button" class="btn-primary profile-photo-apply">Aplicar enquadramento</button></div></div>`;
    document.body.appendChild(editor);
    const stage = editor.querySelector('.profile-photo-crop-stage');
    const imagem = editor.querySelector('.profile-photo-crop-image');
    const zoomInput = editor.querySelector('input[type="range"]');
    const zoomOutput = editor.querySelector('output');
    imagem.src = leitor.result;
    let zoom = 0,
      deslocamentoX = 0,
      deslocamentoY = 0,
      escalaBase = 1;
    let arrastando = false,
      inicioX = 0,
      inicioY = 0,
      origemX = 0,
      origemY = 0;
    const atualizar = () => {
      const fatorZoom = 1 + zoom;
      imagem.style.transform = `translate(-50%, -50%) translate(${deslocamentoX}px, ${deslocamentoY}px) scale(${fatorZoom})`;
      zoomOutput.value = `${Math.round(zoom * 100)}%`;
    };
    const fechar = () => editor.remove();
    const confirmar = () => {
      if (!imagem.naturalWidth || !imagem.naturalHeight) return;
      const tamanho = 512;
      const area = stage.getBoundingClientRect().width;
      const escala = escalaBase * (1 + zoom);
      const largura = imagem.naturalWidth * escala;
      const altura = imagem.naturalHeight * escala;
      const x = (area - largura) / 2 + deslocamentoX;
      const y = (area - altura) / 2 + deslocamentoY;
      const canvas = document.createElement('canvas');
      canvas.width = tamanho;
      canvas.height = tamanho;
      const contexto = canvas.getContext('2d');
      contexto.clearRect(0, 0, tamanho, tamanho);
      contexto.drawImage(
        imagem,
        (x * tamanho) / area,
        (y * tamanho) / area,
        (largura * tamanho) / area,
        (altura * tamanho) / area
      );
      canvas.toBlob(blob => {
        if (blob)
          aoConfirmar(
            new File([blob], 'foto-perfil.png', { type: 'image/png' }),
            canvas.toDataURL('image/png')
          );
        fechar();
      }, 'image/png');
    };
    zoomInput.addEventListener('input', () => {
      zoom = Number(zoomInput.value);
      atualizar();
    });
    stage.addEventListener('pointerdown', event => {
      arrastando = true;
      inicioX = event.clientX;
      inicioY = event.clientY;
      origemX = deslocamentoX;
      origemY = deslocamentoY;
      stage.setPointerCapture?.(event.pointerId);
      stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', event => {
      if (!arrastando) return;
      deslocamentoX = origemX + event.clientX - inicioX;
      deslocamentoY = origemY + event.clientY - inicioY;
      atualizar();
    });
    const soltar = () => {
      arrastando = false;
      stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', soltar);
    stage.addEventListener('pointercancel', soltar);
    editor.querySelector('.profile-photo-editor-close').addEventListener('click', fechar);
    editor.querySelector('.profile-photo-cancel').addEventListener('click', fechar);
    editor.querySelector('.profile-photo-apply').addEventListener('click', confirmar);
    editor.addEventListener('click', event => {
      if (event.target === editor) fechar();
    });
    imagem.addEventListener(
      'load',
      () => {
        const area = stage.getBoundingClientRect().width;

        escalaBase = Math.min(area / imagem.naturalWidth, area / imagem.naturalHeight);
        imagem.style.width = `${imagem.naturalWidth * escalaBase}px`;
        imagem.style.height = `${imagem.naturalHeight * escalaBase}px`;
        atualizar();
      },
      { once: true }
    );
    requestAnimationFrame(() => editor.classList.add('show'));
  };
  leitor.readAsDataURL(arquivo);
}
