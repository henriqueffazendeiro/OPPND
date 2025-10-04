# Deployment no Railway

Este guia assume o repositorio hospedado no GitHub (henriqueffazendeiro/OPPND). A app principal fica em server/ e e uma API Node.js/Express com build TypeScript.

## 1. Criar o projecto no Railway
- Aceda a https://railway.app e crie um novo projecto.
- Escolha **Deploy from GitHub Repo** e seleccione henriqueffazendeiro/OPPND.
- Quando for pedido, defina **Root Directory** como `server` para que o Railway instale apenas o backend.

## 2. Configurar as variaveis de ambiente
O backend usa as seguintes variaveis:

- `MONGO_URL` - string de ligacao ao MongoDB (criada automaticamente ao adicionar o recurso Mongo).
- `MONGO_URI` - opcional, caso prefira manter a mesma nomenclatura do projecto (pode copiar o valor de `MONGO_URL`).
- `NODE_ENV` - defina para `production` (o Railway injeta automaticamente `PORT`).

### MongoDB
1. No painel do Railway, clique em **New > Database > MongoDB** para criar uma instancia gerida.
2. Abra a pagina do novo recurso e copie o valor apresentado em **Connection > Default connection string**.
3. Volte ao servico da API e confirme em **Variables** que `MONGO_URL` esta disponivel. Se quiser utilizar `MONGO_URI`, crie-a com o mesmo valor.

> Dica: o Railway injeta automaticamente a variavel `PORT`; nao defina este valor manualmente.

## 3. Build e comando de arranque
O `package.json` do backend inclui:

```json
"prestart": "npm run build",
"start": "node dist/index.js"
```

Isto significa que o Railway pode simplesmente correr `npm start`. O build TypeScript acontece automaticamente antes da execucao.

Confirme na secao **Settings > Deployments** do servico que o comando de start esta definido como `npm start`.

## 4. Dominio e HTTPS
- Depois da primeira implantacao, o Railway atribui um dominio publico (https://<app>.up.railway.app).
- Copie este dominio e configure a extensao Chrome (opcoes Oppnd) para apontar para https://<app>.up.railway.app.
- Opcionalmente, adicione um dominio personalizado em **Settings > Domains**.

## 5. Verificar a API
- Use o botao **Open URL** no Railway para abrir `/health` e confirmar que a API devolve `{ "status": "ok" }`.
- Os restantes endpoints ficam imediatamente disponiveis para a extensao (SSE, pixel, eventos).

## 6. Deploy continuo
Sempre que fizer push na branch principal (por exemplo `main`), o Railway vai construir e publicar automaticamente.

Se quiser ambientes separados (ex.: staging), crie novos ambientes dentro do mesmo projecto Railway e associe branches diferentes.

## 7. Tarefas opcionais
- Guardar `MONGO_URL` (ou `MONGO_URI`) no GitHub (Actions secrets) caso pretenda configurar uma pipeline CI/CD com o [Railway CLI](https://docs.railway.app/cli/overview).
- Activar logs persistentes em **Observability** para acompanhar eventos do pixel e SSE.
