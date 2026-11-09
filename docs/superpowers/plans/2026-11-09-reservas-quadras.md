# Reservas de Quadras — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task follows superpowers:test-driven-development (test first, watch it fail, then implement).

**Goal:** Implementar as telas de Quadras, Agenda, Minhas reservas, Detalhe da reserva, Remarcar e Fila de espera, cobrindo os 12 itens de backlog, com mock completo e cliente HTTP prontos para o backend.

**Architecture:** Cada história é uma fatia vertical: tipos e contrato em `src/api/types.ts`, chamada HTTP em `src/api/real.ts`, regra simulada em `src/mocks/*` (que serve como especificação executável do backend), página em `src/pages/*` e componentes em `src/components/*`. As páginas recebem `session` e `onExpired` por props, como as páginas atuais. Os testes de tela rodam contra o mock real, injetado em `getApi()`.

**Tech Stack:** React 19, TypeScript (strict), Vite 8, CSS puro. Para testes (somente devDependencies): Vitest 5.1.0, jsdom 31.0.0, @testing-library/react 16.3.3, @testing-library/user-event 14.6.8 e @testing-library/jest-dom 7.0.1.

**Spec:** `docs/superpowers/specs/2026-11-09-reservas-quadras-design.md`

## Global Constraints

- Nenhuma nova dependência de runtime. Dependências de teste entram com `--save-exact` e com `package-lock.json` versionado.
- Textos em pt-BR, no tom das telas atuais. Código, nomes e identificadores em inglês, como no projeto. Comentários curtos em pt-BR, só quando explicam um porquê.
- Padrão visual: `.page-heading` com `.eyebrow` em MAIÚSCULAS, `.content-panel`, `.submit` com `.rally` durante o envio, `.alert` (`role="alert"`), `.notice` (`role="status"`), `.field` + `.field-error` com `aria-invalid` e `aria-describedby`, e foco no primeiro campo inválido. Use os tokens de `src/styles.css`, como `--court`, `--ball`, `--ink` e `--runoff`.
- Toda chamada passa pelos wrappers de `src/api/*.ts` → `getApi()`. O mock e `realApi` implementam o mesmo `ApiServices`.
- Erros: mostre `ApiError.message` ou o texto de fallback da tela. `401` → `onExpired()`. Nunca exiba `error.stack`, `String(error)` nem o corpo cru da resposta.
- Segurança (OWASP A01/A03/API1/API3):
  - Não use `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` nem `href` montado a partir de dados. Links internos vêm de `routePaths`, `bookingPath()` ou `reschedulePath()`.
  - Ids em caminhos passam por `pathId()`. Query strings são montadas com `URLSearchParams`.
  - Corpos de requisição são montados campo a campo a partir de uma lista fixa, nunca com espalhamento do estado do formulário.
  - Esconder um botão não é autorização: toda ação trata `403`. Reserva inexistente e reserva de outra pessoa mostram a mesma mensagem.
  - Dados de outros jogadores: só `id` e `name`.
- Horários exibidos no fuso `America/Sao_Paulo` (`CLUB_TIME_ZONE`).
- Antes de cada commit: `npm test` e `npm run build` precisam passar sem warnings novos.
- Valores de domínio: horário de 1 h; reservas de hoje até +6 dias; até 3 convidados; oferta da fila vale 30 min; nome da quadra com 1–60 caracteres; motivo da manutenção com 1–200; busca de jogadores com 2–60 caracteres e até 10 resultados.

## Review Focus

1. **Horário ocupado entre ver e confirmar.** Criar, remarcar ou aceitar uma oferta vencida recebe `409`. A tela mostra o alerta, recarrega a agenda e nunca deixa o botão travado. Testado nas Tasks 7, 11 e 13.
2. **Sessão expira no meio de uma ação.** Qualquer chamada nova que receba `401` chama `onExpired`, em vez de ficar carregando para sempre. Testado no `useLoad` (Task 2) e nas mutações da Task 7.
3. **URL digitada à mão.** `#/reservas/abc`, `#/reservas/9999999999` e o id da reserva de outra pessoa mostram "Página não encontrada" ou "Reserva não encontrada", sem revelar se a reserva existe. Testado nas Tasks 2 e 9.
4. **Dados antigos do mock na aba.** O `sessionStorage` pode ter o formato v1, sem quadras. O mock volta às fixtures sem quebrar. Testado na Task 3.
5. **Meia-noite e fuso.** Um horário às 23:30 em São Paulo aparece no dia certo, mesmo com o navegador em outro fuso, e a faixa de dias começa no "hoje" do clube. Testado na Task 2 (`clubDate`) e na Task 6.

---

### Task 1: Infraestrutura de testes e dependências seguras

**Files:**
- Modify: `package.json` (scripts `test` e `test:watch`, devDependencies)
- Modify: `vite.config.ts` (bloco `test`)
- Create: `src/test/setup.ts`
- Test: `src/navigation.test.ts`, `src/api/http.test.ts`

**Interfaces:**
- Produces: `npm test` (`vitest run`) e `npm run test:watch` (`vitest`). O ambiente jsdom carrega os matchers do jest-dom.

- [ ] **Step 1: Instalar com versão exata**

Run: `npm install --save-dev --save-exact vitest@5.1.0 jsdom@31.0.0 @testing-library/react@16.3.3 @testing-library/dom @testing-library/user-event@14.6.8 @testing-library/jest-dom@7.0.1`
Expected: `package.json` lista as versões sem `^`. Fixe `@testing-library/dom` na versão exata que o npm resolver.

- [ ] **Step 2: Revisar a cadeia de suprimentos**

Run: `npm audit` → nenhuma vulnerabilidade high ou critical. Se houver, pare e reporte.
Run: `npm query ":attr(scripts, [postinstall])"` → revise cada pacote listado. O `esbuild` é esperado. Qualquer outro script de instalação vindo das novas dependências deve ser reportado antes de seguir.
Confira a grafia exata dos nomes instalados contra a lista do Step 1, para evitar typosquatting.

- [ ] **Step 3: Configurar**

Em `vite.config.ts`, adicione `/// <reference types="vitest/config" />` e `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], restoreMocks: true, unstubGlobals: true }`. Em `src/test/setup.ts`, importe `@testing-library/jest-dom/vitest` e chame `cleanup` em `afterEach`. Os testes importam `describe`, `it`, `expect` e `vi` de `vitest` (sem globais).

- [ ] **Step 4: Escrever testes de caracterização do código existente**

```ts
// src/navigation.test.ts
it.each([['', 'home'], ['#/membros', 'members'], ['#/membros/', 'members'], ['#/xyz', 'not-found']])(
  'resolveRoute(%s) → %s', (hash, route) => expect(resolveRoute(hash)).toBe(route));

// src/api/http.test.ts — fetch é a fronteira externa; aqui o stub é legítimo
it('converte 422 em ApiError com fieldErrors', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Dados inválidos.', errors: { name: ['Obrigatório'] } }), { status: 422 })));
  await expect(request('/x')).rejects.toMatchObject({ status: 422, message: 'Dados inválidos.', fieldErrors: { name: ['Obrigatório'] } });
});
it('converte falha de rede em ApiError status 0', ...);   // fetch rejeita → status 0
```

- [ ] **Step 5: Rodar**

Run: `npm test` → PASS (esses testes caracterizam o código atual). Run: `npm run build` → sucesso.

- [ ] **Step 6: Commit** — `chore: configura Vitest e Testing Library`

---

### Task 2: Rotas com id, fuso do clube e utilitários de erro e carregamento

**Files:**
- Modify: `src/navigation.ts`, `src/hooks/useRoute.ts`, `src/App.tsx` (desestruturar `useRoute()`), `src/api/error.ts`, `src/api/http.ts`
- Create: `src/lib/club-time.ts`, `src/hooks/useLoad.ts`
- Test: `src/navigation.test.ts`, `src/lib/club-time.test.ts`, `src/api/error.test.ts`, `src/api/http.test.ts`, `src/hooks/useLoad.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // navigation.ts
  export type Route = 'home' | 'account' | 'members' | 'courts' | 'schedule' | 'reschedule' | 'bookings' | 'booking' | 'login' | 'not-found';
  export const routePaths: { home: '#/inicio'; account: '#/conta'; members: '#/membros'; courts: '#/quadras'; schedule: '#/agenda'; bookings: '#/reservas'; login: '#/entrar' };
  export function bookingPath(id: number): string;     // '#/reservas/12'
  export function reschedulePath(id: number): string;  // '#/agenda/remarcar/12'
  export function routeId(hash: string): number | null;
  // useRoute.ts
  export function useRoute(): { route: Route; id: number | null };
  // club-time.ts
  export const CLUB_TIME_ZONE = 'America/Sao_Paulo';
  export const CLUB_UTC_OFFSET = '-03:00';
  export function clubDate(value: string | number): string;          // 'YYYY-MM-DD' no fuso do clube
  export function clubTime(iso: string): string;                     // 'HH:mm'
  export function nextClubDays(now: number, count: number): string[];
  export function dayParts(date: string): { weekday: string; day: string }; // '2026-11-10' → { weekday: 'TER', day: '10' }
  export function formatClubDateTime(iso: string): string;           // 'ter., 10 de nov. · 18:00'
  export function fromClubLocal(local: string): string;              // '2026-11-10T18:00' → '2026-11-10T18:00:00-03:00'
  // error.ts
  export function isExpired(error: unknown): boolean;                // ApiError com status 401
  export function errorMessage(error: unknown, fallback: string): string;
  // http.ts
  export function pathId(id: number): string;                        // lança ApiError 422 se não for inteiro seguro > 0
  // useLoad.ts
  export type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };
  export function useLoad<T>(key: string, load: () => Promise<T>, onExpired: () => void): { state: Load<T>; reload: () => void; setData: (data: T) => void };
  ```

- [ ] **Step 1: Escrever os testes que falham**

```ts
it.each([
  ['#/quadras', 'courts'], ['#/agenda', 'schedule'], ['#/reservas', 'bookings'],
  ['#/reservas/12', 'booking'], ['#/agenda/remarcar/12', 'reschedule'],
  ['#/reservas/abc', 'not-found'], ['#/reservas/0', 'not-found'], ['#/reservas/-1', 'not-found'],
  ['#/reservas/1234567890', 'not-found'], ['#/reservas/12/../membros', 'not-found'],
])('resolveRoute(%s) → %s', ...);
it('routeId lê o id só das rotas com id', () => {
  expect(routeId('#/reservas/12')).toBe(12); expect(routeId('#/agenda/remarcar/7')).toBe(7); expect(routeId('#/agenda')).toBeNull();
});
it('clubDate usa o fuso do clube perto da meia-noite', () => expect(clubDate('2026-11-10T02:30:00Z')).toBe('2026-11-09'));
it('clubTime', () => expect(clubTime('2026-11-10T21:00:00Z')).toBe('18:00'));
it('nextClubDays começa no hoje do clube', () =>
  expect(nextClubDays(Date.parse('2026-11-10T01:00:00Z'), 3)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']));
it('fromClubLocal', () => expect(fromClubLocal('2026-11-10T18:00')).toBe('2026-11-10T18:00:00-03:00'));
it.each([0, -1, 1.5, NaN, 2 ** 53])('pathId(%s) lança 422', (id) => expect(() => pathId(id)).toThrow(expect.objectContaining({ status: 422 })));
it('errorMessage não expõe erros desconhecidos', () => expect(errorMessage(new TypeError('x is undefined'), 'Falhou.')).toBe('Falhou.'));
// useLoad
it('chama onExpired quando a carga recebe 401', ...);     // load rejeita ApiError 401 → onExpired chamado 1x, estado não vira 'error'
it('mostra a mensagem do ApiError no estado de erro', ...);
it('ignora resposta antiga quando key muda', ...);       // primeira promise resolve depois da segunda → fica o dado da segunda
```

- [ ] **Step 2: Rodar** — `npx vitest run src/navigation.test.ts src/lib src/api src/hooks` → FAIL (funções inexistentes).

- [ ] **Step 3: Implementar**

`resolveRoute` aceita ids apenas com `/^[1-9]\d{0,8}$/`. `clubDate` e `clubTime` usam `Intl.DateTimeFormat` com `timeZone: CLUB_TIME_ZONE` (`en-CA` para gerar `YYYY-MM-DD`). `useLoad` usa a flag `active` do `useEffect`, como `useMemberAccess`. Em `App.tsx`, passe a usar `const { route, id } = useRoute()`, sem mudar o comportamento atual.

- [ ] **Step 4: Rodar** — `npm test` → PASS. `npm run build` → OK.

- [ ] **Step 5: Commit** — `feat: rotas com id, fuso do clube e useLoad`

---

### Task 3: Contrato da API, cliente HTTP e base do mock v2

**Files:**
- Modify: `src/api/types.ts`, `src/api/real.ts`, `src/mocks/api.ts`, `src/mocks/fixtures.ts`
- Create: `src/api/courts.ts`, `src/api/bookings.ts`, `src/api/waitlist.ts` (wrappers no padrão de `members.ts`), `src/mocks/context.ts`, `src/test/api.ts`
- Modify: `src/test/setup.ts` (mock global de `../api/client`)
- Test: `src/api/real.test.ts`, `src/mocks/api.test.ts`

**Interfaces:**
- Produces (tipos em `types.ts`):
  ```ts
  export type Surface = 'clay' | 'hard' | 'grass' | 'synthetic';
  export type MaintenanceWindow = { id: number; starts_at: string; ends_at: string; reason: string };
  export type Court = { id: number; name: string; surface: Surface; covered: boolean; maintenance: MaintenanceWindow[] };
  export type CourtInput = { name: string; surface: Surface; covered: boolean };
  export type MaintenanceInput = { starts_at: string; ends_at: string; reason: string; cancel_bookings?: boolean };
  export type Player = { id: number; name: string };
  export type SlotStatus = 'free' | 'booked' | 'mine' | 'maintenance';
  export type Slot = { court_id: number; starts_at: string; ends_at: string; status: SlotStatus; booking_id: number | null; waitlist_size: number; waitlist_entry_id: number | null };
  export type Schedule = { date: string; courts: Court[]; slots: Slot[] };
  export type Attendance = 'pending' | 'confirmed' | 'declined';
  export type Participant = Player & { attendance: Attendance };
  export type Booking = { id: number; court: { id: number; name: string }; starts_at: string; ends_at: string;
    status: 'active' | 'cancelled' | 'completed'; organizer: Player; participants: Participant[]; my_role: 'organizer' | 'participant' };
  export type BookingInput = { court_id: number; starts_at: string; participant_ids: number[] };
  export type SlotRef = { court_id: number; starts_at: string };
  export type WaitlistEntry = { id: number; court: { id: number; name: string }; starts_at: string; ends_at: string; position: number; offer: { expires_at: string } | null };
  ```
  Novos métodos de `ApiServices` (todos recebem `token` primeiro) e o endpoint que `realApi` chama. As respostas usam o envelope `{ data }`, como em members.

  | Método | HTTP |
  |---|---|
  | `listCourts(token): Promise<Court[]>` | `GET /courts` |
  | `createCourt(token, input: CourtInput): Promise<Court>` | `POST /courts` |
  | `updateCourt(token, id, input: Partial<CourtInput>): Promise<Court>` | `PATCH /courts/{id}` |
  | `addMaintenance(token, courtId, input: MaintenanceInput): Promise<Court>` | `POST /courts/{id}/maintenance` |
  | `removeMaintenance(token, courtId, maintenanceId): Promise<Court>` | `DELETE /courts/{id}/maintenance/{mid}` |
  | `getSchedule(token, date: string): Promise<Schedule>` | `GET /schedule?date=` |
  | `searchPlayers(token, q: string): Promise<Player[]>` | `GET /players?q=` |
  | `createBooking(token, input: BookingInput): Promise<Booking>` | `POST /bookings` |
  | `listBookings(token, scope: 'upcoming' \| 'past'): Promise<Booking[]>` | `GET /bookings?scope=` |
  | `getBooking(token, id): Promise<Booking>` | `GET /bookings/{id}` |
  | `cancelBooking(token, id): Promise<Booking>` | `POST /bookings/{id}/cancel` |
  | `rescheduleBooking(token, id, input: SlotRef): Promise<Booking>` | `PATCH /bookings/{id}` |
  | `respondAttendance(token, id, response: 'confirmed' \| 'declined'): Promise<Booking>` | `PUT /bookings/{id}/attendance` |
  | `listWaitlist(token): Promise<WaitlistEntry[]>` | `GET /waitlist` |
  | `joinWaitlist(token, input: SlotRef): Promise<WaitlistEntry>` | `POST /waitlist` |
  | `leaveWaitlist(token, id): Promise<void>` | `DELETE /waitlist/{id}` |
  | `acceptOffer(token, id): Promise<Booking>` | `POST /waitlist/{id}/accept` |
  | `declineOffer(token, id): Promise<void>` | `POST /waitlist/{id}/decline` |

  ```ts
  // src/mocks/context.ts — os handlers só mutam propriedades de ctx.db, nunca reatribuem ctx.db
  export type MockContext = { db: Database; now: () => number; scenario: string; persist(): void; wait(): Promise<void>;
    authenticate(token: string, admin?: boolean): MockAccount };
  export const notYet = (): never => { throw new ApiError('Ainda não disponível no modo simulado.', 501); };
  export type MockBooking = { id: number; court_id: number; starts_at: string; ends_at: string; status: 'active' | 'cancelled';
    organizer_id: number; participants: { user_id: number; attendance: Attendance }[] };
  export type MockWaitlistEntry = { id: number; user_id: number; court_id: number; starts_at: string; created_at: string; offer_expires_at: string | null };
  // src/test/api.ts — player = Bruno (usuario@), admin = Ana
  export async function setupTestApi(options?: { now?: () => number; scenario?: string }): Promise<{ api: ApiServices; admin: Session; player: Session; mariana: Session; pedro: Session }>;
  ```
  `Database` ganha `courts: Court[]`, `bookings: MockBooking[]`, `waitlist: MockWaitlistEntry[]` e `nextId`. `MOCK_DATA_KEY` passa a ser `'clube-tenis.mock-data.v2'`. As fixtures ganham as contas não administradoras Mariana (3), Pedro (4) e Camila (5), com a senha demo, e `initialClubData(now)`, que monta 3 quadras, reservas relativas ao hoje do clube (uma do Bruno amanhã às 19:00 como organizador, um convite da Camila para o Bruno e uma reserva passada) e uma manutenção na Quadra 3 hoje das 17:00 às 19:00.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// real.test.ts — tabela: chamada → [método, URL, corpo esperado (literal)]
it.each([
  [(a) => a.createCourt('t', { name: 'Q1', surface: 'clay', covered: true, id: 9, admin: true } as never), 'POST', '/api/v1/courts', { name: 'Q1', surface: 'clay', covered: true }],
  [(a) => a.getSchedule('t', '2026-11-10'), 'GET', '/api/v1/schedule?date=2026-11-10', undefined],
  [(a) => a.searchPlayers('t', 'ana&x=1'), 'GET', '/api/v1/players?q=ana%26x%3D1', undefined],
  [(a) => a.createBooking('t', { court_id: 2, starts_at: 'S', participant_ids: [3], organizer_id: 1 } as never), 'POST', '/api/v1/bookings', { court_id: 2, starts_at: 'S', participant_ids: [3] }],
  [(a) => a.respondAttendance('t', 5, 'confirmed'), 'PUT', '/api/v1/bookings/5/attendance', { response: 'confirmed' }],
  // … uma linha por método da tabela acima
])('%#: realApi envia só campos permitidos', ...);   // confere method, URL, JSON.parse(body) toEqual e Authorization 'Bearer t'
it('realApi recusa id inválido antes de chamar fetch', async () => {
  await expect(realApi.getBooking('t', '1/../../admin' as never)).rejects.toMatchObject({ status: 422 });
  expect(fetch).not.toHaveBeenCalled();
});
// mocks/api.test.ts
it('ignora dados v1 salvos e usa as fixtures v2', async () => { /* storage com JSON v1 de members → listCourts devolve 3 quadras */ });
it('métodos ainda não implementados respondem 501', ...);
```

- [ ] **Step 2: Rodar** — `npx vitest run src/api/real.test.ts src/mocks` → FAIL.

- [ ] **Step 3: Implementar**

Separe os auxiliares do closure de `createMockApi` em `MockContext`. A validação do banco salvo passa a exigir também os arrays novos. `realApi` monta cada corpo literal, como `{ name: input.name, surface: input.surface, covered: input.covered }`. Para `updateCourt`, inclua só as chaves presentes entre `name`, `surface` e `covered`. Em `setup.ts`, faça `vi.mock('../api/client', ...)` com `getApi` devolvendo a instância atual de `src/test/api.ts`, criada com `delayMs: 0` e sem `storage`.

- [ ] **Step 4: Rodar** — `npm test` e `npm run build` → PASS.

- [ ] **Step 5: Commit** — `feat: contrato da API de quadras, reservas e fila`

---

### Task 4: Quadras — cadastro pelo administrador (US-A1)

**Files:**
- Create: `src/mocks/courts.ts`, `src/pages/CourtsPage.tsx`, `src/components/CourtForm.tsx`, `src/components/CourtCard.tsx`, `src/styles/booking.css`
- Modify: `src/mocks/api.ts` (espalhar `courtHandlers(ctx)`), `src/App.tsx` (rota `courts` e título "Quadras"), `src/components/AppLayout.tsx` (link "Quadras" se `access.status === 'allowed'`)
- Test: `src/mocks/courts.test.ts`, `src/pages/CourtsPage.test.tsx`

**Interfaces:**
- Consumes: `useLoad`, `errorMessage`, `isExpired`, `MockContext`, `listCourts`, `createCourt`, `updateCourt`, `MemberAccess`.
- Produces: `courtHandlers(ctx: MockContext): Pick<ApiServices, 'listCourts' | 'createCourt' | 'updateCourt'>`; `CourtsPage({ session, access, onRetry, onExpired })`; `CourtForm({ court?: Court; onSaved(court: Court): void; onCancel(): void; onExpired(): void })`; `CourtCard({ court, now?: number, children? })`; `SURFACE_LABELS: Record<Surface, string>` = Saibro, Rápida, Grama, Sintética.

Regras do mock: qualquer usuário autenticado lista as quadras; criar e editar exigem administrador (403). Só são aceitas as chaves `name`, `surface` e `covered` (outras → 422 "Este campo não pode ser informado."). O nome, sem espaços nas pontas, tem de 1 a 60 caracteres e é único sem diferenciar maiúsculas (409 com `fieldErrors.name`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('mock: jogador comum recebe 403 ao criar quadra', ...);
it('mock: nome duplicado ignora maiúsculas → 409 em name', ...);
it('mock: campo extra → 422', () => /* createCourt(admin, { ...valid, id: 99 }) */);
it('admin cadastra quadra e ela aparece na lista', async () => {
  // render CourtsPage como admin → "Nova quadra" → Nome "Quadra Central", Piso "Saibro", Coberta → "Salvar quadra"
  expect(await screen.findByRole('heading', { name: 'Quadra Central' })).toBeInTheDocument();
  expect(screen.getByText('Saibro')).toBeInTheDocument();
});
it('nome vazio mostra erro no campo e foca nele', () => /* "Informe o nome da quadra." + toHaveFocus */);
it('admin edita o nome da quadra', ...);   // "Editar" em Quadra 1 → "Quadra 1 Coberta" → heading atualizado
it('nome duplicado mostra o erro do servidor no campo', ...);
it('jogador comum vê o painel "Acesso restrito" e nenhum botão de cadastro', ...);
it('nome com HTML aparece como texto', async () => {
  // fixture com name '<img src=x onerror=alert(1)>'
  expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
});
it('botão Salvar não envia duas vezes em clique duplo', ...); // user.dblClick → listCourts devolve 4, não 5
```

- [ ] **Step 2: Rodar** — FAIL.
- [ ] **Step 3: Implementar.** A página segue `MembersPage` para os estados checking, denied e error. O formulário usa `<select>` para o piso, `<input type="checkbox">` para a cobertura e `maxLength={60}` no nome. Os cards ficam em grade de 2 colunas, como `.quick-access-grid`, com selo `.badge--active` "Disponível". Coloque em `booking.css` o que for novo e importe esse arquivo em `App.tsx`.
- [ ] **Step 4: Rodar** — `npm test`, `npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat: cadastro de quadras (US-A1)`

---

### Task 5: Manutenção de quadra (US-A2)

**Files:**
- Modify: `src/mocks/courts.ts`, `src/components/CourtCard.tsx`
- Create: `src/components/MaintenanceForm.tsx`
- Test: `src/mocks/courts.test.ts`, `src/pages/CourtsPage.test.tsx`

**Interfaces:**
- Consumes: `fromClubLocal`, `formatClubDateTime`, `addMaintenance`, `removeMaintenance`.
- Produces: `courtHandlers` passa a incluir `addMaintenance` e `removeMaintenance`. `MaintenanceForm({ court: Court; onSaved(court: Court): void; onCancel(): void; onExpired(): void })`. `CourtCard` mostra "Em manutenção até {formatClubDateTime(ends_at)}" quando há janela cobrindo `now`, e lista as janelas futuras com o botão "Remover".

Regras do mock: só administrador. `ends_at > starts_at`, senão 422 em `ends_at`. `reason` com 1–200 caracteres. Se houver reservas ativas que se sobrepõem e `cancel_bookings !== true` → 409 com a mensagem "Há {n} reserva(s) nesse período." e `fieldErrors.cancel_bookings`. Com `true`, essas reservas são canceladas e as entradas de fila desses horários são removidas.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('fim antes do início → erro no campo Fim', ...);              // "O fim precisa ser depois do início."
it('período com reservas mostra o aviso e pede confirmação', async () => {
  // fixture: reserva ativa na Quadra 1 amanhã 19:00 → janela amanhã 18:00–21:00
  expect(await screen.findByRole('alert')).toHaveTextContent('Há 1 reserva(s) nesse período.');
  // marcar "Cancelar as reservas afetadas" → salvar → card mostra a janela; listBookings do Bruno não tem mais a reserva como 'active'
});
it('janela cobrindo agora mostra "Em manutenção até"', ...);
it('remover janela volta o status para Disponível', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar** com `<input type="datetime-local">`, convertendo com `fromClubLocal`. **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: manutenção de quadras (US-A2)`

---

### Task 6: Agenda das quadras (US-J1)

**Files:**
- Create: `src/mocks/schedule.ts`, `src/pages/SchedulePage.tsx`, `src/components/ScheduleGrid.tsx`, `src/components/DayStrip.tsx`
- Modify: `src/mocks/api.ts`, `src/App.tsx` (rota `schedule`, título "Agenda"), `src/components/AppLayout.tsx` (link "Agenda"), `src/pages/HomePage.tsx` (card de acesso rápido "Agenda"), `src/styles/booking.css`
- Test: `src/mocks/schedule.test.ts`, `src/pages/SchedulePage.test.tsx`

**Interfaces:**
- Consumes: `getSchedule`, `nextClubDays`, `dayParts`, `clubTime`, `useLoad`.
- Produces: `scheduleHandlers(ctx): Pick<ApiServices, 'getSchedule'>` e o auxiliar `slotState(ctx, courtId, startsAt, viewerId): Slot`, reutilizado nas Tasks 7, 11, 12 e 13. Também `ScheduleGrid({ schedule: Schedule; selected: SlotRef | null; onSelect(slot: Slot): void; activeCourtId: number; onCourtChange(id: number): void })`, `DayStrip({ days: string[]; value: string; onChange(date: string): void })` e `SchedulePage({ session, onExpired, rescheduleId?: number | null })`. A página guarda o slot selecionado e renderiza um `<aside className="side-panel">` cujo conteúdo as próximas tasks preenchem.

Regras do mock: `date` precisa casar com `/^\d{4}-\d{2}-\d{2}$/` e estar entre hoje e +6 dias do clube, senão 422. Os horários vão de 07:00 a 21:00 (início), 1 h cada, com `CLUB_UTC_OFFSET`. Prioridade de status: `maintenance` > `mine` (o usuário organiza ou participa) > `booked` (reserva ativa ou oferta pendente) > `free`.

Visual: as células são `<button>` com `aria-label="Quadra 2, 18:00, livre"`. Classes `.slot--free` (borda tracejada `--border`), `.slot--booked` (fundo `--court`), `.slot--mine` (fundo `--ball`) e `.slot--maintenance` (listras, `aria-disabled="true"`). A legenda fica abaixo da grade. Abaixo de 720px, só a coluna de `activeCourtId` aparece, e as abas de quadra (`role="tablist"`) aparecem.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('mock: data fora da janela → 422', ...);           // ontem e hoje+7
it('mock: manutenção vence reserva no status', ...);
it('mostra os quatro estados com rótulos acessíveis', async () => {
  // player, hoje → Quadra 3 17:00 "manutenção"; amanhã → Quadra 1 19:00 "sua reserva"
  expect(await screen.findByRole('button', { name: 'Quadra 3, 17:00, em manutenção' })).toHaveAttribute('aria-disabled', 'true');
});
it('trocar o dia recarrega a grade', ...);
it('a faixa de dias começa no hoje do clube', ...);   // now = 2026-11-10T01:00Z → primeiro botão "DOM 9"
it('sem quadras mostra o convite vazio', ...);         // "Nenhuma quadra cadastrada ainda."
it('erro de carga mostra alerta e "Tentar novamente"', ...);  // scenario 'error'
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: agenda das quadras (US-J1)`

---

### Task 7: Reservar e impedir reserva duplicada (US-J2, US-S1)

**Files:**
- Create: `src/mocks/bookings.ts`, `src/components/BookingPanel.tsx`, `src/components/PlayerPicker.tsx`
- Modify: `src/mocks/api.ts`, `src/pages/SchedulePage.tsx`, `.env.example` (cenário `conflict` no comentário)
- Test: `src/mocks/bookings.test.ts`, `src/pages/SchedulePage.test.tsx`

**Interfaces:**
- Consumes: `slotState`, `createBooking`, `searchPlayers`, `bookingPath`.
- Produces: `bookingHandlers(ctx)` com `searchPlayers` e `createBooking`, e `toBooking(ctx, mock, viewerId): Booking` (reutilizado depois). Também `BookingPanel({ slot: Slot; courtName: string; session; onBooked(b: Booking): void; onConflict(): void; onExpired })` e `PlayerPicker({ value: Player[]; onChange(p: Player[]): void; max: 3; session; onExpired })`.

Regras do mock:
- `searchPlayers`: `q` com 2–60 caracteres (422 fora disso), busca no nome sem diferenciar maiúsculas, exclui quem busca, devolve até 10 resultados só com `{ id, name }`.
- `createBooking`: aceita só as chaves `court_id`, `starts_at` e `participant_ids`. A quadra precisa existir (422). O horário precisa ser válido e estar dentro da janela da agenda (422). Manutenção → 409 "Essa quadra está em manutenção nesse horário.". Horário com status diferente de `free` → 409 "Esse horário acabou de ser reservado por outra pessoa.". `participant_ids` deve ter até 3 ids únicos, de contas existentes, sem o próprio usuário (422). O organizador entra como `confirmed`. O cenário `conflict` sempre devolve 409.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('mock: segunda reserva no mesmo horário → 409', async () => {
  await api.createBooking(player.token, slot); await expect(api.createBooking(mariana.token, slot)).rejects.toMatchObject({ status: 409 });
});
it('mock: searchPlayers não devolve e-mail', async () => expect(Object.keys((await api.searchPlayers(player.token, 'ma'))[0])).toEqual(['id', 'name']));
it('reservar horário livre marca "Sua reserva" e mostra link para a reserva', async () => {
  // clicar "Quadra 2, 18:00, livre" → painel "Confirmar reserva" → convidar "Mariana" → "Reservar quadra"
  expect(await screen.findByRole('status')).toHaveTextContent('Reserva confirmada');
  expect(screen.getByRole('link', { name: 'Ver reserva' })).toHaveAttribute('href', expect.stringMatching(/^#\/reservas\/\d+$/));
  expect(screen.getByRole('button', { name: 'Quadra 2, 18:00, sua reserva' })).toBeInTheDocument();
});
it('conflito mostra alerta e recarrega a agenda', async () => {
  // reservar a mesma célula pelo api como mariana antes de clicar em "Reservar quadra"
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
  expect(screen.getByRole('button', { name: 'Quadra 2, 18:00, ocupado' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reservar quadra' })).toBeEnabled();
});
it('clique duplo cria uma reserva só', ...);
it('não deixa convidar o quarto jogador', ...);   // campo de busca some e aparece "Até 3 convidados."
it('sessão expirada ao reservar chama onExpired', ...); // scenario 'expired' após carregar
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** O `PlayerPicker` faz a busca com espera de 300 ms após a digitação e mostra os resultados em lista de botões. Os chips selecionados ficam com `aria-label="Remover Mariana Silva"`. No 409, o painel mantém o alerta e chama `onConflict()`, que recarrega a agenda. O botão "Entrar na fila de espera" ao lado desse alerta entra na Task 12. **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: reserva de quadra com bloqueio de conflito (US-J2, US-S1)`

---

### Task 8: Minhas reservas — futuras e anteriores (US-J3)

**Files:**
- Create: `src/pages/BookingsPage.tsx`, `src/components/BookingCard.tsx`, `src/components/Tabs.tsx`
- Modify: `src/mocks/bookings.ts`, `src/App.tsx` (rota `bookings`, título "Minhas reservas"), `src/components/AppLayout.tsx` (link; `aria-current` também em `booking`), `src/pages/HomePage.tsx` (card "Minhas reservas")
- Test: `src/mocks/bookings.test.ts`, `src/pages/BookingsPage.test.tsx`

**Interfaces:**
- Consumes: `listBookings`, `getBooking`, `toBooking`, `dayParts`, `clubTime`, `bookingPath`.
- Produces: `bookingHandlers` passa a incluir `listBookings` e `getBooking`. `BookingCard({ booking: Booking; children?: ReactNode })`: data em destaque, "Quadra 1 · 19:00–20:00", selo de papel ("Organizador" ou "Convidado por {organizer.name}") e "{n} de {total} confirmaram". O card inteiro não é link; o título é um link para `bookingPath(id)`. `Tabs({ tabs: { id: string; label: string }[]; value; onChange })` segue o padrão WAI-ARIA, com setas para navegar. `BookingsPage({ session, onExpired })`.

Regras do mock: só aparecem reservas em que o usuário é organizador ou participante. `upcoming` traz as ativas com `ends_at > now`, em ordem crescente. `past` traz as demais, em ordem decrescente, com status `completed` para ativas que já terminaram. `getBooking` de reserva alheia ou inexistente → 404 "Reserva não encontrada.".

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('mock: getBooking de reserva alheia responde igual a inexistente', async () => {
  const a = await api.getBooking(mariana.token, brunoBookingId).catch((e) => e);
  const b = await api.getBooking(mariana.token, 999999).catch((e) => e);
  expect([a.status, a.message]).toEqual([b.status, b.message]);
});
it('Próximas lista as reservas do jogador com papel e contagem', ...);  // "Organizador", "Convidado por Camila Oliveira", "1 de 2 confirmaram"
it('Anteriores mostra "Concluída" e "Cancelada"', ...);
it('sem reservas futuras mostra o convite para a agenda', ...);         // "Nenhuma reserva marcada." + link "Ver agenda" → '#/agenda'
it('as abas respondem às setas do teclado', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: minhas reservas (US-J3)`

---

### Task 9: Detalhe da reserva e presença (US-P1, US-O1)

**Files:**
- Create: `src/pages/BookingDetailPage.tsx`, `src/components/AttendanceList.tsx`, `src/components/AttendanceActions.tsx`
- Modify: `src/mocks/bookings.ts`, `src/App.tsx` (rota `booking` com `id`, título "Reserva"), `src/pages/BookingsPage.tsx` (ações no card)
- Test: `src/mocks/bookings.test.ts`, `src/pages/BookingDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getBooking`, `respondAttendance`, `BookingCard`, `routeId`.
- Produces: `respondAttendance` no mock. `AttendanceActions({ booking; session; onChange(b: Booking): void; onExpired })` mostra "Confirmar presença" e "Não vou" só para `my_role === 'participant'`, e o estado atual ("Presença confirmada" / "Você avisou que não vai"). `AttendanceList({ participants: Participant[] })` agrupa em Confirmados, Pendentes e Não vão, com `<h3>` e contagem. `BookingDetailPage({ id: number; session; onExpired })`.

Regras do mock: só um participante que não seja o organizador responde (organizador → 403; não envolvido → 404). Só vale para reserva ativa e futura (422 "Essa reserva já começou ou foi cancelada."). `response` aceita `confirmed` ou `declined` (422).

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('convidado confirma presença e a contagem atualiza', ...);   // "Confirmar presença" → "Presença confirmada", "2 de 2 confirmaram"
it('organizador vê os grupos de presença', ...);               // headings "Confirmados (1)", "Pendentes (1)"
it('organizador não vê "Confirmar presença"', ...);
it('reserva de outra pessoa mostra "Reserva não encontrada"', ...);
it('rota #/reservas/abc mostra "Página não encontrada"', ...);  // via App com hash definido
it('mock: organizador respondendo presença → 403', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: detalhe da reserva e confirmação de presença (US-P1, US-O1)`

---

### Task 10: Cancelar reserva (US-J4)

**Files:**
- Create: `src/components/ConfirmAction.tsx`
- Modify: `src/mocks/bookings.ts`, `src/pages/BookingsPage.tsx`, `src/pages/BookingDetailPage.tsx`
- Test: `src/mocks/bookings.test.ts`, `src/pages/BookingsPage.test.tsx`

**Interfaces:**
- Consumes: `cancelBooking`.
- Produces: `cancelBooking` no mock e o gancho `releaseSlot(ctx, courtId, startsAt)`. Nesta task, `releaseSlot` não faz nada; na Task 13, ele passa a oferecer a vaga. `ConfirmAction({ title: string; description: string; confirmLabel: string; keepLabel: string; danger?: boolean; onConfirm(): Promise<void>; onKeep(): void })` é um painel no fluxo da página com `role="alertdialog"`, foco inicial no botão de manter e erro em `.alert`.

Regras do mock: só o organizador cancela (participante → 403; não envolvido → 404). Só vale para reserva ativa com `starts_at > now` (422). O status vira `cancelled` e `releaseSlot` é chamado.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('cancelar pede confirmação e "Manter reserva" não altera nada', ...);
it('confirmar move a reserva para Anteriores como Cancelada', ...);
// texto exato: "Os participantes serão avisados e a vaga vai para a fila de espera."
it('convidado não vê Cancelar e o mock responde 403 se tentar', ...);
it('mock: cancelar reserva que já começou → 422', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** O botão de confirmar usa `.button` com variante de perigo (`--error`, nova classe `.button--danger` em `booking.css`). **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: cancelamento de reserva (US-J4)`

---

### Task 11: Remarcar reserva (US-J5)

**Files:**
- Create: `src/components/RescheduleBanner.tsx`, `src/components/ReschedulePanel.tsx`
- Modify: `src/mocks/bookings.ts`, `src/pages/SchedulePage.tsx`, `src/App.tsx` (rota `reschedule` com `id`, título "Remarcar"), `src/pages/BookingsPage.tsx` e `src/pages/BookingDetailPage.tsx` (link "Remarcar" → `reschedulePath(id)`)
- Test: `src/mocks/bookings.test.ts`, `src/pages/SchedulePage.test.tsx`

**Interfaces:**
- Consumes: `rescheduleBooking`, `getBooking`, `releaseSlot`, `formatClubDateTime`.
- Produces: `rescheduleBooking` no mock. `RescheduleBanner({ booking })` mostra "Escolha o novo horário para {quadra} · {data e hora}" e o link "Cancelar remarcação" → `bookingPath(id)`. `ReschedulePanel({ booking; slot: Slot; courtName; session; onDone(b: Booking): void; onConflict(); onExpired })` mostra **De** e **Para** e o botão "Confirmar novo horário". Com `rescheduleId`, `SchedulePage` carrega a reserva (404 → "Reserva não encontrada"). Ao clicar em um horário livre, o painel abre no lugar do `BookingPanel`. Clicar no próprio horário atual não abre nada.

Regras do mock: só o organizador remarca, só reserva ativa e futura, e as mesmas validações e 409 de `createBooking` valem para o novo horário. Os convidados voltam a `pending`. O horário antigo passa por `releaseSlot`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('modo remarcar mostra a faixa com o horário original', ...);
it('escolher horário livre mostra De → Para e salvar leva ao detalhe', ...); // location.hash === bookingPath(id) e novo horário visível
it('conflito ao remarcar mostra alerta e mantém a reserva original', ...);
it('mock: remarcar volta convidados para pendente', ...);
it('mock: convidado remarcando → 403', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: remarcação de reserva (US-J5)`

---

### Task 12: Fila de espera — entrar e sair (US-J6)

**Files:**
- Create: `src/mocks/waitlist.ts`, `src/components/WaitlistPanel.tsx`, `src/components/WaitlistList.tsx`
- Modify: `src/mocks/api.ts`, `src/pages/SchedulePage.tsx` (painel para slot `booked`), `src/components/BookingPanel.tsx` (botão "Entrar na fila de espera" junto do alerta de 409), `src/pages/BookingsPage.tsx` (aba "Fila de espera ({n})")
- Test: `src/mocks/waitlist.test.ts`, `src/pages/SchedulePage.test.tsx`, `src/pages/BookingsPage.test.tsx`

**Interfaces:**
- Consumes: `slotState`, `joinWaitlist`, `leaveWaitlist`, `listWaitlist`.
- Produces: `waitlistHandlers(ctx)` com `listWaitlist`, `joinWaitlist` e `leaveWaitlist`, mais o auxiliar `queueFor(ctx, courtId, startsAt): MockWaitlistEntry[]`, em ordem de `created_at`. `WaitlistPanel({ slot; courtName; session; onChange(); onExpired })`: sem entrada, mostra "Você seria o {waitlist_size + 1}º da fila" e "Entrar na fila"; com entrada, mostra "Você é o {position}º da fila" e "Sair da fila". `WaitlistList({ entries; session; onChange; onExpired })` lista as entradas na aba.

Regras do mock: só dá para entrar na fila de um horário com status `booked` para quem pede, ou seja, não livre, não em manutenção e não uma reserva da qual a pessoa participa (422 "Esse horário não aceita fila."). Entrada duplicada → 409. Só o dono sai da fila (outro usuário → 404). `position` é calculada a partir de 1.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('horário ocupado mostra a posição prevista e entra na fila', ...);    // "Você seria o 1º da fila" → "Você é o 1º da fila"
it('sair da fila volta ao estado inicial', ...);
it('aba Fila de espera lista quadra, horário e posição', ...);
it('após conflito, "Entrar na fila de espera" coloca o jogador na fila', ...);
it('mock: entrar na fila de horário livre → 422', ...);
it('mock: outro usuário removendo a entrada → 404', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: fila de espera (US-J6)`

---

### Task 13: Oferta automática da vaga liberada (US-S2)

**Files:**
- Create: `src/components/OfferBanner.tsx`, `src/hooks/useWaitlistOffers.ts`
- Modify: `src/mocks/waitlist.ts`, `src/mocks/bookings.ts` (`releaseSlot` de verdade), `src/mocks/api.ts` (chamar `advanceOffers(ctx)` no início de todo handler autenticado), `src/pages/HomePage.tsx`, `src/pages/BookingsPage.tsx`
- Test: `src/mocks/waitlist.test.ts`, `src/components/OfferBanner.test.tsx`

**Interfaces:**
- Consumes: `queueFor`, `acceptOffer`, `declineOffer`, `listWaitlist`, `toBooking`.
- Produces: `advanceOffers(ctx: MockContext): void` e `OFFER_MINUTES = 30` (mock). `releaseSlot` dá ao primeiro da fila sem oferta `offer_expires_at = now + 30 min`. `advanceOffers` remove ofertas vencidas e oferece ao próximo. `acceptOffer` (só o dono; oferta ativa, senão 409 "Essa oferta expirou.") cria a reserva com o dono como organizador e remove a entrada. `declineOffer` remove a entrada e oferece ao próximo. `useWaitlistOffers(session, onExpired): { offers: WaitlistEntry[]; reload(): void }` recarrega ao montar e quando a aba volta a ficar visível (`visibilitychange`). `OfferBanner({ entry; session; onDone(); onExpired })` mostra "Vaga liberada para você", "{quadra} · {data e hora}. Responda até {clubTime(expires_at)}." e os botões "Recusar" e "Aceitar vaga".

- [ ] **Step 1: Escrever os testes que falham (com `now` controlado)**

```ts
it('mock: cancelar oferece a vaga ao primeiro da fila por 30 min', async () => {
  // Mariana na fila do horário do Bruno → Bruno cancela às 14:00 → listWaitlist(mariana)[0].offer.expires_at = 14:30
});
it('mock: horário com oferta pendente aparece "booked" para os outros', ...);   // ninguém fura a fila
it('mock: oferta vencida passa para o próximo', ...);                         // avança now 31 min → Pedro recebe; Mariana sai
it('mock: aceitar oferta vencida → 409', ...);
it('faixa aparece no Início e "Aceitar vaga" cria a reserva', ...);           // depois aparece em Próximas
it('"Recusar" esconde a faixa e passa a vaga adiante', ...);
```

- [ ] **Step 2: Rodar** — FAIL. **Step 3: Implementar.** A faixa usa fundo `--ball`, texto `--ink` e `role="region"` com `aria-label="Vaga liberada"`. **Step 4: Rodar** — PASS e build. **Step 5: Commit** — `feat: oferta automática da fila de espera (US-S2)`

---

### Task 14: Verificação final e revisão de segurança

**Files:**
- Modify: `README.md` (novas telas, contas demo Mariana, Pedro e Camila, cenário `conflict`, contrato da API para o backend e `npm test`)

- [ ] **Step 1: Varredura de sinks inseguros**

Run: `git grep -nE "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|javascript:" -- src`
Expected: nenhuma ocorrência.
Run: `git grep -nE "href=\{" -- src`
Expected: todo `href` dinâmico vem de `routePaths`, `bookingPath()` ou `reschedulePath()`.
Run: `git grep -nE "\.\.\.(input|values|form|state)\b" -- src/api/real.ts`
Expected: nenhum espalhamento em corpo de requisição.

- [ ] **Step 2: Dependências**

Run: `npm audit` → nenhuma vulnerabilidade high ou critical. Run: `npm ls --depth=0` → as devDependencies de teste continuam com versão exata e nenhuma dependência de runtime nova.

- [ ] **Step 3: Suíte e build**

Run: `npm test` → todos PASS, sem warnings de `act()`. Run: `npm run build` → OK.

- [ ] **Step 4: Conferência manual no navegador** (`npm run dev` com o mock)

Percorra como admin: criar quadra → marcar manutenção sobre reserva. Depois como usuario@: agenda → reservar → conflito (`VITE_MOCK_SCENARIO=conflict`) → confirmar presença como Mariana → remarcar → cancelar com Mariana na fila → ver a oferta como Mariana. Repita em 375 px de largura.

- [ ] **Step 5: Revisão**

Use superpowers:requesting-code-review sobre a branch inteira. Peça foco nos itens de **Review Focus** e na checklist de API do OWASP (API1 BOLA, API3 mass assignment, 401/403 tratados em toda chamada).

- [ ] **Step 6: Commit** — `docs: README das telas de reservas`

---

## Contrato para o backend (resumo)

O backend ainda precisa implementar os endpoints da tabela da Task 3, com o envelope `{ data }`, erros `{ message, errors }` e os status usados acima (401, 403, 404, 409, 422 e 429). O mock em `src/mocks/` é a referência executável das regras. Toda autorização (admin, organizador, participante) precisa ser checada no servidor. O frontend só esconde botões.
