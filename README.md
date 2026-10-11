# Void Arena Live

Activity de transmissão de tela do Void Arena para Discord.

Esta branch `main` é a fonte do deploy no Render. Atualizações feitas aqui podem ser publicadas automaticamente pelo Auto-Deploy do Render.

## Render

- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check: `/health`

Depois do primeiro deploy, use o host fixo `*.onrender.com` em **Discord Developer Portal → Atividades → Mapeamentos de URL**.

Versão base: **v4.2.2 Render Dev**.
