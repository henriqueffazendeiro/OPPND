# Oppnd - Gmail Ticks

Oppnd adiciona estados de envio, entrega e leitura aos e-mails enviados a partir do Gmail.
A solucao inclui uma extensao Chrome (Manifest V3) e um backend Node.js/Express com MongoDB e SSE.

## Estrutura

```
./extension        # Extensao Chrome Oppnd - Gmail Ticks
./server           # Backend Node.js/Express + MongoDB
```

## Extensao Chrome

1. Abra chrome://extensions no Chrome.
2. Ative **Developer mode**.
3. Clique em **Load unpacked** e selecione a pasta `extension/` deste projeto.
4. Abra o Gmail, aceda as opcoes da extensao para definir a URL da API (ex.: dominio Railway) e gerar a chave do utilizador.

### Funcionalidades principais
- Injeta um pixel invisivel no corpo do e-mail no envio (configuravel nas opcoes).
- Mostra tracinhos de estado (enviado, entregue, lido) nas listas e threads do Gmail.
- Recebe atualizacoes em tempo real via SSE do backend.
- Popup com os ultimos 10 envios e respetivo estado.

## Backend Node.js/Express

### Requisitos
- Node.js 18+
- MongoDB acessivel (local ou remoto)
- pnpm (recomendado), npm ou yarn

### Configuracao local

```
cd server
pnpm install
cp .env.example .env
# preencha MONGO_URI se quiser forcar uma URI local (ex.: memory://oppnd)
pnpm dev
```

Se nao tiver MongoDB instalado, descomente `MONGO_URI=memory://oppnd` no `.env` para usar uma instancia em memoria. No Railway, `MONGO_URL` ja vem definido automaticamente, por isso nao precisa criar `MONGO_URI`.

O servidor arranca em http://localhost:3333 por defeito e expoe os endpoints:

- `POST /events/sent` - regista um envio.
- `GET /events/history?u=<hash>` - devolve os ultimos registos do utilizador.
- `DELETE /events/:messageId?u=<hash>` - remove um registo.
- `GET /t/pixel?mid=<id>&u=<hash>` - tracking pixel 1x1 (marca entregue/lido).
- `GET /sse?u=<hash>` - canal Server-Sent Events por utilizador.
- `GET /health` - verificacao simples.

### Scripts uteis

```
pnpm dev        # ts-node-dev com reload
pnpm build      # compila para dist/
pnpm start      # executa dist/index.js (build automatico via prestart)
pnpm test       # jest + supertest
pnpm lint       # ESLint (opcional)
# Tambem e possivel usar npm/yarn: npm start compila antes de iniciar
```

## Hospedagem (Railway)
O backend esta preparado para correr no Railway: `npm start` executa um build previo e o ficheiro `DEPLOYMENT_RAILWAY.md` documenta todos os passos (root directory `server/`, variaveis `MONGO_URL`/`MONGO_URI` e `NODE_ENV`, verificacao do dominio publico, etc.).

## Testes

Os testes usam mongodb-memory-server e cobrem utilitarios de ID e o fluxo principal de rotas (events + pixel). Execute-os com `pnpm test` dentro de `server/`.

## Notas de privacidade

- O backend guarda apenas `messageId`, `userHash`, timestamps de estado e metadados minimos.
- O pixel pode ser bloqueado por clientes que desativam imagens externas.
- E possivel desativar a injecao automatica do pixel nas opcoes da extensao.

## Proximos passos sugeridos
- Ligar um dominio personalizado/HTTPS no Railway para a API publica.
- Implementar autenticacao adicional/assinaturas nos requests da extensao.
- Adicionar UI extra para gerir mensagens no popup (ex.: limpar historico).



