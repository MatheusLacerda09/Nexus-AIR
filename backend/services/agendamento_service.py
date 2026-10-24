"""Agendamento de relatórios por e-mail.

O Nexus Air é quem sabe "quando" rodar (este módulo); o n8n é quem "executa":
a cada minuto ele pergunta `reservar_devidos()`, roda o script no Oracle,
pede o PDF e envia pelo Gmail, e por fim chama `registrar_resultado()`.
"""
import base64
import hashlib
import html
import os
import re
import shlex
import threading
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from config import Config
from services import automation_store as store

KIND = "schedules"
KIND_BANCOS = "bancos"
PASTA_COLETAS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "coletas"))
_ID = re.compile(r"^[0-9a-f]{12}$")
_LOCK = threading.RLock()
LOCK_MINUTOS = 30

SECOES = {
    2: "Espaço livre em disco",
    4: "Tamanho das databases",
    5: "Maiores tabelas",
    6: "Tablespaces",
    7: "Datafiles",
    8: "Estatísticas do banco",
    9: "Eventos de lock",
    10: "Eventos de espera",
    11: "Status do backup físico",
    12: "Log do backup físico",
    14: "Log do backup lógico",
    15: "Erros nos logs do banco",
    16: "Cargas de processamento (CPU, memória, swap, I/O)",
}
FREQUENCIAS = ("unica", "diaria", "semanal", "intervalo", "mensal")
DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]

_EMAIL = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
_SID = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,29}$")
_HORA = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_USUARIO_BD = re.compile(r"^[A-Za-z][A-Za-z0-9_$#]{0,29}$")
_SENHA_PROIBIDA = re.compile(r'["\x00-\x1f\x7f]')

def _fernet():
    from cryptography.fernet import Fernet
    chave = base64.urlsafe_b64encode(hashlib.sha256(("nexus-bd|" + Config.SECRET_KEY).encode()).digest())
    return Fernet(chave)

def cifrar_senha(senha):
    return _fernet().encrypt(str(senha).encode()).decode()

def decifrar_senha(token):
    return _fernet().decrypt(str(token).encode()).decode()

def _tz():
    return ZoneInfo(Config.REPORT_TZ)

def _agora():
    return datetime.now(timezone.utc)

def _iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if dt else None

def _parse(valor):
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None

def _em(d, h, m):
    return datetime(d.year, d.month, d.day, h, m, tzinfo=_tz())

def calcular_proxima(ag, apos=None):
    """Próximo disparo (datetime UTC) estritamente depois de `apos`."""
    tz = _tz()
    apos = (apos or _agora()).astimezone(tz)
    h, m = (int(x) for x in ag["hora"].split(":"))
    hoje = apos.date()
    freq = ag["frequencia"]

    if freq == "unica":
        c = _em(date.fromisoformat(ag["data_inicio"]), h, m)
        return c.astimezone(timezone.utc) if c > apos else None

    elif freq == "diaria":
        for i in range(3):
            c = _em(hoje + timedelta(days=i), h, m)
            if c > apos:
                return c.astimezone(timezone.utc)

    elif freq == "semanal":
        dias = set(ag["dias_semana"])
        for i in range(8):
            d = hoje + timedelta(days=i)
            if d.weekday() in dias:
                c = _em(d, h, m)
                if c > apos:
                    return c.astimezone(timezone.utc)

    elif freq == "intervalo":
        n = ag["intervalo_dias"]
        inicio = date.fromisoformat(ag["data_inicio"])
        k = 0 if hoje < inicio else (hoje - inicio).days // n
        while True:
            c = _em(inicio + timedelta(days=k * n), h, m)
            if c > apos:
                return c.astimezone(timezone.utc)
            k += 1

    elif freq == "mensal":
        ano, mes = hoje.year, hoje.month
        for _ in range(14):
            dia = min(ag["dia_mes"], monthrange(ano, mes)[1])
            c = _em(date(ano, mes, dia), h, m)
            if c > apos:
                return c.astimezone(timezone.utc)
            mes += 1
            if mes > 12:
                mes, ano = 1, ano + 1
    return None

def proximas(ag, quantidade=3):
    saida, ref = [], _agora()
    for _ in range(quantidade):
        prox = calcular_proxima(ag, ref)
        if not prox:
            break
        saida.append(prox)
        ref = prox
    return saida

def descricao_frequencia(ag):
    hora = ag["hora"]
    freq = ag["frequencia"]
    if freq == "unica":
        data = date.fromisoformat(ag["data_inicio"]).strftime("%d/%m/%Y")
        return f"Uma vez, em {data} às {hora}"
    if freq == "diaria":
        return f"Todos os dias às {hora}"
    if freq == "semanal":
        dias = sorted(ag["dias_semana"])
        nomes = [DIAS[d] for d in dias]
        lista = nomes[0] if len(nomes) == 1 else ", ".join(nomes[:-1]) + " e " + nomes[-1]
        artigo = "Todo" if set(dias) <= {5, 6} else "Toda"
        return f"{artigo} {lista} às {hora}"
    if freq == "intervalo":
        n = ag["intervalo_dias"]
        inicio = date.fromisoformat(ag["data_inicio"]).strftime("%d/%m/%Y")
        return f"A cada {n} dia{'s' if n > 1 else ''} às {hora} (desde {inicio})"
    if freq == "mensal":
        return f"Todo dia {ag['dia_mes']} do mês às {hora}"
    return freq

def _lista_emails(valor):
    if isinstance(valor, list):
        bruto = valor
    else:
        bruto = re.split(r"[,;\s]+", str(valor or ""))
    vistos, saida = set(), []
    for e in (x.strip() for x in bruto):
        if e and e.lower() not in vistos:
            vistos.add(e.lower())
            saida.append(e)
    return saida

def validar(data):
    """Devolve (agendamento_limpo, erros). Nada que chegue do formulário
    é usado em comando sem passar por aqui."""
    erros = []
    nome = str(data.get("nome", "")).strip()
    if not nome:
        erros.append("Informe um nome para o agendamento.")
    elif len(nome) > 100:
        erros.append("O nome pode ter no máximo 100 caracteres.")

    instancia = str(data.get("instancia", "")).strip()
    if not _SID.match(instancia):
        erros.append("Instância inválida: use letras, números e _ (começando por letra).")

    usuario_bd = str(data.get("usuario_banco", "")).strip()
    if not _USUARIO_BD.match(usuario_bd):
        erros.append("Informe o usuário administrador do banco (letras, números, _, $ ou #).")
    senha_bd = str(data.get("senha_banco", ""))
    if not senha_bd:
        erros.append("Informe a senha do usuário administrador.")
    elif len(senha_bd) > 128 or _SENHA_PROIBIDA.search(senha_bd):
        erros.append('A senha não pode ter aspas duplas nem quebras de linha (máx. 128 caracteres).')

    emails = _lista_emails(data.get("destinatarios"))
    if not emails:
        erros.append("Informe pelo menos um e-mail de destino.")
    elif len(emails) > 10:
        erros.append("Máximo de 10 destinatários.")
    invalidos = [e for e in emails if not _EMAIL.match(e)]
    if invalidos:
        erros.append("E-mail inválido: " + ", ".join(invalidos[:3]))

    bruto = data.get("secoes") or list(SECOES)
    try:
        secoes = sorted({int(x) for x in bruto})
    except (TypeError, ValueError):
        secoes = []
        erros.append("Seleção de seções inválida.")
    if secoes and any(s not in SECOES for s in secoes):
        erros.append("Seção desconhecida na seleção.")
    if not secoes:
        erros.append("Selecione pelo menos uma seção do relatório.")

    freq = str(data.get("frequencia", "")).strip()
    if freq not in FREQUENCIAS:
        erros.append("Escolha quando executar: uma vez, diária, semanal, a cada N dias ou mensal.")
    hora = str(data.get("hora", "")).strip()
    if not _HORA.match(hora):
        erros.append("Horário inválido (use HH:MM).")

    ag = {
        "nome": nome, "instancia": instancia, "destinatarios": emails, "secoes": secoes,
        "usuario_banco": usuario_bd, "senha_banco": senha_bd,
        "frequencia": freq, "hora": hora,
        "dias_semana": [], "intervalo_dias": None, "data_inicio": None, "dia_mes": None,
        "assunto": " ".join(str(data.get("assunto", "")).split())[:150],
        "mensagem": str(data.get("mensagem", "")).strip()[:1000],
    }

    if freq == "unica":
        inicio = str(data.get("data_inicio") or "").strip()
        try:
            d = date.fromisoformat(inicio)
            ag["data_inicio"] = inicio
            if _HORA.match(hora) and _em(d, int(hora[:2]), int(hora[3:])) <= datetime.now(_tz()):
                erros.append("Essa data e horário já passaram. Escolha um horário futuro ou use \"Executar agora\".")
        except ValueError:
            erros.append("Informe a data da execução.")
    elif freq == "semanal":
        try:
            dias = sorted({int(x) for x in (data.get("dias_semana") or [])})
        except (TypeError, ValueError):
            dias = []
        if not dias or any(d < 0 or d > 6 for d in dias):
            erros.append("Escolha pelo menos um dia da semana.")
        ag["dias_semana"] = dias
    elif freq == "intervalo":
        try:
            n = int(data.get("intervalo_dias"))
            if not 1 <= n <= 365:
                raise ValueError
            ag["intervalo_dias"] = n
        except (TypeError, ValueError):
            erros.append("Informe o intervalo em dias (1 a 365).")
        inicio = str(data.get("data_inicio") or datetime.now(_tz()).date().isoformat())
        try:
            date.fromisoformat(inicio)
            ag["data_inicio"] = inicio
        except ValueError:
            erros.append("Data de início inválida.")
    elif freq == "mensal":
        try:
            d = int(data.get("dia_mes"))
            if not 1 <= d <= 31:
                raise ValueError
            ag["dia_mes"] = d
        except (TypeError, ValueError):
            erros.append("Informe o dia do mês (1 a 31).")
    return ag, erros

def _publico(ag):
    saida = dict(ag)
    saida["descricao_frequencia"] = descricao_frequencia(ag)
    saida["secoes_nomes"] = [SECOES[s] for s in ag["secoes"] if s in SECOES]
    saida.pop("lock_ate", None)
    saida["tem_senha"] = bool(saida.pop("senha_cifrada", None))
    saida.pop("senha_banco", None)
    return saida

def listar(cliente):
    itens = [a for a in store.all_items(KIND) if a.get("cliente") == cliente]
    itens.sort(key=lambda a: a.get("criado_em", ""))
    return [_publico(a) for a in itens]

def _do_cliente(item_id, cliente):
    ag = store.get(KIND, item_id)
    return ag if ag and ag.get("cliente") == cliente else None

def criar(cliente, ag, agora=False):
    """`agora=True`: roda no próximo ciclo do n8n (até 1 min), uma única vez."""
    ag = dict(ag, cliente=cliente, ativo=True, status="agendado", forcar=False,
              ultima_execucao=None, ultimo_status=None, ultimo_detalhe=None, lock_ate=None)
    ag["senha_cifrada"] = cifrar_senha(ag.pop("senha_banco"))
    if agora:
        local = _agora().astimezone(_tz())
        ag.update(frequencia="unica", data_inicio=local.date().isoformat(), hora=local.strftime("%H:%M"),
                  dias_semana=[], intervalo_dias=None, dia_mes=None, forcar=True)
        ag["proxima_execucao"] = _iso(_agora())
    else:
        ag["proxima_execucao"] = _iso(calcular_proxima(ag))
    item = store.create(KIND, ag)
    store.add_log("agendamento.criado", f"{item['nome']} ({'executar agora' if agora else descricao_frequencia(item)})")
    return _publico(item)

def definir_ativo(item_id, cliente, ativo):
    with _LOCK:
        ag = _do_cliente(item_id, cliente)
        if not ag:
            return None
        patch = {"ativo": bool(ativo),
                 "proxima_execucao": _iso(calcular_proxima(ag)) if ativo else None}
        item = store.update(KIND, item_id, patch)
    store.add_log("agendamento.ativado" if ativo else "agendamento.pausado", item["nome"])
    return _publico(item)

def excluir(item_id, cliente):
    ag = _do_cliente(item_id, cliente)
    if not ag:
        return False
    store.remove(KIND, item_id)
    store.add_log("agendamento.excluido", ag["nome"])
    return True

def executar_agora(item_id, cliente):
    """Marca para rodar já; o n8n pega no próximo ciclo (até 1 min)."""
    with _LOCK:
        ag = _do_cliente(item_id, cliente)
        if not ag:
            return None
        if ag.get("status") == "executando" and (_parse(ag.get("lock_ate")) or _agora()) > _agora():
            return {"ja_executando": True}
        item = store.update(KIND, item_id, {"forcar": True, "proxima_execucao": _iso(_agora())})
    store.add_log("agendamento.executar_agora", item["nome"])
    return _publico(item)

def montar_comando(ag):
    """Com credenciais, o usuário e a senha seguem em base64 pela entrada padrão do
    script (-C): não aparecem como argumento do script nem nos arquivos de histórico."""
    secoes = ",".join(str(s) for s in sorted(ag["secoes"]))
    base = f"{shlex.quote(Config.ORACLE_SCRIPT_PATH)} -i {ag['instancia']} -s {secoes}"
    prefixo = ""
    if ag.get("senha_cifrada") and ag.get("usuario_banco"):
        cred = f"{ag['usuario_banco']}\n{decifrar_senha(ag['senha_cifrada'])}".encode()
        prefixo = f"printf %s {base64.b64encode(cred).decode()} | "
        base += " -C"
    return prefixo + (f"sudo -n -u oracle {base}" if Config.ORACLE_USE_SUDO else base)

def _saudacao(dt_local):
    h = dt_local.hour
    return "Bom dia" if h < 12 else "Boa tarde" if h < 18 else "Boa noite"

def _payload_n8n(ag):
    agora_local = _agora().astimezone(_tz())
    assunto = ag.get("assunto") or "Relatório de Monitoramento - {instancia} - {data}"
    assunto = (assunto.replace("{instancia}", ag["instancia"])
                      .replace("{cliente}", ag.get("cliente", ""))
                      .replace("{data}", agora_local.strftime("%d/%m/%Y")))
    corpo = ag.get("mensagem") or "Segue em anexo o relatório de monitoramento."
    corpo_html = html.escape(corpo).replace("\n", "<br>")
    maquina = store.get("maquinas", str(ag.get("maquina_id", ""))) if ag.get("maquina_id") else None
    return {
        "id": ag["id"],
        "nome": ag["nome"],
        "host": (maquina or {}).get("endereco", ""),
        "cliente": ag.get("cliente", ""),
        "instancia": ag["instancia"],
        "destinatarios": ", ".join(ag["destinatarios"]),
        "assunto": assunto,
        "mensagem_html": f"<p>Prezados, {_saudacao(agora_local).lower()}!</p><p>{corpo_html}</p>",
        "comando": montar_comando(ag),
    }

def reservar_devidos():
    """Entrega ao n8n o que está na hora e já marca como 'executando' para
    que o ciclo seguinte (1 min depois) não dispare o mesmo relatório duas vezes."""
    saida = []
    with _LOCK:
        agora = _agora()
        for ag in store.all_items(KIND):
            lock = _parse(ag.get("lock_ate"))
            if ag.get("status") == "executando" and lock and lock > agora:
                continue
            if not (ag.get("ativo") or ag.get("forcar")):
                continue
            prox = _parse(ag.get("proxima_execucao"))
            if not prox or prox > agora:
                continue
            try:
                payload = _payload_n8n(ag)
            except Exception:
                store.update(KIND, ag["id"], {
                    "forcar": False, "ultima_execucao": _iso(agora), "ultimo_status": "falha",
                    "ultimo_detalhe": "Não foi possível ler a senha do banco. Exclua e crie o agendamento de novo.",
                    "proxima_execucao": _iso(calcular_proxima(ag, agora)) if ag.get("ativo") else None})
                continue
            store.update(KIND, ag["id"], {
                "status": "executando", "etapa": "coletando", "forcar": False,
                "lock_ate": _iso(agora + timedelta(minutes=LOCK_MINUTOS)),
            })
            saida.append(payload)
    return saida

def registrar_resultado(item_id, ok, mensagem=""):
    with _LOCK:
        ag = store.get(KIND, item_id)
        if not ag:
            return None
        agora = _agora()
        proxima = calcular_proxima(ag, agora) if ag.get("ativo") else None
        item = store.update(KIND, item_id, {
            "status": "agendado", "etapa": None, "lock_ate": None,
            "ultima_execucao": _iso(agora),
            "ultimo_status": "sucesso" if ok else "falha",
            "ultimo_detalhe": str(mensagem or "")[:300],
            "proxima_execucao": _iso(proxima),

            "ativo": bool(ag.get("ativo")) and not (ag["frequencia"] == "unica" and proxima is None),
        })
    _limpar_coleta(item_id)
    store.add_log("agendamento.enviado" if ok else "agendamento.falhou",
                  f"{item['nome']}: {str(mensagem or '')[:200]}", "sucesso" if ok else "erro",
                  cliente=ag.get("cliente"))
    return _publico(item)

def listar_bancos(cliente):
    itens = [b for b in store.all_items(KIND_BANCOS) if b.get("cliente") == cliente]
    itens.sort(key=lambda b: (b.get("rotulo") or b.get("instancia") or "").lower())
    return itens

def banco_existe(cliente, instancia):
    return any(b["instancia"].upper() == str(instancia).upper() for b in listar_bancos(cliente))

def criar_banco(cliente, instancia, rotulo=""):
    """-> (banco, erro). A instância (SID) é o que vai para o comando, então é validada à risca."""
    instancia = str(instancia or "").strip().upper()
    rotulo = " ".join(str(rotulo or "").split())[:60]
    if not _SID.match(instancia):
        return None, "Instância inválida: use letras, números e _ (começando por letra)."
    with _LOCK:
        if banco_existe(cliente, instancia):
            return None, "Este banco já está cadastrado."
        item = store.create(KIND_BANCOS, {"cliente": cliente, "instancia": instancia, "rotulo": rotulo or instancia})
    store.add_log("banco.cadastrado", f"{item['rotulo']} ({instancia})")
    return item, None

def excluir_banco(item_id, cliente):
    b = store.get(KIND_BANCOS, item_id)
    if not b or b.get("cliente") != cliente:
        return False
    return store.remove(KIND_BANCOS, item_id)

def _arquivo_coleta(item_id):
    if not _ID.match(str(item_id)):
        raise ValueError("id inválido")
    return os.path.join(PASTA_COLETAS, f"{item_id}.txt")

def salvar_coleta(item_id, stdout):
    """Guarda o que o servidor Oracle devolveu. Só depois disso o PDF é montado."""
    with _LOCK:
        if not store.get(KIND, item_id):
            return None
        os.makedirs(PASTA_COLETAS, exist_ok=True)
        with open(_arquivo_coleta(item_id), "w", encoding="utf-8") as f:
            f.write(str(stdout or "")[:3_000_000])
        return store.update(KIND, item_id, {"etapa": "gerando_pdf"})

def ler_coleta(item_id):
    try:
        with open(_arquivo_coleta(item_id), encoding="utf-8") as f:
            return f.read()
    except (OSError, ValueError):
        return ""

def _limpar_coleta(item_id):
    try:
        os.remove(_arquivo_coleta(item_id))
    except (OSError, ValueError):
        pass
