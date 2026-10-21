# Clube de Tênis — Frontend

Interface em React, TypeScript, Vite e CSS puro, com login, navegação, início e dados da conta. A área de membros possui verificação de acesso administrativo; a tabela e os formulários ainda não estão implementados.

## Executar sem backend

Com Node.js instalado:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra [localhost:5173](http://localhost:5173).

O `.env.example` ativa os dados simulados. As contas fictícias são `admin@clube.example` e `usuario@clube.example`, ambas com a senha `SenhaSegura123`.

Os dados simulados ficam na sessão da aba e não são enviados à API. Use somente dados fictícios. As opções disponíveis estão em `.env.example`; reinicie o Vite após alterar `.env.local`.

## Executar com backend

Em `.env.local`, configure:

```env
VITE_USE_MOCK_API=false
API_PROXY_TARGET=http://localhost:8000
```

Inicie a API e execute `npm run dev`. O Vite encaminha as requisições `/api/*` ao backend. As sessões de mock e API real são separadas.

O frontend consulta `/api/v1/auth/me` para recuperar a sessão. Como a resposta de usuário ainda não informa se a conta é administrativa, o acesso à área de membros é verificado por `/api/v1/members?page_size=1`. A autorização continua sendo responsabilidade do backend.

## Build

```powershell
npm run build
npm run preview
```

O build de produção sempre usa a API real. Para uma API em outra origem, defina `VITE_API_URL` antes do build, sem `/api/v1` no final, e configure CORS no backend. Na mesma origem, o servidor de hospedagem deve encaminhar `/api` ao backend.

Não inclua `.env.local`, `node_modules` ou `dist` no Git; o `.gitignore` já os exclui. Mantenha `.env.example` e `package-lock.json` no repositório.
