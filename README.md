# Clube de Tênis — Frontend

Interface web do sistema de gestão do clube de tênis. Esta primeira entrega cobre a **US02 — login e logout**, usando a API do repositório [pds2-gestao-tenis-backend](https://github.com/Kiincoder/pds2-gestao-tenis-backend).

Stack: React 19, TypeScript e Vite, com CSS puro.

## Executar

1. Suba a API seguindo o README do backend (ela deve responder em `http://localhost:8000`).
2. Neste repositório:

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`.

A API ainda não libera CORS, então em desenvolvimento o Vite repassa tudo que começa com `/api` para `http://localhost:8000`. Para apontar para outro endereço, crie um `.env` com `API_PROXY_TARGET=http://outro-host:porta`.

Em produção, defina `VITE_API_URL` com a URL da API antes do `npm run build` (e libere CORS no backend para o domínio do frontend).

## O que a tela faz

- `POST /api/v1/auth/login` com e-mail e senha; mostra as mensagens da API para 401 (credenciais), 422 (dados inválidos) e 429 (muitas tentativas).
- Guarda o token na `sessionStorage` da aba e confere com `GET /api/v1/auth/me` ao recarregar.
- `POST /api/v1/auth/logout` no botão **Sair**.

## Organização

```text
src/
  api/auth.ts             Chamadas às rotas de autenticação e tratamento de erros
  api/session-storage.ts  Token da sessão na aba atual
  components/
    CourtBackdrop.tsx     Quadra em SVG nas medidas oficiais (fundo da página)
    LoginForm.tsx         Formulário de login com validação
    SignedIn.tsx          Tela provisória após o login
  App.tsx                 Alterna entre login e sessão ativa
  styles.css              Paleta, tipografia e layout
```
