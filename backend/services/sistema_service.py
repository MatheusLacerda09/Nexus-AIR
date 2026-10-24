import re
import time

import psutil

PROJETO_INICIO_EPOCH = time.time()

def obter_frequencia_processador_ghz():
    frequencia = psutil.cpu_freq()
    atual_mhz = float(frequencia.current or 0) if frequencia else 0.0
    maximo_mhz = float(frequencia.max or 0) if frequencia else 0.0
    mhz = atual_mhz or maximo_mhz
    if mhz <= 0:
        try:
            texto = open('/proc/cpuinfo', encoding='utf-8').read()
            valores = [float(v) for v in re.findall(r'cpu MHz\s*:\s*([0-9.]+)', texto)]
            if valores:
                mhz = sum(valores) / len(valores)
        except (OSError, ValueError):
            mhz = 0.0
    return round(mhz / 1000, 2) if mhz > 0 else 0.0

class SistemaService:

    def obter_status(self):
        uso_percentual = psutil.cpu_percent(interval=0.3)
        livre_percentual = max(0, 100 - uso_percentual)
        nucleos = psutil.cpu_count(logical=True) or 1
        agora = time.time()
        memoria = psutil.virtual_memory()
        tempo_projeto_segundos = max(0, int(agora - PROJETO_INICIO_EPOCH))
        inicio_atividade_epoch = float(psutil.boot_time())
        tempo_atividade_segundos = max(0, int(agora - inicio_atividade_epoch))

        return {
            "velocidadeGHz": obter_frequencia_processador_ghz(),
            "nucleos": nucleos,
            "usoPercentual": round(uso_percentual),
            "livrePercentual": round(livre_percentual),
            "tempoAtividadeSegundos": tempo_projeto_segundos,
            "inicioProjetoEpoch": PROJETO_INICIO_EPOCH,
            "inicioAtividadeEpoch": inicio_atividade_epoch,
            "ramTotalBytes": memoria.total,
            "ramUsadaBytes": memoria.used,
            "ramLivreBytes": memoria.available,
            "ramUsoPercentual": round(memoria.percent),
        }
