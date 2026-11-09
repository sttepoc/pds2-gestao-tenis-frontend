# Clube de Tênis — Frontend

Interface em React, TypeScript, Vite e CSS puro, com login, navegação, início, dados da conta e reservas de quadras completas: cadastro de quadras e manutenção, agenda, reservas com convidados, confirmação de presença, cancelamento, remarcação e fila de espera com oferta automática. A área de membros só verifica o acesso administrativo; a tabela e os formulários de membros ainda não estão implementados.

## Telas de reservas

| Rota | Tela | Quem acessa |
|---|---|---|
| `#/quadras` | Quadras: criar, editar e marcar manutenção (a manutenção pode cancelar reservas do período) | Administração |
| `#/agenda` | Agenda dos próximos 7 dias por quadra e horário; reservar com participantes, entrar na fila de espera de horários ocupados | Todas as contas |
| `#/agenda/remarcar/{id}` | Remarcar uma reserva para outro horário livre | Quem organiza a reserva |
| `#/reservas` | Minhas reservas (próximas e passadas), confirmação de presença e ofertas da fila de espera | Todas as contas |
| `#/reservas/{id}` | Detalhe da reserva: participantes, confirmar ou recusar presença, remarcar e cancelar | Quem organiza ou participa |

Quando uma vaga abre, a primeira pessoa da fila recebe uma oferta com prazo para aceitar ou recusar.

Na agenda de hoje, horários livres que já começaram aparecem como "encerrado" e não abrem o formulário de reserva nem de remarcação. Esse estado existe só na tela: a API continua mandando `free`, e o servidor recusa reservar no passado.

## Executar sem backend

Com Node.js instalado:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra [localhost:5173](http://localhost:5173).

O `.env.example` ativa os dados simulados. As contas fictícias são `admin@clube.example`, `usuario@clube.example`, `mariana@clube.example`, `pedro@clube.example` e `camila@clube.example`, todas com a senha `SenhaSegura123`. Só a primeira é administrativa. Mariana Silva, Pedro Santos e Camila Oliveira aparecem na busca de participantes e servem para testar convites, confirmação de presença e fila de espera; no início, Mariana já está convidada para uma reserva organizada por `usuario@clube.example`.

Os dados simulados ficam na sessão da aba e não são enviados à API. Use somente dados fictícios. As opções disponíveis estão em `.env.example`; reinicie o Vite após alterar `.env.local`.

O cenário é escolhido em `VITE_MOCK_SCENARIO`. Para reservas, use `conflict`: toda tentativa de reservar ou remarcar responde 409 ("Esse horário acabou de ser reservado por outra pessoa"), útil para ver o alerta de conflito e a recarga da agenda. Ele não ocupa o horário de verdade; para testar a fila de espera, entre com outra conta em um horário já reservado (por exemplo, a reserva de `usuario@clube.example` vista por `pedro@clube.example`).

## Executar com backend

Em `.env.local`, configure:

```env
VITE_USE_MOCK_API=false
API_PROXY_TARGET=http://localhost:8000
```

Inicie a API e execute `npm run dev`. O Vite encaminha as requisições `/api/*` ao backend. As sessões de mock e API real são separadas.

O frontend consulta `/api/v1/auth/me` para recuperar a sessão. Como a resposta de usuário ainda não informa se a conta é administrativa, o acesso à área de membros é verificado por `/api/v1/members?page_size=1`. A autorização continua sendo responsabilidade do backend.

## Testes

```powershell
npm test
```

Executa a suíte do Vitest (jsdom e Testing Library) uma vez. Use `npm run test:watch` durante o desenvolvimento.

## Contrato da API de reservas (para o backend)

O backend ainda precisa implementar os endpoints abaixo, em `/api/v1`. As respostas com conteúdo vêm no envelope `{ "data": ... }`; sair da fila e recusar a oferta respondem `204` sem corpo. Erros vêm como `{ "message", "errors" }`. Os status usados são 401, 403, 404, 409, 422 e 429. Os tipos da coluna "Resposta" estão em `src/api/types.ts`. O mock em `src/mocks/` é a referência executável das regras e `src/api/real.ts` é o cliente que chama estes endpoints.

| Endpoint | Corpo enviado | Resposta |
|---|---|---|
| `GET /courts` | | `{ data: Court[] }` |
| `POST /courts` | `name`, `surface`, `covered` | `{ data: Court }` |
| `PATCH /courts/{id}` | `name`, `surface`, `covered` (parcial) | `{ data: Court }` |
| `POST /courts/{id}/maintenance` | `starts_at`, `ends_at`, `reason`, `cancel_bookings` (opcional) | `{ data: Court }` |
| `DELETE /courts/{id}/maintenance/{mid}` | | `{ data: Court }` |
| `GET /schedule?date=` | | `{ data: Schedule }` |
| `GET /players?q=` | | `{ data: Player[] }` (só `id` e `name`) |
| `POST /bookings` | `court_id`, `starts_at`, `participant_ids` | `{ data: Booking }` |
| `GET /bookings?scope=upcoming\|past` | | `{ data: Booking[] }` |
| `GET /bookings/{id}` | | `{ data: Booking }` |
| `POST /bookings/{id}/cancel` | | `{ data: Booking }` |
| `PATCH /bookings/{id}` (remarcar) | `court_id`, `starts_at` | `{ data: Booking }` |
| `PUT /bookings/{id}/attendance` | `response`: `confirmed` ou `declined` | `{ data: Booking }` |
| `GET /waitlist` | | `{ data: WaitlistEntry[] }` |
| `POST /waitlist` | `court_id`, `starts_at` | `{ data: WaitlistEntry }` |
| `DELETE /waitlist/{id}` | | `204`, sem corpo |
| `POST /waitlist/{id}/accept` | | `{ data: Booking }` |
| `POST /waitlist/{id}/decline` | | `204`, sem corpo |

Toda autorização (administração, organizador, participante) precisa ser verificada no servidor; o frontend apenas esconde botões. Reservas de outras pessoas devem responder 404, só o organizador cancela ou remarca (403 para participantes) e conflitos de horário respondem 409.

`starts_at` de reservas, remarcações e fila é sempre uma hora cheia exata (sem segundos), entre 07:00 e 21:00 no horário do clube; fora disso, 422. Horário que já começou responde 422 ("Esse horário já passou.").

Aceitar uma oferta vencida responde 409. Se o servidor já tiver tirado a entrada da fila, a resposta pode ser 404; a tela trata os dois casos como "oferta encerrada" e recarrega a lista.

## Build

```powershell
npm run build
npm run preview
```

O build de produção sempre usa a API real. Para uma API em outra origem, defina `VITE_API_URL` antes do build, sem `/api/v1` no final, e configure CORS no backend. Na mesma origem, o servidor de hospedagem deve encaminhar `/api` ao backend.

Não inclua `.env.local`, `node_modules` ou `dist` no Git; o `.gitignore` já os exclui. Mantenha `.env.example` e `package-lock.json` no repositório.
