#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Falta o arquivo .env. Copie .env.example para .env e preencha (python3 gerar_chaves.py)."; exit 1; }

backup() {
  mkdir -p backups
  ts="$(date +%Y%m%d-%H%M)"
  docker run --rm -v nexus-n8n_n8n_data:/dados -v "$PWD/backups":/backup alpine tar czf "/backup/n8n-$ts.tgz" -C /dados .
  echo "Backup criado: backups/n8n-$ts.tgz"
}

case "${1:-}" in
  iniciar)   docker compose up -d && docker compose ps ;;
  parar)     docker compose down ;;
  reiniciar) docker compose restart n8n ;;
  status)    docker compose ps ;;
  logs)      docker compose logs -f --tail=100 n8n ;;
  versao)    docker compose exec n8n n8n --version ;;
  backup)    backup ;;
  atualizar) backup && docker compose pull && docker compose up -d && docker image prune -f && docker compose exec n8n n8n --version ;;
  *) echo "Uso: $0 iniciar|parar|reiniciar|status|logs|versao|backup|atualizar"; exit 1 ;;
esac

