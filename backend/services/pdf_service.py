import os
import tempfile

def _escape(text):
    return str(text).replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)').replace('\n', ' ')

def criar_pdf(texto):
    linhas = []
    for linha in str(texto).splitlines():
        while len(linha) > 100:
            linhas.append(linha[:100])
            linha = linha[100:]
        linhas.append(linha)
    linhas = linhas[:48] or ['Relatório Nexus Air']
    commands = ['BT', '/F1 10 Tf', '50 780 Td']
    for i, linha in enumerate(linhas):
        if i: commands.append('0 -15 Td')
        commands.append(f'({_escape(linha)}) Tj')
    commands.append('ET')
    stream = '\n'.join(commands).encode('latin-1', 'replace')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    pdf = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f'{index} 0 obj\n'.encode())
        pdf.extend(obj)
        pdf.extend(b'\nendobj\n')
    xref = len(pdf)
    pdf.extend(f'xref\n0 {len(objects)+1}\n'.encode())
    pdf.extend(b'0000000000 65535 f \n')
    for off in offsets[1:]: pdf.extend(f'{off:010d} 00000 n \n'.encode())
    pdf.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode())
    fd, path = tempfile.mkstemp(prefix='nexus-air-', suffix='.pdf')
    with os.fdopen(fd, 'wb') as f: f.write(pdf)
    return path

def criar_pdf_relatorio(titulo, linhas, filtros=None, conteudo="", cliente=""):
    """Relatório de registros no modelo padrão Nexus (capa, resumo e seções). Devolve o caminho do arquivo."""
    from services.relatorio_pdf_service import pdf_de_registros
    dados = pdf_de_registros(titulo, linhas, filtros, conteudo, cliente)
    fd, caminho = tempfile.mkstemp(prefix="nexus-air-", suffix=".pdf")
    with os.fdopen(fd, "wb") as f:
        f.write(dados)
    return caminho
