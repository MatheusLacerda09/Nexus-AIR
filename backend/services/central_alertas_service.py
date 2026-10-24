from datetime import datetime
from decimal import Decimal

from services.automation_store import all_items

SEVERIDADES = ("baixa", "media", "alta", "critica")
LIMITES = {
    "tipo_alerta": 100, "status_alerta": 200, "contexto": 100, "origem": 50,
    "descricao": 500, "recomendacao": 500, "observacao": 500,
}

class AlertaInvalido(Exception):
    def __init__(self, erros):
        super().__init__("; ".join(erros))
        self.erros = erros

class AlertaNaoEncontrado(Exception):
    pass

def _json_seguro(linha):
    """Datas viram texto ISO e Decimal vira número (o JSON do Flask não cobre tudo)."""
    if linha is None:
        return None
    saida = {}
    for chave, valor in linha.items():
        if isinstance(valor, datetime):
            valor = valor.strftime("%Y-%m-%dT%H:%M:%S")
        elif isinstance(valor, Decimal):
            valor = float(valor)
        saida[chave] = valor
    saida["verificado"] = bool(saida.get("verificado"))
    return saida

def _chave_ip(item):
    """Identificador (cabe em VARCHAR(15)) de uma máquina/banco cadastrado:
    o próprio IP quando couber; senão o id interno de 12 caracteres."""
    endereco = str(item.get("endereco") or "").strip()
    return endereco if 0 < len(endereco) <= 15 else str(item.get("id"))[:15]

def _cadastrados(cliente):
    """Máquinas virtuais e bancos cadastrados na tela de Máquinas, da empresa."""
    maquinas, bancos = [], []
    for item in all_items("maquinas"):
        if item.get("cliente") != cliente:
            continue
        registro = {"hostname": item.get("nome") or item.get("host_zabbix") or item.get("endereco"),
                    "ip": _chave_ip(item), "status": item.get("status"), "origem": "cadastro"}
        (bancos if item.get("tipo") == "banco" else maquinas).append(registro)
    return maquinas, bancos

def _texto(dados, campo, obrigatorio=False, padrao=None):
    valor = dados.get(campo)
    valor = str(valor).strip() if valor is not None else ""
    if not valor:
        return None if not obrigatorio and padrao is None else padrao
    return valor

def _separar_id(alerta_ref):
    """"12" -> ("maquina", 12); "t-5" -> ("tarefa", 5). Qualquer outra coisa não existe."""
    ref = str(alerta_ref).strip()
    try:
        if ref.startswith("t-"):
            return "tarefa", int(ref[2:])
        return "maquina", int(ref)
    except ValueError:
        raise AlertaNaoEncontrado()

def _texto_alerta_tarefa(evento, tarefa, por):
    ident = f"{tarefa['tarefa']} ({tarefa['id']})"
    if evento == "concluido":
        return {
            "tipo_alerta": "Tarefa concluída", "severidade": "baixa", "criado_por": "Sistema",
            "status_alerta": f"{ident} concluída com sucesso.",
            "descricao": f"O processo {tarefa['id']} ({tarefa['tarefa']}) terminou a execução sem erros.",
            "recomendacao": "Confira o resultado gerado pela tarefa e marque o alerta como verificado.",
        }
    if evento == "interrompido":
        return {
            "tipo_alerta": "Tarefa interrompida", "severidade": "media", "criado_por": "Sistema",
            "status_alerta": f"{ident} foi interrompida manualmente.",
            "descricao": f"O processo {tarefa['id']} ({tarefa['tarefa']}) estava em execução e foi parado por um usuário antes de terminar.",
            "recomendacao": "Confirme se a interrupção foi intencional e, se necessário, retome o processo na tabela de tarefas.",
        }
    if evento == "excluido":
        return {
            "tipo_alerta": "Tarefa excluída", "severidade": "media", "criado_por": por or "Usuário",
            "status_alerta": f"{ident} foi excluída por {por or 'um usuário'}.",
            "descricao": f"A tarefa {tarefa['id']} ({tarefa['tarefa']}, status {tarefa['status']}) foi removida da tabela de tarefas por {por or 'um usuário'}.",
            "recomendacao": "Confirme que a exclusão foi intencional e marque o alerta como verificado.",
        }
    raise AlertaInvalido(["Evento de tarefa inválido."])

class CentralAlertasService:
    def __init__(self, repositorio):
        self.repo = repositorio

    def listar(self, cliente, status="pendente"):
        if status not in ("pendente", "verificado", "todos"):
            raise AlertaInvalido(["Status inválido. Use pendente, verificado ou todos."])
        verificado = {"pendente": False, "verificado": True, "todos": None}[status]
        alertas = self.repo.listar(verificado, cliente) + self.repo.listar_tarefa(verificado, cliente)
        chave = "verificado_em" if status == "verificado" else "horario"
        alertas.sort(key=lambda a: str(a.get(chave) or a.get("horario") or ""), reverse=True)
        return {
            "alertas": [_json_seguro(l) for l in alertas],
            "total_pendentes": self.repo.contar_pendentes(cliente),
        }

    def _buscar(self, alerta_ref, cliente):
        tipo, numero = _separar_id(alerta_ref)
        linha = self.repo.buscar_tarefa(numero, cliente) if tipo == "tarefa" else self.repo.buscar(numero, cliente)
        if not linha:
            raise AlertaNaoEncontrado()
        return tipo, numero, linha

    def detalhar(self, alerta_ref, cliente):
        return _json_seguro(self._buscar(alerta_ref, cliente)[2])

    def opcoes(self, cliente=None):
        sql_maquinas, sql_bancos = self.repo.opcoes()
        cad_maquinas, cad_bancos = _cadastrados(cliente)

        maquinas = {m["ip"]: m for m in cad_maquinas}
        for m in sql_maquinas:
            maquinas.setdefault(m["ip"], {"hostname": m["hostname"], "ip": m["ip"]})
        bancos = {b["ip"]: b for b in cad_bancos}
        for b in sql_bancos:
            bancos.setdefault(b["ip"], {"hostname": b["ip"], "ip": b["ip"]})
        ordenar = lambda itens: sorted(itens.values(), key=lambda x: str(x.get("hostname") or "").lower())
        return {"maquinas": ordenar(maquinas), "bancos": ordenar(bancos), "severidades": list(SEVERIDADES)}

    def criar(self, dados, criado_por, cliente):
        erros = []
        tipo = _texto(dados, "tipo_alerta")
        status = _texto(dados, "status_alerta")
        ip_maquina = _texto(dados, "ip_maquina")
        ip_banco = _texto(dados, "ip_banco")
        severidade = (_texto(dados, "severidade") or "media").lower()

        if not tipo:
            erros.append("Informe o tipo do alerta.")
        if not status:
            erros.append("Informe o resumo (status) do alerta.")
        if not ip_maquina:
            erros.append("Selecione a máquina virtual.")
        if not ip_banco:
            erros.append("Selecione o banco de dados.")
        if severidade not in SEVERIDADES:
            erros.append("Severidade inválida. Use baixa, média, alta ou crítica.")

        campos = {
            "tipo_alerta": tipo, "status_alerta": status,
            "contexto": _texto(dados, "contexto"), "origem": _texto(dados, "origem") or "manual",
            "descricao": _texto(dados, "descricao"), "recomendacao": _texto(dados, "recomendacao"),
        }
        for nome, valor in campos.items():
            if valor and len(valor) > LIMITES[nome]:
                erros.append(f"O campo {nome.replace('_', ' ')} aceita no máximo {LIMITES[nome]} caracteres.")

        if not erros:
            cad_maquinas, cad_bancos = _cadastrados(cliente)
            cad_m = next((m for m in cad_maquinas if m["ip"] == ip_maquina), None)
            cad_b = next((b for b in cad_bancos if b["ip"] == ip_banco), None)
            if cad_m:
                self.repo.garantir_maquina(cad_m["hostname"], ip_maquina, cad_m.get("status"))
            if cad_b:
                self.repo.garantir_banco(ip_banco, cad_b.get("status"))
            if not self.repo.existe_ip("maquinas_virtuais", ip_maquina):
                erros.append("Máquina virtual não encontrada.")
            if not self.repo.existe_ip("banco", ip_banco):
                erros.append("Banco de dados não encontrado.")
        if erros:
            raise AlertaInvalido(erros)

        novo_id = self.repo.criar({
            **campos, "cliente": cliente, "ip_maquina": ip_maquina, "ip_banco": ip_banco,
            "severidade": severidade,
            "horario": datetime.now().replace(microsecond=0), "criado_por": criado_por,
        })
        return self.detalhar(str(novo_id), cliente)

    def registrar_alerta_tarefa(self, cliente, evento, tarefa, por=None):
        """Cria o alerta de uma tarefa (evento: concluido | interrompido | excluido).
        `tarefa` = dict com id, tarefa, origem, tempo, status."""
        texto = _texto_alerta_tarefa(evento, tarefa, por)
        novo_id = self.repo.criar_tarefa({
            **texto, "cliente": cliente, "contexto": tarefa["origem"],
            "horario": datetime.now().replace(microsecond=0),
            "tarefa_id": tarefa["id"], "tarefa_nome": tarefa["tarefa"], "tarefa_origem": tarefa["origem"],
            "tarefa_tempo": tarefa["tempo"], "tarefa_status": tarefa["status"],
        })
        return novo_id

    def verificar(self, alerta_ref, por, observacao, cliente):
        observacao = (observacao or "").strip() or None
        if observacao and len(observacao) > LIMITES["observacao"]:
            raise AlertaInvalido([f"A observação aceita no máximo {LIMITES['observacao']} caracteres."])
        tipo, numero, atual = self._buscar(alerta_ref, cliente)
        agora = datetime.now().replace(microsecond=0)

        if tipo == "tarefa":
            self.repo.marcar_verificado_tarefa(numero, cliente, por, observacao, agora)
        else:
            alterou = self.repo.marcar_verificado(numero, cliente, por, observacao, agora)

            if alterou and atual.get("zabbix_eventid") and atual.get("zabbix_estado") != "resolvido":
                self.repo.marcar_zabbix_pendente(numero, cliente)
                try:
                    from services import zabbix_sync
                    zabbix_sync.empurrar_em_segundo_plano()
                except Exception:
                    pass
        return self.detalhar(alerta_ref, cliente)
