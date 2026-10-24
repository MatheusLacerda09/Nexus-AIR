@echo off
rem Controle do n8n do Nexus Air (Windows). Uso: n8n.bat iniciar ^| parar ^| reiniciar ^| status ^| logs ^| versao ^| backup ^| atualizar
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Falta o arquivo .env. Copie .env.example para .env e preencha ^(python gerar_chaves.py^).
  exit /b 1
)
if /i "%1"=="iniciar"   (docker compose up -d && docker compose ps & goto :eof)
if /i "%1"=="parar"     (docker compose down & goto :eof)
if /i "%1"=="reiniciar" (docker compose restart n8n & goto :eof)
if /i "%1"=="status"    (docker compose ps & goto :eof)
if /i "%1"=="logs"      (docker compose logs -f --tail=100 n8n & goto :eof)
if /i "%1"=="versao"    (docker compose exec n8n n8n --version & goto :eof)
if /i "%1"=="backup"    (call :backup & goto :eof)
if /i "%1"=="atualizar" (
  call :backup
  if errorlevel 1 (echo Backup falhou. Atualizacao cancelada. & exit /b 1)
  docker compose pull && docker compose up -d && docker image prune -f && docker compose exec n8n n8n --version
  goto :eof
)
echo Uso: n8n.bat iniciar ^| parar ^| reiniciar ^| status ^| logs ^| versao ^| backup ^| atualizar
exit /b 1

:backup
if not exist backups mkdir backups
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set TS=%%i
docker run --rm -v nexus-n8n_n8n_data:/dados -v "%cd%\backups":/backup alpine tar czf /backup/n8n-%TS%.tgz -C /dados .
if errorlevel 1 exit /b 1
echo Backup criado: backups\n8n-%TS%.tgz
exit /b 0
