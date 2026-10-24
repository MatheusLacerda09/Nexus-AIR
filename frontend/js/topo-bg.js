(function () {
  // Cores das isolinhas: lidas das variáveis da paleta (--pvR-G-B, definidas em
  // theme-polish.css) para acompanhar a paleta escolhida. Padrão = roxo original.
  const BASE_CORES = [[124, 64, 242], [91, 46, 224], [70, 32, 184], [199, 178, 255]];
  function lerCores() {
    const estilo = getComputedStyle(document.documentElement);
    return BASE_CORES.map(([r, g, b]) => {
      const v = estilo.getPropertyValue(`--pv${r}-${g}-${b}`).split(",").map(n => parseInt(n, 10));
      return v.length === 3 && v.every(Number.isFinite) ? { r: v[0], g: v[1], b: v[2] } : { r, g, b };
    });
  }
  let CORES = lerCores();

  function corRGBA(c, alpha) {
    return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`;
  }

  function misturarCores(c1, c2, t) {
    return {
      r: c1.r + (c2.r - c1.r) * t,
      g: c1.g + (c2.g - c1.g) * t,
      b: c1.b + (c2.b - c1.b) * t,
    };
  }

  function criarRuido3D(seed) {
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;

    let s = seed || 1;
    function rand() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }

    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }
    function lerp(t, a, b) {
      return a + t * (b - a);
    }
    function grad(hash, x, y, z) {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    return function ruido3D(x, y, z) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const Z = Math.floor(z) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      z -= Math.floor(z);
      const u = fade(x);
      const v = fade(y);
      const w = fade(z);
      const A = p[X] + Y;
      const AA = p[A] + Z;
      const AB = p[A + 1] + Z;
      const B = p[X + 1] + Y;
      const BA = p[B] + Z;
      const BB = p[B + 1] + Z;

      return lerp(
        w,
        lerp(
          v,
          lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
          lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
        ),
        lerp(
          v,
          lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
          lerp(
            u,
            grad(p[AB + 1], x, y - 1, z - 1),
            grad(p[BB + 1], x - 1, y - 1, z - 1)
          )
        )
      );
    };
  }

  function initFundoIsolinhas(canvas, indice) {
    CORES = lerCores();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    const ruido3D = criarRuido3D(17 + indice * 131);
    const escala = 0.0022;
    const passoBase = 22;
    const passoMaximo = 34;
    const areaReferencia = 1600 * 900;
    const velocidade = 0.00045;
    const niveis = [0.14, 0.247, 0.353, 0.46, 0.567, 0.673, 0.78];
    const estilos = niveis.map((nivel, i) => {
      const progresso = i / (niveis.length - 1);
      const cor = misturarCores(CORES[0], CORES[2], progresso);
      return {
        nivel,
        cor: corRGBA(cor, 0.18 + progresso * 0.37),
        largura: i % 2 === 0 ? 1.8 : 1.35,
      };
    });

    let largura = 0;
    let altura = 0;
    let passo = passoBase;
    let cols = 0;
    let rows = 0;
    let grade = new Float32Array(0);
    let posX = new Float32Array(0);
    let posY = new Float32Array(0);
    let noiseX1 = new Float32Array(0);
    let noiseX2 = new Float32Array(0);
    let noiseY1 = new Float32Array(0);
    let noiseY2 = new Float32Array(0);
    let t = Math.random() * 1000;
    let ultimoQuadro = 0;
    let quadroAgendado = 0;
    let paginaVisivel = !document.hidden;

    const mouseAlvo = { x: -9999, y: -9999 };
    const mouse = { x: -9999, y: -9999 };
    let mouseAtivo = false;

    function redimensionar() {
      largura = window.innerWidth;
      altura = window.innerHeight;
      const fatorArea = Math.sqrt((largura * altura) / areaReferencia);
      passo = Math.min(passoMaximo, Math.max(passoBase, passoBase * fatorArea));

      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(largura / passo) + 1;
      rows = Math.ceil(altura / passo) + 1;
      grade = new Float32Array(cols * rows);
      posX = new Float32Array(cols);
      posY = new Float32Array(rows);
      noiseX1 = new Float32Array(cols);
      noiseX2 = new Float32Array(cols);
      noiseY1 = new Float32Array(rows);
      noiseY2 = new Float32Array(rows);

      for (let c = 0; c < cols; c++) {
        const x = c * passo;
        posX[c] = x;
        noiseX1[c] = x * escala;
        noiseX2[c] = x * escala * 2.2;
      }
      for (let r = 0; r < rows; r++) {
        const y = r * passo;
        posY[r] = y;
        noiseY1[r] = y * escala;
        noiseY2[r] = y * escala * 2.2;
      }
    }

    function calcularGrade() {
      const raioInfluencia = 90;
      const raio2 = raioInfluencia * raioInfluencia;

      for (let r = 0; r < rows; r++) {
        const y = posY[r];
        const ny1 = noiseY1[r];
        const ny2 = noiseY2[r];
        for (let c = 0; c < cols; c++) {
          const x = posX[c];
          const n1 = ruido3D(noiseX1[c], ny1, t);
          const n2 = ruido3D(noiseX2[c], ny2, t * 1.2) * 0.35;
          let valor = (n1 + n2 + 1.35) / 2.7;

          if (mouseAtivo) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const distancia2 = dx * dx + dy * dy;
            if (distancia2 < raio2) {
              const queda = 1 - Math.sqrt(distancia2) / raioInfluencia;
              valor += queda * queda * queda * 0.09;
            }
          }
          grade[r * cols + c] = valor;
        }
      }
    }

    function desenharIsolinhas() {
      for (let l = 0; l < estilos.length; l++) {
        const estilo = estilos[l];
        const nivel = estilo.nivel;
        ctx.beginPath();

        for (let r = 0; r < rows - 1; r++) {
          const y = posY[r];
          const yProximo = posY[r + 1];
          const base = r * cols;
          const baseProxima = base + cols;

          for (let c = 0; c < cols - 1; c++) {
            const x = posX[c];
            const xProximo = posX[c + 1];
            const v0 = grade[base + c];
            const v1 = grade[base + c + 1];
            const v2 = grade[baseProxima + c + 1];
            const v3 = grade[baseProxima + c];

            let estado = 0;
            if (v0 >= nivel) estado |= 1;
            if (v1 >= nivel) estado |= 2;
            if (v2 >= nivel) estado |= 4;
            if (v3 >= nivel) estado |= 8;
            if (estado === 0 || estado === 15) continue;

            const aX = x + (xProximo - x) * ((nivel - v0) / (v1 - v0 || 1e-5));
            const bY = y + (yProximo - y) * ((nivel - v1) / (v2 - v1 || 1e-5));
            const cX = x + (xProximo - x) * ((nivel - v3) / (v2 - v3 || 1e-5));
            const dY = y + (yProximo - y) * ((nivel - v0) / (v3 - v0 || 1e-5));

            switch (estado) {
              case 1: case 14:
                ctx.moveTo(aX, y); ctx.lineTo(x, dY); break;
              case 2: case 13:
                ctx.moveTo(aX, y); ctx.lineTo(xProximo, bY); break;
              case 3: case 12:
                ctx.moveTo(xProximo, bY); ctx.lineTo(x, dY); break;
              case 4: case 11:
                ctx.moveTo(xProximo, bY); ctx.lineTo(cX, yProximo); break;
              case 5:
                ctx.moveTo(aX, y); ctx.lineTo(x, dY);
                ctx.moveTo(xProximo, bY); ctx.lineTo(cX, yProximo); break;
              case 6: case 9:
                ctx.moveTo(aX, y); ctx.lineTo(cX, yProximo); break;
              case 7: case 8:
                ctx.moveTo(cX, yProximo); ctx.lineTo(x, dY); break;
              case 10:
                ctx.moveTo(aX, y); ctx.lineTo(xProximo, bY);
                ctx.moveTo(cX, yProximo); ctx.lineTo(x, dY); break;
            }
          }
        }

        ctx.strokeStyle = estilo.cor;
        ctx.lineWidth = estilo.largura;
        ctx.stroke();
      }
    }

    function desenharBrilhoCursor() {
      if (!mouseAtivo) return;
      const raioBase = 26;
      const pulso = raioBase + Math.sin(t * 55) * 4;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, pulso, 0, Math.PI * 2);
      ctx.strokeStyle = corRGBA(CORES[1], 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const brilho = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, raioBase * 2
      );
      brilho.addColorStop(0, corRGBA(CORES[0], 0.09));
      brilho.addColorStop(1, corRGBA(CORES[0], 0));
      ctx.fillStyle = brilho;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, raioBase * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    function desenharQuadroEstatico() {
      ctx.clearRect(0, 0, largura, altura);
      calcularGrade();
      desenharIsolinhas();
    }

    function agendarQuadro() {
      if (paginaVisivel && canvasVisivel() && !quadroAgendado) {
        quadroAgendado = requestAnimationFrame(desenharQuadro);
      }
    }

    function canvasVisivel() {
      if(!canvas.isConnected || canvas.getClientRects().length === 0) return false;
      const estilo = getComputedStyle(canvas);
      return estilo.display !== 'none' && estilo.visibility !== 'hidden';
    }

    function desenharQuadro(agora) {
      quadroAgendado = 0;
      if (!paginaVisivel || !canvasVisivel()) return;

      const decorrido = ultimoQuadro
        ? Math.min(agora - ultimoQuadro, 100)
        : 1000 / 60;
      ultimoQuadro = agora;
      if (prefersReducedMotion) {
        desenharQuadroEstatico();
        return;
      }

      ctx.clearRect(0, 0, largura, altura);
      mouse.x += (mouseAlvo.x - mouse.x) * 0.12;
      mouse.y += (mouseAlvo.y - mouse.y) * 0.12;
      t += velocidade * (decorrido / (1000 / 30));
      calcularGrade();
      desenharIsolinhas();
      desenharBrilhoCursor();
      agendarQuadro();
    }

    function aoMoverMouse(e) {
      if (!mouseAtivo) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
      mouseAlvo.x = e.clientX;
      mouseAlvo.y = e.clientY;
      mouseAtivo = true;
    }

    function aoSairMouse() {
      mouseAtivo = false;
      mouseAlvo.x = -9999;
      mouseAlvo.y = -9999;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function solicitarRedimensionamento() {
      cancelAnimationFrame(quadroAgendado);
      quadroAgendado = requestAnimationFrame(() => {
        quadroAgendado = 0;
        redimensionar();
        ultimoQuadro = 0;
        if (prefersReducedMotion) desenharQuadroEstatico();
        else agendarQuadro();
      });
    }

    window.addEventListener("mousemove", aoMoverMouse, { passive: true });
    window.addEventListener("mouseleave", aoSairMouse);
    window.addEventListener("resize", solicitarRedimensionamento);
    document.addEventListener("visibilitychange", () => {
      paginaVisivel = !document.hidden;
      if (paginaVisivel) {
        ultimoQuadro = 0;
        if (prefersReducedMotion) desenharQuadroEstatico();
        else agendarQuadro();
      } else {
        cancelAnimationFrame(quadroAgendado);
        quadroAgendado = 0;
      }
    });

    redimensionar();
    if (prefersReducedMotion) desenharQuadroEstatico();
    else agendarQuadro();
  }

  window.NexusInitTopo = () => {
    document
      .querySelectorAll(".topo-bg")
      .forEach((canvas, indice) => {
        if(canvas.dataset.nexusTopoInicializado) return;
        canvas.dataset.nexusTopoInicializado = "true";
        initFundoIsolinhas(canvas, indice);
      });
  };

  window.addEventListener("DOMContentLoaded", window.NexusInitTopo);
})();

