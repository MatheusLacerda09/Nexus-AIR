import json
import re
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from flask import Response
from seguranca import cliente_da_sessao, login_obrigatorio
from services.automation_store import all_items, add_log, create, get, remove, update

automation_bp = Blueprint("automation", __name__, url_prefix="/api")

def _json():
    return request.get_json(silent=True) or {}

def _meu(kind, item_id):
    """Item da lista `kind` só se pertencer à empresa de quem está logado (itens antigos, sem
    empresa, pertencem a "Nexus Air")."""
    item = get(kind, item_id)
    return item if item and item.get("cliente", "Nexus Air") == cliente_da_sessao() else None

def _da_empresa(kind):
    cliente = cliente_da_sessao()
    return [x for x in all_items(kind) if x.get("cliente", "Nexus Air") == cliente]

def _required(data, fields):
    return [field for field in fields if not str(data.get(field, "")).strip()]

def _validate_connector(data):
    errors = []
    tipo = data.get("tipo", "api").lower()
    if tipo not in {"api", "sql", "planilha"}:
        errors.append("Tipo de fonte inválido.")
    errors.extend(f"Campo obrigatório ausente: {f}." for f in _required(data, ["nome", "tipo", "url"]))
    if tipo == "api" and data.get("metodo", "GET") not in {"GET", "POST", "PUT", "PATCH"}:
        errors.append("Método HTTP inválido.")
    if tipo == "sql" and not data.get("banco"):
        errors.append("Informe o banco de dados para uma fonte SQL.")
    return errors

@automation_bp.get("/conectores")
@login_obrigatorio
def listar_conectores():
    return jsonify({"itens": _da_empresa("connectors")})

@automation_bp.post("/conectores")
@login_obrigatorio
def criar_conector():
    data = _json()
    erros = _validate_connector(data)
    if erros:
        return jsonify({"status": "error", "errors": erros}), 400
    item = create("connectors", {
        "cliente": cliente_da_sessao(), "nome": data["nome"].strip(), "tipo": data.get("tipo", "api"),
        "url": data["url"].strip(), "metodo": data.get("metodo", "GET"),
        "banco": data.get("banco", ""), "autenticacao": data.get("autenticacao", "nenhuma"),
        "token": data.get("token", ""), "ativo": bool(data.get("ativo", True)),
        "ultima_validacao": None, "status": "não validado"
    })
    add_log("conector.criado", item["nome"])
    return jsonify({"item": item}), 201

@automation_bp.post("/conectores/<item_id>/validar")
@login_obrigatorio
def validar_conector(item_id):
    item = _meu("connectors", item_id)
    if not item:
        return jsonify({"message": "Conector não encontrado."}), 404
    erros = _validate_connector(item)
    status = "válido" if not erros else "inválido"
    atualizado = update("connectors", item_id, {"status": status, "ultima_validacao": datetime.utcnow().isoformat() + "Z"})
    add_log("conector.validado", item["nome"], "sucesso" if not erros else "erro")
    return jsonify({"valido": not erros, "errors": erros, "item": atualizado})

@automation_bp.post("/conectores/validar-dados")
@login_obrigatorio
def validar_dados():
    data = _json()
    linhas = data.get("linhas", [])
    obrigatorios = data.get("obrigatorios", [])
    erros = []
    vistos = set()
    for idx, linha in enumerate(linhas, 1):
        faltantes = [c for c in obrigatorios if linha.get(c) in (None, "")]
        if faltantes:
            erros.append({"linha": idx, "tipo": "obrigatorio", "campos": faltantes})
        chave = json.dumps(linha, sort_keys=True, ensure_ascii=False)
        if chave in vistos:
            erros.append({"linha": idx, "tipo": "duplicidade"})
        vistos.add(chave)
        for campo, regra in (data.get("intervalos") or {}).items():
            valor = linha.get(campo)
            if valor in (None, ""):
                continue
            try:
                numero = float(valor)
                if "min" in regra and numero < float(regra["min"]):
                    erros.append({"linha": idx, "tipo": "intervalo", "campo": campo})
                if "max" in regra and numero > float(regra["max"]):
                    erros.append({"linha": idx, "tipo": "intervalo", "campo": campo})
            except (TypeError, ValueError):
                erros.append({"linha": idx, "tipo": "tipo", "campo": campo})
    return jsonify({"valido": not erros, "total_linhas": len(linhas), "erros": erros})

@automation_bp.delete("/conectores/<item_id>")
@login_obrigatorio
def excluir_conector(item_id):
    if not _meu("connectors", item_id) or not remove("connectors", item_id):
        return jsonify({"message": "Conector não encontrado."}), 404
    add_log("conector.excluido", item_id)
    return jsonify({"status": "ok"})

@automation_bp.get("/fluxos")
@login_obrigatorio
def listar_fluxos():
    return jsonify({"itens": _da_empresa("flows")})

@automation_bp.post("/fluxos")
@login_obrigatorio
def criar_fluxo():
    data = _json()
    erros = _required(data, ["nome", "conector_id"])
    cid = data.get("conector_id")
    if cid and not (_meu("connectors", cid) or _meu("maquinas", cid)):
        erros.append("Conector do fluxo não encontrado.")
    if erros:
        return jsonify({"errors": erros}), 400
    item = create("flows", {"cliente": cliente_da_sessao(), "nome": data["nome"].strip(), "conector_id": data["conector_id"], "etapas": data.get("etapas", []), "regras": data.get("regras", []), "frequencia": data.get("frequencia", "manual"), "proxima_execucao": data.get("proxima_execucao"), "ativo": True, "status": "agendado" if data.get("frequencia", "manual") != "manual" else "pronto"})
    add_log("fluxo.criado", item["nome"])
    return jsonify({"item": item}), 201

@automation_bp.post("/fluxos/<item_id>/executar")
@login_obrigatorio
def executar_fluxo(item_id):
    fluxo = _meu("flows", item_id)
    if not fluxo:
        return jsonify({"message": "Fluxo não encontrado."}), 404
    agora = datetime.utcnow().isoformat() + "Z"
    update("flows", item_id, {"ultima_execucao": agora, "status": "concluído"})
    add_log("fluxo.executado", fluxo["nome"])
    return jsonify({"status": "concluído", "executado_em": agora, "linhas_processadas": len(fluxo.get("etapas", [])) or 1, "mensagem": "Fluxo executado com as regras configuradas."})

@automation_bp.get("/fluxos/<item_id>/pdf")
@login_obrigatorio
def pdf_do_fluxo_view(item_id):
    """PDF do fluxo no modelo padrão Nexus. ?inline=1 exibe no navegador (visualização); sem isso, baixa."""
    from services.relatorio_pdf_service import pdf_do_fluxo
    fluxo = _meu("flows", item_id)
    if not fluxo:
        return jsonify({"message": "Fluxo não encontrado."}), 404
    conector = _meu("connectors", fluxo.get("conector_id")) or _meu("maquinas", fluxo.get("conector_id")) or {}
    pdf = pdf_do_fluxo(fluxo, conector, cliente_da_sessao())
    inline = request.args.get("inline") == "1"
    if not inline:
        add_log("fluxo.pdf_gerado", fluxo["nome"])
    nome = re.sub(r"[^A-Za-z0-9_-]+", "-", fluxo["nome"]).strip("-") or "fluxo"
    return Response(pdf, mimetype="application/pdf", headers={
        "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="nexus-fluxo-{nome}.pdf"'})

@automation_bp.delete("/fluxos/<item_id>")
@login_obrigatorio
def excluir_fluxo(item_id):
    if not _meu("flows", item_id) or not remove("flows", item_id):
        return jsonify({"message": "Fluxo não encontrado."}), 404
    return jsonify({"status": "ok"})

@automation_bp.get("/templates")
@login_obrigatorio
def listar_templates():
    return jsonify({"itens": _da_empresa("templates")})

@automation_bp.post("/templates")
@login_obrigatorio
def criar_template():
    data = _json()
    erros = _required(data, ["nome", "conteudo"])
    if erros:
        return jsonify({"errors": erros}), 400
    return jsonify({"item": create("templates", {"nome": data["nome"].strip(), "conteudo": data["conteudo"], "cliente": cliente_da_sessao(), "campos": data.get("campos", [])})}), 201

def _filtrar(rows, filtros):
    termo = str(filtros.get("busca", "")).lower().strip()
    status = str(filtros.get("status", "")).lower().strip()
    categoria = str(filtros.get("categoria", "")).lower().strip()
    saida = []
    for row in rows:
        texto = json.dumps(row, ensure_ascii=False).lower()
        if termo and termo not in texto: continue
        if status and str(row.get("status", "")).lower() != status: continue
        if categoria and str(row.get("categoria", "")).lower() != categoria: continue
        saida.append(row)
    return saida

@automation_bp.post("/relatorios/preview")
@login_obrigatorio
def preview_relatorio():
    data = _json()
    template = _meu("templates", data.get("template_id")) if data.get("template_id") else None
    rows = _filtrar(data.get("dados", []), data.get("filtros", {}))
    conteudo = (template or {}).get("conteudo", data.get("conteudo", "{{dados}}"))
    return jsonify({"preview": conteudo.replace("{{dados}}", json.dumps(rows, ensure_ascii=False, indent=2)), "dados": rows, "total": len(rows)})

@automation_bp.post("/relatorios/pdf")
@login_obrigatorio
def gerar_pdf():
    data = _json()
    rows = _filtrar(data.get("dados", []), data.get("filtros", {}))
    try:
        from services.pdf_service import criar_pdf_relatorio
        caminho = criar_pdf_relatorio(data.get("titulo"), rows, data.get("filtros", {}), data.get("conteudo", ""), cliente_da_sessao())
    except ImportError:
        from services.pdf_service import criar_pdf
        texto = (data.get("titulo") or "Relatório Nexus Air") + "\n\n" + json.dumps(rows, ensure_ascii=False, indent=2)
        caminho = criar_pdf(texto)
    inline = bool(data.get("inline"))
    if not inline:
        add_log("relatorio.pdf_gerado", data.get("titulo", "Relatório"))
    return send_file(caminho, as_attachment=not inline, download_name="nexus-air-relatorio.pdf", mimetype="application/pdf")

@automation_bp.get("/governanca/logs")
@login_obrigatorio
def logs():
    return jsonify({"itens": _da_empresa("logs")[-100:]})
