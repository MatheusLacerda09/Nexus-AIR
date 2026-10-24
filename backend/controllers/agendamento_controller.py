import hmac
import re
from functools import wraps

from flask import Blueprint, Response, jsonify, request

from config import Config
from seguranca import cliente_da_sessao, login_obrigatorio
from services import agendamento_service as svc
from services import automation_store as store
from services.maquina_service import SID_VALIDO
from services.relatorio_pdf_service import SaidaInvalida, gerar_pdf, interpretar_saida

agendamento_bp = Blueprint("agendamento", __name__, url_prefix="/api")

def _json():
    return request.get_json(silent=True) or {}

def _fmt_local(dt):
    return dt.astimezone(svc._tz()).strftime("%d/%m/%Y %H:%M")

def _bancos_cadastrados():
    """Bancos = máquinas do tipo "Banco de dados" cadastradas em Conectores de Dados."""
    cliente = cliente_da_sessao()
    itens = [m for m in store.all_items("maquinas") if m.get("cliente") == cliente and m.get("tipo") == "banco"]
    itens.sort(key=lambda m: m.get("nome", "").lower())
    return [{"id": m["id"], "nome": m.get("nome", ""), "instancia": m.get("instancia", ""),
             "endereco": m.get("endereco", "")} for m in itens]

@agendamento_bp.get("/agendamentos")
@login_obrigatorio
def listar():
    return jsonify({
        "itens": svc.listar(cliente_da_sessao()),
        "bancos": _bancos_cadastrados(),
        "secoes": [{"id": k, "nome": v} for k, v in svc.SECOES.items()],
        "fuso": Config.REPORT_TZ,
    })

@agendamento_bp.post("/agendamentos/previa")
@login_obrigatorio
def previa():

    dados = dict(_json(), nome="prévia", instancia="PREVIA", destinatarios="previa@exemplo.com",
                 usuario_banco="previa", senha_banco="previa")
    ag, erros = svc.validar(dados)
    if erros:
        return jsonify({"proximas": [], "errors": erros})
    return jsonify({"proximas": [_fmt_local(d) for d in svc.proximas(ag, 3)],
                    "descricao": svc.descricao_frequencia(ag)})

@agendamento_bp.post("/agendamentos")
@login_obrigatorio
def criar():
    dados = _json()
    maquina = store.get("maquinas", str(dados.get("maquina_id", "")))
    if not maquina or maquina.get("cliente") != cliente_da_sessao() or maquina.get("tipo") != "banco":
        return jsonify({"status": "error", "errors": ["Selecione um banco de dados cadastrado em Conectores de Dados."]}), 400
    instancia = str(dados.get("instancia") or maquina.get("instancia") or "").strip().upper()
    if not SID_VALIDO.match(instancia):
        return jsonify({"status": "error", "errors": ["Informe a instância/SID do banco (ex.: ORCL)."]}), 400
    if instancia != maquina.get("instancia"):
        store.update("maquinas", maquina["id"], {"instancia": instancia})
    dados = dict(dados, instancia=instancia)
    agora = bool(dados.get("executar_agora"))
    if agora:
        dados = dict(dados, frequencia="unica", hora="00:00", data_inicio=svc._agora().astimezone(svc._tz()).date().isoformat())
    ag, erros = svc.validar(dados)

    if agora:
        erros = [e for e in erros if "já passaram" not in e]
    if erros:
        return jsonify({"status": "error", "errors": erros}), 400
    ag["maquina_id"] = maquina["id"]
    return jsonify({"item": svc.criar(cliente_da_sessao(), ag, agora=agora)}), 201

@agendamento_bp.get("/bancos-oracle")
@login_obrigatorio
def listar_bancos():
    return jsonify({"bancos": svc.listar_bancos(cliente_da_sessao())})

@agendamento_bp.post("/bancos-oracle")
@login_obrigatorio
def criar_banco():
    d = _json()
    banco, erro = svc.criar_banco(cliente_da_sessao(), d.get("instancia"), d.get("rotulo"))
    if erro:
        return jsonify({"status": "error", "errors": [erro]}), 400
    return jsonify({"banco": banco}), 201

@agendamento_bp.delete("/bancos-oracle/<item_id>")
@login_obrigatorio
def excluir_banco(item_id):
    if not svc.excluir_banco(item_id, cliente_da_sessao()):
        return jsonify({"message": "Banco não encontrado."}), 404
    return jsonify({"status": "ok"})

@agendamento_bp.patch("/agendamentos/<item_id>")
@login_obrigatorio
def alternar(item_id):
    item = svc.definir_ativo(item_id, cliente_da_sessao(), bool(_json().get("ativo")))
    if not item:
        return jsonify({"message": "Agendamento não encontrado."}), 404
    return jsonify({"item": item})

@agendamento_bp.post("/agendamentos/<item_id>/executar-agora")
@login_obrigatorio
def executar_agora(item_id):
    item = svc.executar_agora(item_id, cliente_da_sessao())
    if not item:
        return jsonify({"message": "Agendamento não encontrado."}), 404
    if item.get("ja_executando"):
        return jsonify({"message": "Este relatório já está sendo gerado."}), 409
    return jsonify({"item": item, "message": "Envio solicitado. O coletor processa em até 1 minuto."})

@agendamento_bp.delete("/agendamentos/<item_id>")
@login_obrigatorio
def excluir(item_id):
    if not svc.excluir(item_id, cliente_da_sessao()):
        return jsonify({"message": "Agendamento não encontrado."}), 404
    return jsonify({"status": "ok"})

def n8n_obrigatorio(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        chave = Config.N8N_API_KEY
        if not chave:
            return jsonify({"message": "Integração com n8n desativada: defina N8N_API_KEY no .env."}), 503
        enviada = request.headers.get("X-API-Key", "")
        if not hmac.compare_digest(enviada.encode(), chave.encode()):
            return jsonify({"message": "Chave de API inválida."}), 401
        return funcao(*args, **kwargs)
    return wrapper

@agendamento_bp.get("/n8n/ping")
@n8n_obrigatorio
def n8n_ping():
    """Teste de conexão do n8n: confirma endereço, chave e fuso. Não reserva nem altera nenhum agendamento."""
    return jsonify({"status": "ok", "fuso": Config.REPORT_TZ, "hora_servidor": _fmt_local(svc._agora()),
                    "script_oracle": Config.ORACLE_SCRIPT_PATH, "usa_sudo": Config.ORACLE_USE_SUDO})

@agendamento_bp.get("/n8n/agendamentos/devidos")
@n8n_obrigatorio
def n8n_devidos():
    return jsonify({"itens": svc.reservar_devidos()})

@agendamento_bp.post("/n8n/agendamentos/<item_id>/coleta")
@n8n_obrigatorio
def n8n_coleta(item_id):
    """Etapa 1: o n8n entrega o que o servidor Oracle devolveu. Nada de PDF aqui."""
    if not store.get(svc.KIND, item_id):
        return jsonify({"message": "Agendamento não encontrado."}), 404
    stdout = _json().get("stdout", "")
    try:
        _, secoes = interpretar_saida(stdout)
    except SaidaInvalida as e:
        return jsonify({"message": str(e)}), 422
    svc.salvar_coleta(item_id, stdout)
    return jsonify({"status": "ok", "secoes": len(secoes)})

@agendamento_bp.post("/n8n/agendamentos/<item_id>/pdf")
@n8n_obrigatorio
def n8n_pdf(item_id):
    """Etapa 2: monta o PDF a partir da coleta já guardada (ou do stdout enviado, por compatibilidade)."""
    ag = store.get(svc.KIND, item_id)
    if not ag:
        return jsonify({"message": "Agendamento não encontrado."}), 404
    stdout = _json().get("stdout") or svc.ler_coleta(item_id)
    if not stdout:
        return jsonify({"message": "Nenhuma coleta guardada para este agendamento: rode a etapa de coleta antes."}), 409
    try:
        meta, secoes = interpretar_saida(stdout)
    except SaidaInvalida as e:
        return jsonify({"message": str(e)}), 422
    pdf = gerar_pdf(meta, secoes, cliente=ag.get("cliente", ""))
    nome = re.sub(r"[^A-Za-z0-9_-]", "", ag["instancia"]) or "banco"
    data = svc._agora().astimezone(svc._tz()).strftime("%Y-%m-%d")
    return Response(pdf, mimetype="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="Relatorio_Monitoramento_{nome}_{data}.pdf"'})

@agendamento_bp.post("/n8n/agendamentos/<item_id>/resultado")
@n8n_obrigatorio
def n8n_resultado(item_id):
    dados = _json()
    item = svc.registrar_resultado(item_id, bool(dados.get("ok")), dados.get("mensagem", ""))
    if not item:
        return jsonify({"message": "Agendamento não encontrado."}), 404
    return jsonify({"status": "ok", "proxima_execucao": item.get("proxima_execucao")})
