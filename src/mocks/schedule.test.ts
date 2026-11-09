import { describe, expect, it } from 'vitest';
import { setupTestApi } from '../test/api';
import { slotState } from './schedule';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');
const now = () => NOW;

describe('scheduleHandlers', () => {
  it('data fora da janela → 422 (ontem e hoje+7)', async () => {
    const { api, player } = await setupTestApi({ now });
    await expect(api.getSchedule(player.token, '2026-11-08')).rejects.toMatchObject({ status: 422 });
    await expect(api.getSchedule(player.token, '2026-11-16')).rejects.toMatchObject({ status: 422 });
    await expect(api.getSchedule(player.token, '9/11/2026')).rejects.toMatchObject({ status: 422 });
    await expect(api.getSchedule(player.token, '2026-11-15')).resolves.toMatchObject({ date: '2026-11-15' });
  });

  it('sem sessão → 401', async () => {
    const { api } = await setupTestApi({ now });
    await expect(api.getSchedule('invalido', '2026-11-09')).rejects.toMatchObject({ status: 401 });
  });

  it('gera 15 horários de 07:00 a 21:00 por quadra, em UTC', async () => {
    const { api, player } = await setupTestApi({ now });
    const schedule = await api.getSchedule(player.token, '2026-11-09');
    expect(schedule.courts.map((court) => court.id)).toEqual([1, 2, 3]);
    expect(schedule.slots).toHaveLength(45);
    const first = schedule.slots.find((slot) => slot.court_id === 1)!;
    expect(first.starts_at).toBe('2026-11-09T10:00:00.000Z');
    expect(first.ends_at).toBe('2026-11-09T11:00:00.000Z');
    expect(schedule.slots.filter((slot) => slot.court_id === 1).at(-1)!.starts_at).toBe('2026-11-10T00:00:00.000Z');
  });

  it('manutenção vence reserva no status', async () => {
    const { api, player, ctx } = await setupTestApi({ now });
    const start = '2026-11-09T20:00:00.000Z'; // 17:00 em São Paulo, Quadra 3 em manutenção
    ctx.db.bookings.push({
      id: 50, court_id: 3, starts_at: start, ends_at: '2026-11-09T21:00:00.000Z', status: 'active',
      organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    const schedule = await api.getSchedule(player.token, '2026-11-09');
    expect(schedule.slots.find((slot) => slot.court_id === 3 && slot.starts_at === start)!.status).toBe('maintenance');
  });

  it('mine para organizador e convidado; booked para os demais', async () => {
    const { api, player, mariana, pedro } = await setupTestApi({ now });
    const find = (schedule: Awaited<ReturnType<typeof api.getSchedule>>) =>
      schedule.slots.find((slot) => slot.court_id === 1 && slot.starts_at === '2026-11-10T22:00:00.000Z')!;
    expect(find(await api.getSchedule(player.token, '2026-11-10'))).toMatchObject({ status: 'mine', booking_id: 5 });
    expect(find(await api.getSchedule(mariana.token, '2026-11-10'))).toMatchObject({ status: 'mine', booking_id: 5 });
    expect(find(await api.getSchedule(pedro.token, '2026-11-10'))).toMatchObject({ status: 'booked', booking_id: null });
  });

  it('reserva cancelada libera o horário; fila e oferta aparecem no estado', async () => {
    const { ctx } = await setupTestApi({ now });
    const start = '2026-11-10T22:00:00.000Z';
    ctx.db.bookings[0].status = 'cancelled';
    expect(slotState(ctx, 1, start, 4).status).toBe('free');
    ctx.db.waitlist.push(
      { id: 1, user_id: 4, court_id: 1, starts_at: start, created_at: '2026-11-09T15:00:00.000Z', offer_expires_at: null },
      { id: 2, user_id: 3, court_id: 1, starts_at: start, created_at: '2026-11-09T15:01:00.000Z', offer_expires_at: null },
    );
    expect(slotState(ctx, 1, start, 4)).toMatchObject({ waitlist_size: 2, waitlist_entry_id: 1 });
    expect(slotState(ctx, 1, start, 2)).toMatchObject({ waitlist_size: 2, waitlist_entry_id: null });
    ctx.db.waitlist[0].offer_expires_at = new Date(NOW + 60000).toISOString();
    expect(slotState(ctx, 1, start, 2).status).toBe('booked');
    ctx.db.waitlist[0].offer_expires_at = new Date(NOW - 60000).toISOString();
    expect(slotState(ctx, 1, start, 2).status).toBe('free');
  });
});
