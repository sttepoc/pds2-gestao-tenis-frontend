import { describe, expect, it } from 'vitest';
import type { ApiServices } from '../api/types';
import { createMockApi } from './api';
import { DEMO_PASSWORD, initialClubData, MOCK_DATA_KEY } from './fixtures';

function memoryStorage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries));
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

// Formato salvo pela versão anterior do simulador: sem quadras, reservas nem fila.
const v1Data = JSON.stringify({
  accounts: [{ user: { id: 1, name: 'Ana Administradora', email: 'admin@clube.example', created_at: '2026-01-01T12:00:00.000Z' }, admin: true }],
  members: [{ id: 1, name: 'Membro Antigo', email: 'antigo@clube.example', phone: null, status: 'active', created_at: '2026-01-01T12:00:00.000Z', updated_at: '2026-01-01T12:00:00.000Z' }],
  sessions: [],
  nextUserId: 3,
  nextMemberId: 2,
});

describe('createMockApi v2', () => {
  it('usa a chave de armazenamento v2', () => {
    expect(MOCK_DATA_KEY).toBe('clube-tenis.mock-data.v2');
  });

  it('ignora dados v1 salvos e usa as fixtures v2', async () => {
    const storage = memoryStorage({ 'clube-tenis.mock-data.v1': v1Data, 'clube-tenis.mock-data.v2': v1Data });
    const api = createMockApi({ delayMs: 0, storage });
    const admin = await api.login('admin@clube.example', DEMO_PASSWORD);
    const courts = await api.listCourts(admin.token);
    expect(courts.map((court) => court.name)).toEqual(['Quadra 1', 'Quadra 2', 'Quadra 3']);
    const members = await api.listMembers(admin.token);
    expect(members.data.map((member) => member.name)).toEqual(['Mariana Silva', 'Pedro Santos', 'Camila Oliveira']);
  });

  it('recarrega os dados v2 salvos na aba', async () => {
    const storage = memoryStorage();
    const api = createMockApi({ delayMs: 0, storage });
    const session = await api.login('usuario@clube.example', DEMO_PASSWORD);

    const reloaded = createMockApi({ delayMs: 0, storage });
    await expect(reloaded.fetchCurrentUser(session.token)).resolves.toMatchObject({ id: 2, name: 'Bruno Usuário' });
  });

  it('aceita as contas de Mariana, Pedro e Camila com a senha demo, sem acesso de administrador', async () => {
    const api = createMockApi({ delayMs: 0 });
    for (const [email, id] of [['mariana@clube.example', 3], ['pedro@clube.example', 4], ['camila@clube.example', 5]] as const) {
      const session = await api.login(email, DEMO_PASSWORD);
      expect(session.user.id).toBe(id);
      await expect(api.listMembers(session.token)).rejects.toMatchObject({ status: 403 });
    }
  });

  it('cenário members-error só afeta membros', async () => {
    const api = createMockApi({ delayMs: 0, scenario: 'members-error' });
    const admin = await api.login('admin@clube.example', DEMO_PASSWORD);
    await expect(api.fetchCurrentUser(admin.token)).resolves.toMatchObject({ id: 1 });
    await expect(api.listMembers(admin.token)).rejects.toMatchObject({ status: 500 });
  });

  it('métodos ainda não implementados respondem 501', async () => {
    const api = createMockApi({ delayMs: 0 });
    const { token } = await api.login('usuario@clube.example', DEMO_PASSWORD);
    const slot = { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' };
    const calls: ((a: ApiServices) => Promise<unknown>)[] = [
      (a) => a.searchPlayers(token, 'ma'),
      (a) => a.createBooking(token, { ...slot, participant_ids: [] }),
      (a) => a.listBookings(token, 'upcoming'),
      (a) => a.getBooking(token, 5),
      (a) => a.cancelBooking(token, 5),
      (a) => a.rescheduleBooking(token, 5, slot),
      (a) => a.respondAttendance(token, 6, 'declined'),
      (a) => a.listWaitlist(token),
      (a) => a.joinWaitlist(token, slot),
      (a) => a.leaveWaitlist(token, 1),
      (a) => a.acceptOffer(token, 1),
      (a) => a.declineOffer(token, 1),
    ];
    for (const call of calls) {
      await expect(call(api)).rejects.toMatchObject({ name: 'ApiError', status: 501, message: 'Ainda não disponível no modo simulado.' });
    }
  });
});

describe('initialClubData', () => {
  // 22:30 de 09/11 no clube, mas já 10/11 em UTC: as datas seguem o dia do clube.
  const now = Date.parse('2026-11-10T01:30:00Z');
  const data = initialClubData(now);

  it('monta as três quadras', () => {
    expect(data.courts.map(({ id, name, surface, covered }) => ({ id, name, surface, covered }))).toEqual([
      { id: 1, name: 'Quadra 1', surface: 'hard', covered: false },
      { id: 2, name: 'Quadra 2', surface: 'clay', covered: false },
      { id: 3, name: 'Quadra 3', surface: 'hard', covered: true },
    ]);
  });

  it('marca manutenção na Quadra 3 hoje das 17:00 às 19:00 do clube', () => {
    expect(data.courts[0].maintenance).toEqual([]);
    expect(data.courts[1].maintenance).toEqual([]);
    expect(data.courts[2].maintenance).toEqual([
      { id: expect.any(Number), starts_at: '2026-11-09T20:00:00.000Z', ends_at: '2026-11-09T22:00:00.000Z', reason: 'Troca da rede' },
    ]);
  });

  it('cria as reservas relativas ao hoje do clube', () => {
    expect(data.bookings.map(({ id: _id, ...booking }) => booking)).toEqual([
      { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z', ends_at: '2026-11-10T23:00:00.000Z', status: 'active', organizer_id: 2,
        participants: [{ user_id: 2, attendance: 'confirmed' }, { user_id: 3, attendance: 'pending' }] },
      { court_id: 2, starts_at: '2026-11-11T11:00:00.000Z', ends_at: '2026-11-11T12:00:00.000Z', status: 'active', organizer_id: 5,
        participants: [{ user_id: 5, attendance: 'confirmed' }, { user_id: 2, attendance: 'pending' }] },
      { court_id: 2, starts_at: '2026-11-07T13:00:00.000Z', ends_at: '2026-11-07T14:00:00.000Z', status: 'active', organizer_id: 2,
        participants: [{ user_id: 2, attendance: 'confirmed' }] },
    ]);
  });

  it('usa ids únicos e deixa nextId além deles', () => {
    const ids = [...data.courts.map((court) => court.id), ...data.courts.flatMap((court) => court.maintenance.map((item) => item.id)),
      ...data.bookings.map((booking) => booking.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(data.nextId).toBeGreaterThan(Math.max(...ids));
    expect(data.waitlist).toEqual([]);
  });
});
