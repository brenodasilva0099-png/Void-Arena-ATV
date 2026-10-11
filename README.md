# Void Arena Live

Activity de transmissão do Void Arena para Discord.

## Deploy no Render

- Branch: `main`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check: `/health`
- Auto-Deploy: ligado

O repositório contém um wrapper de deploy e a versão estável da Activity em `activity-src.tar.gz`. O build extrai a Activity, instala as dependências e compila automaticamente.

Application ID padrão: `1513157422057918625`.

Depois do deploy, use o host fixo `*.onrender.com` no Discord Developer Portal em **Atividades → Mapeamentos de URL**.
