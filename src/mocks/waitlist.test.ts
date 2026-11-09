import { describe, expect, it } from 'vitest';
import { setupTestApi } from '../test/api';
import { queueFor } from './waitlist';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');
const now = () => NOW;
const taken = { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' }; // reserva do Bruno, 19:00

describe('waitlistHandlers', () => {
  it('entra na fila de horário ocupado com posição 1 e lista a entrada', async () => {
    const { api, pedro } = await setupTestApi({ now });
    const entry = await api.joinWaitlist(pedro.token, taken);
    expect(entry).toMatchObject({
      court: { id: 1, name: 'Quadra 1' }, starts_at: '2026-11-10T22:00:00.000Z',
      ends_at: '2026-11-10T23:00:00.000Z', position: 1, offer: null,
    });
    await expect(api.listWaitlist(pedro.token)).resolves.toEqual([entry]);
  });

  it('a posição segue a ordem de chegada', async () => {
    const { api, pedro, admin, ctx } = await setupTestApi({ now });
    await api.joinWaitlist(admin.token, taken);
    const second = await api.joinWaitlist(pedro.token, taken);
    expect(second.position).toBe(2);
    expect(queueFor(ctx, 1, taken.starts_at).map((item) => item.user_id)).toEqual([1, 4]);
  });

  it('horário livre → 422', async () => {
    const { api, pedro } = await setupTestApi({ now });
    await expect(api.joinWaitlist(pedro.token, { court_id: 2, starts_at: '2026-11-10T22:00:00.000Z' }))
      .rejects.toMatchObject({ status: 422, message: 'Esse horário não aceita fila.' });
  });

  it('reserva própria, horário que já começou e manutenção → 422', async () => {
    const { api, mariana, pedro, ctx } = await setupTestApi({ now });
    await expect(api.joinWaitlist(mariana.token, taken)).rejects.toMatchObject({ status: 422 });
    ctx.db.bookings.push({
      id: 40, court_id: 2, starts_at: '2026-11-09T14:00:00.000Z', ends_at: '2026-11-09T15:00:00.000Z',
      status: 'active', organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    await expect(api.joinWaitlist(pedro.token, { court_id: 2, starts_at: '2026-11-09T14:00:00.000Z' }))
      .rejects.toMatchObject({ status: 422, message: 'Esse horário não aceita fila.' });
    const maintenance = ctx.db.courts.find((item) => item.maintenance.length > 0)!;
    await expect(api.joinWaitlist(pedro.token, { court_id: maintenance.id, starts_at: maintenance.maintenance[0].starts_at }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('chaves extras → 422; entrada duplicada → 409', async () => {
    const { api, pedro } = await setupTestApi({ now });
    await expect(api.joinWaitlist(pedro.token, { ...taken, user_id: 2 } as typeof taken)).rejects.toMatchObject({ status: 422 });
    await api.joinWaitlist(pedro.token, taken);
    await expect(api.joinWaitlist(pedro.token, taken))
      .rejects.toMatchObject({ status: 409, message: 'Você já está na fila desse horário.' });
  });

  it('só o dono sai da fila; outro usuário, inexistente e inválido → 404', async () => {
    const { api, pedro, mariana, ctx } = await setupTestApi({ now });
    const entry = await api.joinWaitlist(pedro.token, taken);
    for (const id of [entry.id, 9999, Number.NaN]) {
      await expect(api.leaveWaitlist(mariana.token, id)).rejects.toMatchObject({ status: 404, message: 'Entrada não encontrada.' });
    }
    expect(ctx.db.waitlist).toHaveLength(1);
    await api.leaveWaitlist(pedro.token, entry.id);
    expect(ctx.db.waitlist).toHaveLength(0);
    await expect(api.listWaitlist(pedro.token)).resolves.toEqual([]);
  });

  it('listWaitlist mostra a oferta vigente e esconde horários que já começaram', async () => {
    const { api, pedro, ctx } = await setupTestApi({ now });
    const entry = await api.joinWaitlist(pedro.token, taken);
    const stored = ctx.db.waitlist.find((item) => item.id === entry.id)!;
    stored.offer_expires_at = new Date(NOW + 60000).toISOString();
    expect((await api.listWaitlist(pedro.token))[0].offer).toEqual({ expires_at: '2026-11-09T15:01:00.000Z' });
    stored.offer_expires_at = new Date(NOW - 1).toISOString();
    expect((await api.listWaitlist(pedro.token))[0].offer).toBeNull();
    ctx.db.waitlist.push({
      id: 90, user_id: 4, court_id: 1, starts_at: new Date(NOW - 3600000).toISOString(),
      created_at: new Date(NOW).toISOString(), offer_expires_at: null,
    });
    expect(await api.listWaitlist(pedro.token)).toHaveLength(1);
  });
});
