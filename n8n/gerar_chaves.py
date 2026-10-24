"""Gera as duas chaves de que o Nexus Air + n8n precisam. Nao grava nada: copie para os arquivos indicados."""
import secrets

print("# n8n/.env  (chave de cifra das credenciais do n8n - guarde uma copia fora do PC)")
print("N8N_ENCRYPTION_KEY=" + secrets.token_hex(32))
print()
print("# .env do Nexus Air (raiz do projeto)  e  credencial 'Nexus API Key' do n8n (Value)")
print("N8N_API_KEY=" + secrets.token_urlsafe(32))
print()
print("Atencao: NAO troque o SECRET_KEY do Nexus Air se ja existem agendamentos (as senhas dos bancos")
print("ficam cifradas com ele). Trocar o N8N_API_KEY e seguro: atualize o .env e a credencial no n8n.")
