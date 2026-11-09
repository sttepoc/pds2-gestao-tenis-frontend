import { describe, expect, it } from 'vitest';
import { setupTestApi } from '../test/api';

const NOW = Date.parse('2026-11-09T10:00:00-03:00');
const now = () => NOW;
const slot = { court_id: 2, starts_at: '2026-11-09T21:00:00.000Z', participant_ids: [] as number[] }; // 18:00 em São Paulo

describe('bookingHandlers', () => {
  it('segunda reserva no mesmo horário → 409', async () => {
    const { api, player, mariana } = await setupTestApi({ now });
    await api.createBooking(player.token, slot);
    await expect(api.createBooking(mariana.token, slot)).rejects.toMatchObject({ status: 409 });
  });

  it('cria a reserva com o organizador confirmado e convidados pendentes', async () => {
    const { api, player, mariana } = await setupTestApi({ now });
    const booking = await api.createBooking(player.token, { ...slot, participant_ids: [mariana.user.id] });
    expect(booking).toMatchObject({
      court: { id: 2, name: 'Quadra 2' }, organizer: { id: 2, name: 'Bruno Usuário' }, status: 'active', my_role: 'organizer',
      starts_at: '2026-11-09T21:00:00.000Z', ends_at: '2026-11-09T22:00:00.000Z',
      participants: [
        { id: 2, name: 'Bruno Usuário', attendance: 'confirmed' },
        { id: 3, name: 'Mariana Silva', attendance: 'pending' },
      ],
    });
  });

  it('searchPlayers não devolve e-mail', async () => {
    const { api, player } = await setupTestApi({ now });
    const found = await api.searchPlayers(player.token, 'ma');
    expect(Object.keys(found[0])).toEqual(['id', 'name']);
    expect(found.map((item) => item.name)).toEqual(['Mariana Silva']);
  });

  it('searchPlayers exclui quem busca e valida o tamanho', async () => {
    const { api, player } = await setupTestApi({ now });
    expect((await api.searchPlayers(player.token, 'BRUNO'))).toEqual([]);
    await expect(api.searchPlayers(player.token, 'a')).rejects.toMatchObject({ status: 422 });
    await expect(api.searchPlayers(player.token, 'a'.repeat(61))).rejects.toMatchObject({ status: 422 });
  });

  it('rejeita chaves extras, quadra inexistente e horário fora da janela ou passado', async () => {
    const { api, player } = await setupTestApi({ now });
    await expect(api.createBooking(player.token, { ...slot, extra: 1 } as never)).rejects.toMatchObject({ status: 422 });
    await expect(api.createBooking(player.token, { ...slot, court_id: 99 })).rejects.toMatchObject({ status: 422 });
    await expect(api.createBooking(player.token, { ...slot, starts_at: 'ontem' })).rejects.toMatchObject({ status: 422 });
    await expect(api.createBooking(player.token, { ...slot, starts_at: '2026-11-16T21:00:00.000Z' })).rejects.toMatchObject({ status: 422 });
    await expect(api.createBooking(player.token, { ...slot, starts_at: '2026-11-09T21:30:00.000Z' })).rejects.toMatchObject({ status: 422 });
    await expect(api.createBooking(player.token, { ...slot, starts_at: '2026-11-09T12:00:00.000Z' }))
      .rejects.toMatchObject({ status: 422, message: 'Esse horário já passou.' });
  });

  it('manutenção → 409 com mensagem própria', async () => {
    const { api, player } = await setupTestApi({ now });
    await expect(api.createBooking(player.token, { court_id: 3, starts_at: '2026-11-09T20:00:00.000Z', participant_ids: [] }))
      .rejects.toMatchObject({ status: 409, message: 'Essa quadra está em manutenção nesse horário.' });
  });

  it('valida convidados: até 3, únicos, existentes e sem o próprio usuário', async () => {
    const { api, player } = await setupTestApi({ now });
    for (const participant_ids of [[3, 4, 5, 1], [3, 3], [99], [2]]) {
      await expect(api.createBooking(player.token, { ...slot, participant_ids })).rejects.toMatchObject({ status: 422 });
    }
    await expect(api.createBooking(player.token, { ...slot, participant_ids: [3, 4, 5] })).resolves.toMatchObject({ id: 8 });
  });

  it('cenário conflict sempre devolve 409', async () => {
    const { api, player } = await setupTestApi({ now, scenario: 'conflict' });
    await expect(api.createBooking(player.token, slot))
      .rejects.toMatchObject({ status: 409, message: 'Esse horário acabou de ser reservado por outra pessoa.' });
  });
  it('searchPlayers devolve no máximo 10 resultados', async () => {
    const { api, player, ctx } = await setupTestApi({ now });
    for (let n = 1; n <= 12; n++) {
      ctx.db.accounts.push({ user: { id: 100 + n, name: `Jogador ${n}`, email: `j${n}@clube.example`, created_at: '2026-01-01T12:00:00.000Z' }, admin: false });
    }
    expect(await api.searchPlayers(player.token, 'jogador')).toHaveLength(10);
  });

  it('getBooking de reserva alheia responde igual a inexistente ou inválida', async () => {
    const { api, mariana, pedro } = await setupTestApi({ now });
    const a = await api.getBooking(pedro.token, 5).catch((e) => e);
    const b = await api.getBooking(pedro.token, 999999).catch((e) => e);
    const c = await api.getBooking(pedro.token, 'x' as never).catch((e) => e);
    expect([a.status, a.message]).toEqual([404, 'Reserva não encontrada.']);
    expect([b.status, b.message]).toEqual([a.status, a.message]);
    expect([c.status, c.message]).toEqual([a.status, a.message]);
    await expect(api.getBooking(mariana.token, 5)).resolves.toMatchObject({ id: 5, my_role: 'participant' });
  });

  it('listBookings: próximas em ordem crescente, anteriores em ordem decrescente com status calculado', async () => {
    const { api, player, ctx } = await setupTestApi({ now });
    ctx.db.bookings.push({
      id: 20, court_id: 1, starts_at: '2026-11-05T13:00:00.000Z', ends_at: '2026-11-05T14:00:00.000Z',
      status: 'cancelled', organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    ctx.db.bookings.push({
      id: 21, court_id: 1, starts_at: '2026-11-09T10:30:00.000Z', ends_at: '2026-11-09T11:30:00.000Z',
      status: 'active', organizer_id: 4, participants: [{ user_id: 4, attendance: 'confirmed' }],
    });
    const upcoming = await api.listBookings(player.token, 'upcoming');
    expect(upcoming.map((item) => item.id)).toEqual([5, 6]);
    const past = await api.listBookings(player.token, 'past');
    expect(past.map((item) => [item.id, item.status])).toEqual([[7, 'completed'], [20, 'cancelled']]);
    expect(past.map((item) => item.id)).not.toContain(21);
  });

  it('listBookings valida o escopo', async () => {
    const { api, player } = await setupTestApi({ now });
    await expect(api.listBookings(player.token, 'x' as never)).rejects.toMatchObject({ status: 422 });
  });

  it('respondAttendance: convidado confirma e recusa', async () => {
    const { api, mariana, player } = await setupTestApi({ now });
    const confirmed = await api.respondAttendance(mariana.token, 5, 'confirmed');
    expect(confirmed.my_role).toBe('participant');
    expect(confirmed.participants.map((item) => item.attendance)).toEqual(['confirmed', 'confirmed']);
    const declined = await api.respondAttendance(mariana.token, 5, 'declined');
    expect(declined.participants[1].attendance).toBe('declined');
    expect((await api.getBooking(player.token, 5)).participants[1].attendance).toBe('declined');
  });

  it('respondAttendance: organizador → 403; não envolvido ou inexistente → 404', async () => {
    const { api, player, pedro } = await setupTestApi({ now });
    await expect(api.respondAttendance(player.token, 5, 'declined'))
      .rejects.toMatchObject({ status: 403, message: 'Quem organiza já está confirmado.' });
    await expect(api.respondAttendance(pedro.token, 5, 'confirmed'))
      .rejects.toMatchObject({ status: 404, message: 'Reserva não encontrada.' });
    await expect(api.respondAttendance(pedro.token, 9999, 'confirmed')).rejects.toMatchObject({ status: 404 });
    await expect(api.respondAttendance(pedro.token, Number.NaN, 'confirmed')).rejects.toMatchObject({ status: 404 });
  });

  it('respondAttendance: só reserva ativa e futura; resposta válida', async () => {
    const { api, player, mariana, ctx } = await setupTestApi({ now });
    await expect(api.respondAttendance(mariana.token, 5, 'pending' as never)).rejects.toMatchObject({ status: 422 });
    await expect(api.respondAttendance(mariana.token, 5, 'x' as never)).rejects.toMatchObject({ status: 422 });
    ctx.db.bookings.find((item) => item.id === 5)!.status = 'cancelled';
    await expect(api.respondAttendance(mariana.token, 5, 'confirmed'))
      .rejects.toMatchObject({ status: 422, message: 'Essa reserva já começou ou foi cancelada.' });
    ctx.db.bookings.push({
      id: 40, court_id: 1, starts_at: '2026-11-09T12:00:00.000Z', ends_at: '2026-11-09T13:00:00.000Z',
      status: 'active', organizer_id: 3, participants: [{ user_id: 3, attendance: 'confirmed' }, { user_id: 2, attendance: 'pending' }],
    });
    await expect(api.respondAttendance(player.token, 40, 'confirmed')).rejects.toMatchObject({ status: 422 });
  });

  it('cancelBooking: organizador cancela e a reserva passa a cancelada', async () => {
    const { api, player, mariana } = await setupTestApi({ now });
    const cancelled = await api.cancelBooking(player.token, 5);
    expect(cancelled).toMatchObject({ id: 5, status: 'cancelled', my_role: 'organizer' });
    expect((await api.getBooking(mariana.token, 5)).status).toBe('cancelled');
    expect(await api.listBookings(player.token, 'upcoming')).toHaveLength(1);
  });

  it('cancelBooking: convidado → 403; não envolvido, inexistente ou inválida → 404', async () => {
    const { api, mariana, pedro } = await setupTestApi({ now });
    await expect(api.cancelBooking(mariana.token, 5))
      .rejects.toMatchObject({ status: 403, message: 'Só quem organiza pode cancelar a reserva.' });
    await expect(api.cancelBooking(pedro.token, 5))
      .rejects.toMatchObject({ status: 404, message: 'Reserva não encontrada.' });
    await expect(api.cancelBooking(pedro.token, 9999)).rejects.toMatchObject({ status: 404 });
    await expect(api.cancelBooking(pedro.token, Number.NaN)).rejects.toMatchObject({ status: 404 });
    expect((await api.getBooking(mariana.token, 5)).status).toBe('active');
  });

  it('cancelBooking: reserva que já começou ou já cancelada → 422', async () => {
    const { api, player, ctx } = await setupTestApi({ now });
    ctx.db.bookings.push({
      id: 41, court_id: 1, starts_at: '2026-11-09T12:00:00.000Z', ends_at: '2026-11-09T13:00:00.000Z',
      status: 'active', organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    await expect(api.cancelBooking(player.token, 41))
      .rejects.toMatchObject({ status: 422, message: 'Essa reserva já começou ou foi cancelada.' });
    await api.cancelBooking(player.token, 5);
    await expect(api.cancelBooking(player.token, 5)).rejects.toMatchObject({ status: 422 });
  });

  describe('rescheduleBooking', () => {
    const target = { court_id: 2, starts_at: '2026-11-10T23:00:00.000Z' }; // amanhã 20:00

    it('remarcar volta convidados para pendente e libera o horário antigo', async () => {
      const { api, player, mariana } = await setupTestApi({ now });
      await api.respondAttendance(mariana.token, 5, 'confirmed');
      const moved = await api.rescheduleBooking(player.token, 5, target);
      expect(moved).toMatchObject({
        id: 5, court: { id: 2, name: 'Quadra 2' }, starts_at: '2026-11-10T23:00:00.000Z', ends_at: '2026-11-11T00:00:00.000Z',
        participants: [
          { id: 2, attendance: 'confirmed' },
          { id: 3, attendance: 'pending' },
        ],
      });
      const schedule = await api.getSchedule(player.token, '2026-11-10');
      const old = schedule.slots.find((item) => item.court_id === 1 && item.starts_at === '2026-11-10T22:00:00.000Z');
      expect(old?.status).toBe('free');
    });

    it('convidado remarcando → 403; não envolvido ou inexistente → 404', async () => {
      const { api, mariana, pedro } = await setupTestApi({ now });
      await expect(api.rescheduleBooking(mariana.token, 5, target))
        .rejects.toMatchObject({ status: 403, message: 'Só quem organiza pode remarcar a reserva.' });
      await expect(api.rescheduleBooking(pedro.token, 5, target))
        .rejects.toMatchObject({ status: 404, message: 'Reserva não encontrada.' });
      await expect(api.rescheduleBooking(pedro.token, 9999, target)).rejects.toMatchObject({ status: 404 });
      await expect(api.rescheduleBooking(pedro.token, Number.NaN, target)).rejects.toMatchObject({ status: 404 });
    });

    it('reserva cancelada → 422; mesmo horário → 422', async () => {
      const { api, player } = await setupTestApi({ now });
      await expect(api.rescheduleBooking(player.token, 5, { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' }))
        .rejects.toMatchObject({ status: 422, message: 'Escolha um horário diferente do atual.' });
      await api.cancelBooking(player.token, 5);
      await expect(api.rescheduleBooking(player.token, 5, target))
        .rejects.toMatchObject({ status: 422, message: 'Essa reserva já começou ou foi cancelada.' });
    });

    it('novo horário ocupado, em manutenção, passado ou com chave extra', async () => {
      const { api, player, mariana } = await setupTestApi({ now });
      await api.createBooking(mariana.token, { ...target, participant_ids: [] });
      await expect(api.rescheduleBooking(player.token, 5, target)).rejects.toMatchObject({ status: 409 });
      await expect(api.rescheduleBooking(player.token, 5, { court_id: 3, starts_at: '2026-11-09T20:00:00.000Z' }))
        .rejects.toMatchObject({ status: 409, message: 'Essa quadra está em manutenção nesse horário.' });
      await expect(api.rescheduleBooking(player.token, 5, { court_id: 2, starts_at: '2026-11-09T12:00:00.000Z' }))
        .rejects.toMatchObject({ status: 422, message: 'Esse horário já passou.' });
      await expect(api.rescheduleBooking(player.token, 5, { ...target, organizer_id: 3 } as never))
        .rejects.toMatchObject({ status: 422 });
      expect((await api.getBooking(player.token, 5)).starts_at).toBe('2026-11-10T22:00:00.000Z');
    });
  });
});
