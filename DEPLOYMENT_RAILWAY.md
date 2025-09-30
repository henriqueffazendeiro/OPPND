# Deployment no Railway

Este guia assume o repositório hospedado no GitHub (henriqueffazendeiro/OPPND). A app principal fica em server/ e é uma API Node.js/Express com build TypeScript.

## 1. Criar o projecto no Railway
- Aceda a https://railway.app e crie um novo projecto.
- Escolha **Deploy from GitHub Repo** e seleccione henriqueffazendeiro/OPPND.
- Quando for pedido, defina **Root Directory** como server para que o Railway instale/aplique apenas o backend.

## 2. Configurar as variáveis de ambiente
O backend precisa das seguintes variáveis:

- MONGO_URI – string de ligação ao MongoDB.
- NODE_ENV – defina para production (Railway define automaticamente PORT).

### MongoDB
1. No painel do Railway, clique em **New > Database > MongoDB** para criar uma instância gerida.
2. Abra a página do novo recurso e copie o valor apresentado em **Connection > Default connection string**.
3. Volte ao serviço da API e, em **Variables**, crie MONGO_URI colando essa connection string.

> Dica: o Railway injecta automaticamente a variável PORT; não defina este valor manualmente.

## 3. Build e comando de arranque
O package.json do backend inclui:

`json
"prestart": "npm run build",
"start": "node dist/index.js"
`

Isto significa que o Railway pode simplesmente correr 
pm start. O build TypeScript acontece automaticamente antes da execução.

Confirme na secção **Settings > Deployments** do serviço que o comando de start está definido como 
pm start.

## 4. Domínio e HTTPS
- Depois da primeira implantação, o Railway atribui um domínio público (https://<app>.up.railway.app).
- Copie este domínio e configure a extensão Chrome (opções Oppnd) para apontar para https://<app>.up.railway.app.
- Opcionalmente, adicione um domínio personalizado em **Settings > Domains**.

## 5. Verificar a API
- Use o botão **Open URL** no Railway para abrir /health e confirmar que a API devolve { "status": "ok" }.
- Os restantes endpoints ficam imediatamente disponíveis para a extensão (SSE, pixel, eventos).

## 6. Deploy contínuo
Sempre que fizer push na branch principal (por exemplo main), o Railway irá construir e publicar automaticamente.

Se quiser ambientes separados (ex.: staging), crie novos ambientes dentro do mesmo projecto Railway e associe branches diferentes.

## 7. Tarefas opcionais
- Guardar MONGO_URI no GitHub (Actions secrets) caso pretenda configurar uma pipeline CI/CD com o [Railway CLI](https://docs.railway.app/cli/overview).
- Activar logs persistentes em **Observability** para acompanhar eventos do pixel e SSE.

