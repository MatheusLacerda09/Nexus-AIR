"""Transforma a saída do relatorio_oracle.sh em um PDF com a identidade visual do Nexus Air.

Formato de entrada (marcadores gerados pelo script):
    @@META|host|data|instancia@@
    @@SECAO|<id>|<titulo>@@
    ...texto cru do sqlplus/shell...
    @@FIM@@

Saídas do sqlplus (cabeçalho + linha de traços) viram tabelas de verdade; o que não for
tabular (df, sar, logs) continua como bloco de texto monoespaçado dentro de um cartão.
"""
import io
import os
import re
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle)

ROXO = colors.HexColor("#7751E0")
ROXO_CLARO = colors.HexColor("#A78BFA")
GRAFITE = colors.HexColor("#29213F")
GRAFITE_ESCURO = colors.HexColor("#1B1530")
LILAS = colors.HexColor("#F4F0FD")
LILAS_LINHA = colors.HexColor("#E3DAF8")
CINZA = colors.HexColor("#736E85")
VERDE = colors.HexColor("#1F9D6B")
AMBAR = colors.HexColor("#C98A0B")
VERMELHO = colors.HexColor("#D64550")

_RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_LOGO = os.path.join(_RAIZ, "frontend", "assets", "branding", "logo-relatorio.png")

LARGURA_PAG, ALTURA_PAG = A4
MARGEM = 14 * mm
TOPO = 24 * mm
BASE = 16 * mm
LARGURA_UTIL = LARGURA_PAG - 2 * MARGEM

FONTE_MONO = "Courier"
TAM_MONO = 6.3
LINHA_MAX = int((LARGURA_UTIL - 8 * mm) / (0.6 * TAM_MONO)) - 1

_RE_META = re.compile(r"^@@META\|(.*?)\|(.*?)\|(.*?)@@\s*$")
_RE_SECAO = re.compile(r"^@@SECAO\|(\d+)\|(.*?)@@\s*$")
_RE_ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_RE_TRACOS = re.compile(r"^[\s-]+$")
_RE_NUM = re.compile(r"^[-+]?[\d.,]+%?$")

class SaidaInvalida(ValueError):
    pass

def interpretar_saida(stdout):
    """-> (meta: dict, secoes: [{id, titulo, linhas}]). Levanta SaidaInvalida se não houver seções."""
    meta, secoes, atual = {}, [], None
    for linha in _RE_ANSI.sub("", str(stdout or "")).replace("\r", "").split("\n"):
        m = _RE_META.match(linha)
        if m:
            meta = {"host": m.group(1), "coletado_em": m.group(2), "instancia": m.group(3)}
            continue
        m = _RE_SECAO.match(linha)
        if m:
            atual = {"id": int(m.group(1)), "titulo": m.group(2), "linhas": []}
            secoes.append(atual)
            continue
        if linha.startswith("@@FIM@@"):
            break
        if atual is not None:
            atual["linhas"].append(linha)
    if not secoes:
        raise SaidaInvalida("A saída do script não contém nenhuma seção (@@SECAO|...@@).")
    for s in secoes:
        while s["linhas"] and not s["linhas"][-1].strip():
            s["linhas"].pop()
    return meta, secoes

def _limpa(texto):

    texto = "".join(c for c in str(texto) if c == "\t" or c >= " ").replace("\t", "    ")
    return texto.encode("cp1252", "replace").decode("cp1252")

def _quebra(linha):
    if len(linha) <= LINHA_MAX:
        return [linha]
    return [linha[i:i + LINHA_MAX] for i in range(0, len(linha), LINHA_MAX)]

def _extrair_tabela(linhas):
    """Procura 'cabeçalho + linha de traços' e devolve (antes, cabecalhos, linhas, depois) ou None."""
    for i in range(1, len(linhas)):
        t = linhas[i]
        if not t.strip() or not _RE_TRACOS.match(t) or "-" not in t:
            continue
        cab = linhas[i - 1]
        if not cab.strip() or _RE_TRACOS.match(cab):
            continue
        spans = [(m.start(), m.end()) for m in re.finditer(r"-+", t)]
        if len(spans) < 2 and len(cab.split()) < 2 and len(spans) < 1:
            continue
        spans[-1] = (spans[-1][0], max(spans[-1][1], max(len(x) for x in linhas[i - 1:i + 400])))
        fatia = lambda txt: [txt[a:b].strip() if a < len(txt) else "" for a, b in spans]
        cabecalhos = fatia(cab)
        linhas_dados = []
        for bruta in linhas[i + 1:]:
            if not bruta.strip() or _RE_TRACOS.match(bruta):
                continue
            linhas_dados.append(fatia(bruta))
        if not linhas_dados or len(linhas_dados) > 400:
            return None
        return linhas[:i - 1], cabecalhos, linhas_dados, []
    return None

def _cor_celula(cabecalho, valor):
    """Cor de destaque opcional para um valor, conforme a coluna."""
    c, v = cabecalho.lower(), valor.strip()
    if c in ("status",):
        u = v.upper()
        if u == "COMPLETED":
            return VERDE
        if u.startswith("FAIL") or u in ("FAILED", "ERROR"):
            return VERMELHO
        return AMBAR
    if c in ("%livre", "perc_livre") and _RE_NUM.match(v):
        n = _num(v)
        return VERMELHO if n < 10 else AMBAR if n < 25 else VERDE
    if "sem estatisticas" in v.lower():
        return AMBAR
    return None

def _num(txt):
    t = txt.replace("%", "").strip()
    if "," in t and "." in t:
        t = t.replace(",", "")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return 0.0

def _tabela_flowable(cabecalhos, dados):
    tam = 7.4
    fonte, fonte_b = "Helvetica", "Helvetica-Bold"
    ncol = len(cabecalhos)
    dados = [(r + [""] * ncol)[:ncol] for r in dados]
    cab = [_limpa(c) for c in cabecalhos]
    cel = [[_limpa(x) for x in r] for r in dados]

    def larguras(t):
        return [max([stringWidth(cab[j], fonte_b, t)] + [stringWidth(r[j], fonte, t) for r in cel]) + 10
                for j in range(ncol)]

    w = larguras(tam)
    while sum(w) > LARGURA_UTIL and tam > 5.2:
        tam -= 0.3
        w = larguras(tam)
    if sum(w) > LARGURA_UTIL:
        return None
    sobra = (LARGURA_UTIL - sum(w))
    if sobra > 0:
        w = [x + sobra * x / sum(w) for x in w]

    numerica = [all(_RE_NUM.match(r[j].strip()) for r in cel if r[j].strip()) and any(r[j].strip() for r in cel)
                for j in range(ncol)]
    linhas = [[Paragraph(f"<b>{escape(cab[j])}</b>",
                         ParagraphStyle("th", fontName=fonte_b, fontSize=tam, leading=tam + 2, textColor=colors.white,
                                        alignment=2 if numerica[j] else 0)) for j in range(ncol)]]
    for r in cel:
        row = []
        for j in range(ncol):
            cor = _cor_celula(cab[j], r[j])
            nome = fonte_b if (cor or r[0].lower().startswith(("total", "totai"))) else fonte
            row.append(Paragraph(escape(r[j]) or "&nbsp;",
                                 ParagraphStyle("td", fontName=nome, fontSize=tam, leading=tam + 2,
                                                textColor=cor or GRAFITE, alignment=2 if numerica[j] else 0)))
        linhas.append(row)

    t = Table(linhas, colWidths=w, repeatRows=1)
    estilo = [("BACKGROUND", (0, 0), (-1, 0), ROXO),
              ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
              ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
              ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
              ("LINEBELOW", (0, 1), (-1, -1), 0.3, LILAS_LINHA),
              ("BOX", (0, 0), (-1, -1), 0.6, LILAS_LINHA)]
    for i in range(1, len(linhas)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), LILAS))

    if cel and cel[-1][0].lower().startswith(("total", "totai")):
        estilo += [("BACKGROUND", (0, len(linhas) - 1), (-1, len(linhas) - 1), LILAS_LINHA),
                   ("LINEABOVE", (0, len(linhas) - 1), (-1, len(linhas) - 1), 0.8, ROXO)]
    t.setStyle(TableStyle(estilo))
    return t

def _bloco_texto(linhas, mono):
    quebradas = []
    for bruta in linhas:
        quebradas.extend(_quebra(_limpa(bruta)))
    quebradas = quebradas or ["(sem saída)"]
    blocos = []

    for i in range(0, len(quebradas), 45):
        pre = Preformatted("\n".join(quebradas[i:i + 45]), mono)
        cartao = Table([[pre]], colWidths=[LARGURA_UTIL])
        cartao.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LILAS),
                                    ("BOX", (0, 0), (-1, -1), 0.6, LILAS_LINHA),
                                    ("LINEBEFORE", (0, 0), (0, -1), 2.2, ROXO_CLARO),
                                    ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                                    ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        blocos.append(cartao)
    return blocos

def _kpis(secoes):
    """Cartões do resumo, extraídos (com tolerância a falhas) das seções coletadas."""
    por_id = {s["id"]: s for s in secoes}
    kpis = []

    def tabela(i):
        s = por_id.get(i)
        r = _extrair_tabela(s["linhas"]) if s else None
        return r

    try:
        r = tabela(4)
        if r:
            _, cab, dados, _ = r
            linha = dados[0]
            kpis.append(("Tamanho do banco", linha[1] if len(linha) > 1 else linha[0], linha[0], None))
    except Exception:
        pass
    try:
        r = tabela(6)
        if r:
            _, cab, dados, _ = r
            idx = next(j for j, c in enumerate(cab) if c.lower() in ("%livre", "perc_livre"))
            cand = [d for d in dados if d[idx].strip() and not d[0].lower().startswith(("total", "totai"))]
            pior = min(cand, key=lambda d: _num(d[idx]))
            n = _num(pior[idx])
            kpis.append(("Tablespace mais cheia", f"{n:.1f}% livre", pior[0], VERMELHO if n < 10 else AMBAR if n < 25 else VERDE))
    except Exception:
        pass
    try:
        s = por_id.get(11)
        r = tabela(11)
        if r:
            _, cab, dados, _ = r
            st = dados[-1][cab.index("STATUS")] if "STATUS" in cab else dados[-1][1]
            kpis.append(("Backup físico", st.title(), dados[-1][0], VERDE if st.upper() == "COMPLETED" else VERMELHO))
        elif s is not None:
            kpis.append(("Backup físico", "Sem registro", "últimas 24h", AMBAR))
    except Exception:
        pass
    try:
        s = por_id.get(2)
        if s:
            pior = None
            for ln in s["linhas"]:
                m = re.search(r"\s(\d{1,3})%\s+(\S+)\s*$", ln)
                if m and (pior is None or int(m.group(1)) > pior[0]):
                    pior = (int(m.group(1)), m.group(2))
            if pior:
                kpis.append(("Disco mais cheio", f"{pior[0]}% usado", pior[1],
                             VERMELHO if pior[0] >= 90 else AMBAR if pior[0] >= 80 else VERDE))
    except Exception:
        pass
    return kpis

def _cartoes_kpi(kpis):
    if not kpis:
        return None
    largura = (LARGURA_UTIL - (len(kpis) - 1) * 4 * mm) / len(kpis)
    cels, estilo = [], [("VALIGN", (0, 0), (-1, -1), "TOP")]
    for i, (rotulo, valor, detalhe, cor) in enumerate(kpis):
        interno = Table([[Paragraph(escape(_limpa(rotulo)).upper(), ParagraphStyle("kl", fontName="Helvetica-Bold", fontSize=6.4, leading=8, textColor=CINZA))],
                         [Paragraph(escape(_limpa(valor)), ParagraphStyle("kv", fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=cor or GRAFITE))],
                         [Paragraph(escape(_limpa(detalhe)), ParagraphStyle("kd", fontName="Helvetica", fontSize=7.4, leading=9, textColor=CINZA))]],
                        colWidths=[largura])
        interno.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LILAS), ("BOX", (0, 0), (-1, -1), 0.6, LILAS_LINHA),
                                     ("LINEABOVE", (0, 0), (-1, 0), 2.4, cor or ROXO),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 4),
                                     ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        cels.append(interno)
    folga = 4 * mm
    linha = Table([cels], colWidths=[largura + folga] * (len(kpis) - 1) + [largura], hAlign="LEFT")
    linha.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-2, -1), folga),
                               ("RIGHTPADDING", (-1, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return linha

def _logo(canvas, x, y, altura):
    try:
        img = ImageReader(_LOGO)
        iw, ih = img.getSize()
        canvas.drawImage(img, x, y, width=altura * iw / ih, height=altura, mask="auto")
        return altura * iw / ih
    except Exception:
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", altura)
        canvas.drawString(x, y, "N")
        return altura

def _desenha_capa(canvas, titulo, cliente, meta, emitido, n_secoes):
    canvas.saveState()
    canvas.setFillColor(GRAFITE_ESCURO)
    canvas.rect(0, 0, LARGURA_PAG, ALTURA_PAG, stroke=0, fill=1)

    for cx, cy, r, a in ((LARGURA_PAG * 0.92, ALTURA_PAG * 0.80, 95 * mm, 0.10), (LARGURA_PAG * 0.92, ALTURA_PAG * 0.80, 66 * mm, 0.16),
                         (LARGURA_PAG * 0.92, ALTURA_PAG * 0.80, 38 * mm, 0.28), (-10 * mm, ALTURA_PAG * 0.22, 70 * mm, 0.14),
                         (-10 * mm, ALTURA_PAG * 0.22, 42 * mm, 0.22)):
        canvas.setStrokeColor(ROXO)
        canvas.setStrokeAlpha(a)
        canvas.setLineWidth(1.4)
        canvas.circle(cx, cy, r, stroke=1, fill=0)
    canvas.setStrokeAlpha(1)
    canvas.setFillColor(ROXO)
    canvas.setFillAlpha(0.20)
    canvas.circle(LARGURA_PAG * 0.92, ALTURA_PAG * 0.80, 20 * mm, stroke=0, fill=1)
    canvas.setFillAlpha(1)

    _logo(canvas, MARGEM + 4 * mm, ALTURA_PAG - 52 * mm, 24 * mm)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(MARGEM + 42 * mm, ALTURA_PAG - 38 * mm, "Nexus Air")
    canvas.setFillColor(ROXO_CLARO)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(MARGEM + 42 * mm, ALTURA_PAG - 44 * mm, "Monitoramento e automação")

    canvas.setFillColor(ROXO)
    canvas.rect(MARGEM + 4 * mm, ALTURA_PAG * 0.545, 22 * mm, 1.8 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 31)
    partes = _limpa(titulo).split(" ", 2)
    linhas_t = [" ".join(partes[:2]), partes[2]] if len(partes) == 3 else [_limpa(titulo)]
    y = ALTURA_PAG * 0.545 - 14 * mm
    for ln in linhas_t:
        canvas.drawString(MARGEM + 4 * mm, y, ln)
        y -= 12.5 * mm
    subtitulo = meta.get("subtitulo") or (f"Banco de dados Oracle · {meta['instancia']}" if meta.get("instancia") else "")
    if subtitulo:
        canvas.setFillColor(ROXO_CLARO)
        canvas.setFont("Helvetica", 13)
        canvas.drawString(MARGEM + 4 * mm, y - 1 * mm, _limpa(subtitulo)[:70])

    topo_faixa = 70 * mm
    canvas.setStrokeColor(ROXO)
    canvas.setLineWidth(0.8)
    canvas.line(0, topo_faixa, LARGURA_PAG, topo_faixa)
    campos = [("Cliente", cliente or "—"), ("Emissão", emitido),
              (meta.get("rotulo_host") or "Servidor", meta.get("host") or "—"), ("Conteúdo", f"{n_secoes} seç{'ão' if n_secoes == 1 else 'ões'} coletadas")]
    col_x = [MARGEM + 4 * mm, LARGURA_PAG / 2 + 2 * mm]
    for k, (rot, val) in enumerate(campos):
        x = col_x[k % 2]
        yy = topo_faixa - 12 * mm - (k // 2) * 22 * mm
        canvas.setFillColor(ROXO_CLARO)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(x, yy, rot.upper())
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica", 12)
        canvas.drawString(x, yy - 6 * mm, _limpa(val)[:48])
    canvas.setFillColor(CINZA)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGEM + 4 * mm, 9 * mm, "© %d Nexus Air" % datetime.now().year)
    canvas.drawRightString(LARGURA_PAG - MARGEM, 9 * mm, "Relatório gerado automaticamente · Confidencial")
    canvas.restoreState()

def _desenha_corpo(canvas, doc, titulo_curto, instancia):
    canvas.saveState()
    canvas.setFillColor(GRAFITE)
    canvas.rect(0, ALTURA_PAG - 15 * mm, LARGURA_PAG, 15 * mm, stroke=0, fill=1)
    canvas.setFillColor(ROXO)
    canvas.rect(0, ALTURA_PAG - 15.8 * mm, LARGURA_PAG, 0.8 * mm, stroke=0, fill=1)
    w = _logo(canvas, MARGEM, ALTURA_PAG - 12.2 * mm, 9.4 * mm)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(MARGEM + w + 3 * mm, ALTURA_PAG - 8.6 * mm, "Nexus Air")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(ROXO_CLARO)
    canvas.drawRightString(LARGURA_PAG - MARGEM, ALTURA_PAG - 8.6 * mm,
                           _limpa(f"{titulo_curto}{' · ' + instancia if instancia else ''}"))
    canvas.setStrokeColor(LILAS_LINHA)
    canvas.setLineWidth(0.6)
    canvas.line(MARGEM, 11 * mm, LARGURA_PAG - MARGEM, 11 * mm)
    canvas.setFillColor(CINZA)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(MARGEM, 7 * mm, "Nexus Air · Relatório gerado automaticamente · Confidencial")
    canvas.drawRightString(LARGURA_PAG - MARGEM, 7 * mm, f"Página {doc.page - 1}")
    canvas.restoreState()

def _titulo_secao(numero, texto):
    t = Table([[Paragraph(str(numero), ParagraphStyle("n", fontName="Helvetica-Bold", fontSize=10, leading=12,
                                                       textColor=colors.white, alignment=1)),
                Paragraph(escape(_limpa(texto)), ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5,
                                                                leading=14, textColor=GRAFITE))]],
              colWidths=[9 * mm, LARGURA_UTIL - 9 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), ROXO), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("LINEBELOW", (1, 0), (1, 0), 0.8, ROXO), ("LEFTPADDING", (1, 0), (1, 0), 6),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return t

def gerar_pdf(meta, secoes, cliente="", titulo="Relatório de Monitoramento", kpis=None):
    meta = meta or {}
    buf = io.BytesIO()
    instancia = meta.get("instancia", "")
    emitido = meta.get("coletado_em") or datetime.now().strftime("%d/%m/%Y %H:%M")

    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=MARGEM, rightMargin=MARGEM, topMargin=TOPO,
                          bottomMargin=BASE, title=titulo, author="Nexus Air")
    capa = Frame(0, 0, 20, 20, id="capa", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    corpo = Frame(MARGEM, BASE, LARGURA_UTIL, ALTURA_PAG - TOPO - BASE, id="corpo",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="capa", frames=[capa],
                     onPage=lambda c, d: _desenha_capa(c, titulo, cliente, meta, emitido, len(secoes))),
        PageTemplate(id="corpo", frames=[corpo],
                     onPage=lambda c, d: _desenha_corpo(c, d, titulo, instancia)),
    ])

    mono = ParagraphStyle("mono", fontName=FONTE_MONO, fontSize=TAM_MONO, leading=TAM_MONO + 1.6, textColor=GRAFITE)
    h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=GRAFITE)
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=9, leading=12, textColor=CINZA)
    h_idx = ParagraphStyle("idx", fontName="Helvetica", fontSize=9, leading=14, textColor=GRAFITE)

    el = [Spacer(1, 1), NextPageTemplate("corpo"), PageBreak()]

    el += [Paragraph("Resumo", h1),
           Paragraph(escape(_limpa(f"{cliente + ' · ' if cliente else ''}{instancia + ' · ' if instancia else ''}{emitido}")), sub),
           Spacer(1, 8)]
    cartoes = _cartoes_kpi(kpis if kpis is not None else _kpis(secoes))
    if cartoes is not None:
        el += [cartoes, Spacer(1, 10)]
    el.append(Paragraph("<b>Seções deste relatório</b>", h_idx))
    for s in secoes:
        el.append(Paragraph(f"<font color='#7751E0'><b>{s['id']:>2}</b></font> &nbsp; {escape(_limpa(s['titulo']))}", h_idx))
    el.append(Spacer(1, 6))

    for s in secoes:
        cab = _titulo_secao(s["id"], s["titulo"])
        linhas = s["linhas"] or ["(sem saída)"]
        extraido = _extrair_tabela(linhas) if s["linhas"] else None
        tabela = None
        if extraido:
            antes, cabecalhos, dados, _ = extraido
            tabela = _tabela_flowable(cabecalhos, dados)
        if tabela is not None:
            corpo_sec = []
            if any(x.strip() for x in antes):
                corpo_sec += _bloco_texto(antes, mono) + [Spacer(1, 4)]
            corpo_sec.append(tabela)
        else:
            corpo_sec = _bloco_texto(linhas, mono)

        el += [Spacer(1, 12), KeepTogether([cab, Spacer(1, 5), corpo_sec[0]])] + corpo_sec[1:]

    doc.build(el)
    return buf.getvalue()

def _txt_tabela(cabecalhos, linhas, maxw=42):
    """Monta o texto 'cabeçalho + traços + linhas' que _extrair_tabela transforma em tabela do PDF."""
    corta = lambda v: str(v if v is not None else "").replace("\n", " ").strip()[:maxw]
    linhas = [[corta(c) for c in l] for l in linhas]
    larg = [max([len(h)] + [len(l[i]) for l in linhas]) for i, h in enumerate(cabecalhos)]
    fmt = lambda cels: "  ".join(c.ljust(larg[i]) for i, c in enumerate(cels)).rstrip()
    return [fmt(cabecalhos), "  ".join("-" * w for w in larg)] + [fmt(l) for l in linhas]

def _fmt_iso(iso):
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).astimezone().strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(iso or "—")

def pdf_do_fluxo(fluxo, conector=None, cliente="", executado=None):
    """PDF no modelo padrão Nexus para um fluxo do Orquestrador. Devolve bytes."""
    conector = conector or {}
    freq = {"manual": "Manual", "diaria": "Diária", "semanal": "Semanal", "mensal": "Mensal"}.get(fluxo.get("frequencia"), fluxo.get("frequencia") or "Manual")
    regras = fluxo.get("regras") or []
    etapas = fluxo.get("etapas") or []
    agora = datetime.now().strftime("%d/%m/%Y %H:%M")
    status = str(fluxo.get("status") or "pronto")
    dados = [["Nome do fluxo", fluxo.get("nome", "—")], ["Origem (conector)", conector.get("nome") or "Conector removido"],
             ["Tipo de origem", (conector.get("tipo") or "—")], ["Frequência", freq], ["Status", status.title()],
             ["Última execução", _fmt_iso(executado or fluxo.get("ultima_execucao")) if (executado or fluxo.get("ultima_execucao")) else "Ainda não executado"]]
    if regras:
        linhas_r = [[r.get("campo", "—"), r.get("operacao", "—"), r.get("valor", "")] for r in regras if isinstance(r, dict)]
        sec_regras = _txt_tabela(["Campo", "Operacao", "Valor"], linhas_r) if linhas_r else ["(regras em formato não tabular)"]
    else:
        sec_regras = ["Nenhuma regra de transformação configurada: os dados seguem sem alterações."]
    processadas = len(etapas) or 1
    resultado = [["Linhas processadas", processadas], ["Etapas configuradas", len(etapas)], ["Regras aplicadas", len(regras)],
                 ["Emitido em", agora]]
    secoes = [{"id": 1, "titulo": "Dados do fluxo", "linhas": _txt_tabela(["Campo", "Valor"], dados)},
              {"id": 2, "titulo": "Regras aplicadas", "linhas": sec_regras},
              {"id": 3, "titulo": "Resultado da execução", "linhas": _txt_tabela(["Indicador", "Valor"], resultado)}]
    cor = VERDE if status.lower() in ("concluído", "concluido", "sucesso") else VERMELHO if status.lower().startswith("fal") else AMBAR
    kpis = [("Status", status.title(), fluxo.get("nome", ""), cor), ("Frequência", freq, "execução", None),
            ("Linhas processadas", str(processadas), "na última execução", None), ("Regras", str(len(regras)), "aplicadas", None)]
    meta = {"host": conector.get("nome") or "—", "rotulo_host": "Origem", "coletado_em": agora,
            "instancia": fluxo.get("nome", ""), "subtitulo": f"Fluxo · {fluxo.get('nome', '')}"}
    return gerar_pdf(meta, secoes, cliente=cliente, titulo="Relatório de Fluxo", kpis=kpis)

def pdf_de_registros(titulo, rows, filtros=None, conteudo="", cliente=""):
    """PDF no modelo padrão Nexus para uma lista de registros (relatório de suporte etc.). Devolve bytes."""
    rows = [r for r in (rows or []) if isinstance(r, dict)]
    filtros = {k: v for k, v in (filtros or {}).items() if str(v or "").strip()}
    st = [str(r.get("status", "")).lower() for r in rows]
    ok = sum(1 for x in st if x in ("sucesso", "concluído", "concluido", "ok"))
    falhas = sum(1 for x in st if x.startswith("fal") or x == "erro")
    agora = datetime.now().strftime("%d/%m/%Y %H:%M")
    resumo = [["Total de registros", len(rows)], ["Concluídos", ok], ["Falhas", falhas]] + \
             [[f"Filtro: {k}", v] for k, v in filtros.items()]
    secoes = [{"id": 1, "titulo": "Resumo dos registros", "linhas": _txt_tabela(["Indicador", "Valor"], resumo)}]
    texto = str(conteudo or "").replace("{{dados}}", "").strip()
    if texto:
        secoes.append({"id": len(secoes) + 1, "titulo": "Observações", "linhas": texto.splitlines()})
    if rows:
        cols = []
        for r in rows:
            for k, v in r.items():
                if k not in cols and not isinstance(v, (dict, list)):
                    cols.append(k)
        pref = ["id", "tarefa", "categoria", "status", "responsavel", "data"]
        cols = sorted(cols, key=lambda k: pref.index(k.lower()) if k.lower() in pref else len(pref))[:7]
        corpo = _txt_tabela([c.upper() for c in cols], [[r.get(c, "") for c in cols] for r in rows[:300]], maxw=28)
        if "STATUS" in [c.upper() for c in cols]:
            pass
        secoes.append({"id": len(secoes) + 1, "titulo": "Registros", "linhas": corpo})
    else:
        secoes.append({"id": len(secoes) + 1, "titulo": "Registros", "linhas": ["Nenhum registro encontrado para os filtros informados."]})
    kpis = [("Registros", str(len(rows)), "no relatório", None), ("Concluídos", str(ok), "com sucesso", VERDE),
            ("Falhas", str(falhas), "registradas", VERMELHO if falhas else None),
            ("Filtros ativos", str(len(filtros)), ", ".join(filtros) or "nenhum", AMBAR if filtros else None)]
    meta = {"host": "Nexus Air", "rotulo_host": "Origem", "coletado_em": agora, "subtitulo": "Registros do painel"}
    return gerar_pdf(meta, secoes, cliente=cliente, titulo=titulo or "Relatório Nexus Air", kpis=kpis)
