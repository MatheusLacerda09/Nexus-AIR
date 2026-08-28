import time
import psutil


class SistemaService:

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
