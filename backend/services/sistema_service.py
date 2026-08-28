import time
import psutil


class SistemaService:
    """
    Le metricas reais da maquina onde o Flask esta rodando (CPU, nucleos,
    tempo ligado). Antes essa coleta era feita por um servico Node.js a
    parte; com `psutil` conseguimos o mesmo dado direto em Python, o que
    elimina a necessidade de um segundo backend.
    """

    def obter_status(self):
        uso_percentual = psutil.cpu_percent(interval=0.3)
        livre_percentual = max(0, 100 - uso_percentual)

        frequencia = psutil.cpu_freq()
        velocidade_ghz = round(frequencia.current / 1000, 2) if frequencia else 0.0

        nucleos = psutil.cpu_count(logical=True) or 1
        tempo_atividade_segundos = int(time.time() - psutil.boot_time())

        return {
            "velocidadeGHz": velocidade_ghz,
            "nucleos": nucleos,
            "usoPercentual": round(uso_percentual),
            "livrePercentual": round(livre_percentual),
            "tempoAtividadeSegundos": tempo_atividade_segundos,
        }
