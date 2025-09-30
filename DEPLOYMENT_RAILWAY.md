# Deployment no Railway

Este guia assume o reposit�rio hospedado no GitHub (henriqueffazendeiro/OPPND). A app principal fica em server/ e � uma API Node.js/Express com build TypeScript.

## 1. Criar o projecto no Railway
- Aceda a https://railway.app e crie um novo projecto.
- Escolha **Deploy from GitHub Repo** e seleccione henriqueffazendeiro/OPPND.
- Quando for pedido, defina **Root Directory** como server para que o Railway instale/aplique apenas o backend.

## 2. Configurar as vari�veis de ambiente
O backend precisa das seguintes vari�veis:

- MONGO_URI � string de liga��o ao MongoDB.
- NODE_ENV � defina para production (Railway define automaticamente PORT).

### MongoDB
1. No painel do Railway, clique em **New > Database > MongoDB** para criar uma inst�ncia gerida.
2. Abra a p�gina do novo recurso e copie o valor apresentado em **Connection > Default connection string**.
3. Volte ao servi�o da API e, em **Variables**, crie MONGO_URI colando essa connection string.

> Dica: o Railway injecta automaticamente a vari�vel PORT; n�o defina este valor manualmente.

## 3. Build e comando de arranque
O package.json do backend inclui:

`json
"prestart": "npm run build",
"start": "node dist/index.js"
`

Isto significa que o Railway pode simplesmente correr 
pm start. O build TypeScript acontece automaticamente antes da execu��o.

Confirme na sec��o **Settings > Deployments** do servi�o que o comando de start est� definido como 
pm start.

## 4. Dom�nio e HTTPS
- Depois da primeira implanta��o, o Railway atribui um dom�nio p�blico (https://<app>.up.railway.app).
- Copie este dom�nio e configure a extens�o Chrome (op��es Oppnd) para apontar para https://<app>.up.railway.app.
- Opcionalmente, adicione um dom�nio personalizado em **Settings > Domains**.

## 5. Verificar a API
- Use o bot�o **Open URL** no Railway para abrir /health e confirmar que a API devolve { "status": "ok" }.
- Os restantes endpoints ficam imediatamente dispon�veis para a extens�o (SSE, pixel, eventos).

## 6. Deploy cont�nuo
Sempre que fizer push na branch principal (por exemplo main), o Railway ir� construir e publicar automaticamente.

Se quiser ambientes separados (ex.: staging), crie novos ambientes dentro do mesmo projecto Railway e associe branches diferentes.

## 7. Tarefas opcionais
- Guardar MONGO_URI no GitHub (Actions secrets) caso pretenda configurar uma pipeline CI/CD com o [Railway CLI](https://docs.railway.app/cli/overview).
- Activar logs persistentes em **Observability** para acompanhar eventos do pixel e SSE.

