import { describe, expect, it, vi } from 'vitest';
import { setupTestApi } from '../test/api';
import { OFFER_MINUTES, releaseSlot } from './bookings';
import type { MockContext } from './context';
import { advanceOffers, queueFor } from './waitlist';

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

  it('horário fora da hora cheia → 422 mesmo em cima de uma reserva', async () => {
    const { api, pedro } = await setupTestApi({ now });
    await expect(api.joinWaitlist(pedro.token, { court_id: 1, starts_at: '2026-11-10T22:00:30.000Z' }))
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

  it('listWaitlist mostra a oferta vigente; vencida e de horário que já começou saem da fila', async () => {
    const { api, pedro, ctx } = await setupTestApi({ now });
    const entry = await api.joinWaitlist(pedro.token, taken);
    const stored = ctx.db.waitlist.find((item) => item.id === entry.id)!;
    stored.offer_expires_at = new Date(NOW + 60000).toISOString();
    expect((await api.listWaitlist(pedro.token))[0].offer).toEqual({ expires_at: '2026-11-09T15:01:00.000Z' });
    ctx.db.waitlist.push({
      id: 90, user_id: 4, court_id: 1, starts_at: new Date(NOW - 3600000).toISOString(),
      created_at: new Date(NOW).toISOString(), offer_expires_at: null,
    });
    expect(await api.listWaitlist(pedro.token)).toHaveLength(1);
    expect(ctx.db.waitlist.map((item) => item.id)).toEqual([entry.id]);
    stored.offer_expires_at = new Date(NOW - 1).toISOString();
    await expect(api.listWaitlist(pedro.token)).resolves.toEqual([]);
  });
});

describe('oferta automática da vaga liberada', () => {
  const AT_14 = Date.parse('2026-11-09T14:00:00-03:00');
  const MINUTE = 60000;
  // As sessões do mock duram 1 h; aqui o relógio anda mais que isso.
  const longSessions = (ctx: MockContext) => ctx.db.sessions.forEach((item) => { item.expiresAt = '2026-11-12T00:00:00.000Z'; });

  // Pedro entra primeiro e Ana em seguida; às 14:00 Bruno cancela a reserva das 19:00 de amanhã.
  async function released() {
    let clock = NOW;
    const setup = await setupTestApi({ now: () => clock });
    const { api, pedro, admin, player } = setup;
    longSessions(setup.ctx);
    const pedroEntry = await api.joinWaitlist(pedro.token, taken);
    const anaEntry = await api.joinWaitlist(admin.token, taken);
    clock = AT_14;
    await api.cancelBooking(player.token, 5);
    return { ...setup, pedroEntry, anaEntry, advance: (minutes: number) => { clock += minutes * MINUTE; } };
  }
  const slotOf = (schedule: { slots: { court_id: number; starts_at: string; status: string }[] }) =>
    schedule.slots.find((slot) => slot.court_id === 1 && slot.starts_at === taken.starts_at)!;

  it('a oferta vale 30 minutos', () => {
    expect(OFFER_MINUTES).toBe(30);
  });

  it('cancelar oferece a vaga ao primeiro da fila por 30 min', async () => {
    const { api, pedro, admin } = await released();
    expect((await api.listWaitlist(pedro.token))[0]).toMatchObject({ position: 1, offer: { expires_at: '2026-11-09T17:30:00.000Z' } });
    expect((await api.listWaitlist(admin.token))[0]).toMatchObject({ position: 2, offer: null });
  });

  it('cancelar perto do início: a oferta vence no início do horário, não depois', async () => {
    let clock = NOW;
    const { api, pedro, player, ctx } = await setupTestApi({ now: () => clock });
    longSessions(ctx);
    await api.joinWaitlist(pedro.token, taken);
    clock = Date.parse('2026-11-10T18:45:00-03:00');
    await api.cancelBooking(player.token, 5);
    expect((await api.listWaitlist(pedro.token))[0].offer).toEqual({ expires_at: '2026-11-10T22:00:00.000Z' }); // 19:00
  });

  it('remarcar oferece o horário antigo ao primeiro da fila', async () => {
    let clock = NOW;
    const { api, pedro, player, ctx } = await setupTestApi({ now: () => clock });
    longSessions(ctx);
    await api.joinWaitlist(pedro.token, taken);
    clock = AT_14;
    await api.rescheduleBooking(player.token, 5, { court_id: 2, starts_at: '2026-11-10T22:00:00.000Z' });
    expect((await api.listWaitlist(pedro.token))[0].offer).toEqual({ expires_at: '2026-11-09T17:30:00.000Z' });
  });

  it('horário com oferta pendente aparece "booked" para os outros', async () => {
    const { api, admin, mariana, pedro } = await released();
    for (const session of [mariana, admin, pedro]) {
      expect(slotOf(await api.getSchedule(session.token, '2026-11-10')).status).toBe('booked');
    }
    await expect(api.createBooking(mariana.token, { ...taken, participant_ids: [] }))
      .rejects.toMatchObject({ status: 409, message: 'Esse horário acabou de ser reservado por outra pessoa.' });
    await expect(api.createBooking(admin.token, { ...taken, participant_ids: [] })).rejects.toMatchObject({ status: 409 });
  });

  it('oferta vencida passa para o próximo', async () => {
    const { api, pedro, admin, anaEntry, ctx, advance } = await released();
    advance(31);
    expect(await api.listWaitlist(admin.token)).toMatchObject([
      { id: anaEntry.id, position: 1, offer: { expires_at: '2026-11-09T18:01:00.000Z' } },
    ]);
    await expect(api.listWaitlist(pedro.token)).resolves.toEqual([]);
    expect(ctx.db.waitlist.map((item) => item.user_id)).toEqual([1]);
  });

  it('o último da fila deixa a oferta vencer e o horário volta a ficar livre', async () => {
    const { api, mariana, advance } = await released();
    advance(31);
    await api.listWaitlist(mariana.token);
    advance(31);
    expect(slotOf(await api.getSchedule(mariana.token, '2026-11-10')).status).toBe('free');
    await expect(api.createBooking(mariana.token, { ...taken, participant_ids: [] })).resolves.toMatchObject({ status: 'active' });
  });

  it('aceitar cria a reserva com o dono como organizador e tira a entrada; o resto da fila continua', async () => {
    const { api, pedro, admin, pedroEntry, anaEntry, ctx } = await released();
    const booking = await api.acceptOffer(pedro.token, pedroEntry.id);
    expect(booking).toMatchObject({
      court: { id: 1, name: 'Quadra 1' }, starts_at: '2026-11-10T22:00:00.000Z', ends_at: '2026-11-10T23:00:00.000Z',
      status: 'active', my_role: 'organizer', organizer: { id: 4, name: 'Pedro Santos' },
      participants: [{ id: 4, name: 'Pedro Santos', attendance: 'confirmed' }],
    });
    expect(ctx.db.waitlist.map((item) => item.id)).toEqual([anaEntry.id]);
    expect(await api.listWaitlist(admin.token)).toMatchObject([{ position: 1, offer: null }]);
    expect(slotOf(await api.getSchedule(pedro.token, '2026-11-10'))).toMatchObject({ status: 'mine', booking_id: booking.id });
    expect((await api.listBookings(pedro.token, 'upcoming')).map((item) => item.id)).toEqual([booking.id]);
  });

  it('aceitar oferta vencida → 409', async () => {
    const { api, pedro, pedroEntry, advance } = await released();
    advance(31);
    await expect(api.acceptOffer(pedro.token, pedroEntry.id)).rejects.toMatchObject({ status: 409, message: 'Essa oferta expirou.' });
  });

  it('aceitar sem oferta ou com o horário já começado → 409', async () => {
    const { api, admin, anaEntry } = await released();
    await expect(api.acceptOffer(admin.token, anaEntry.id)).rejects.toMatchObject({ status: 409, message: 'Essa oferta expirou.' });
    // Liberada às 18:45, a oferta iria até 19:15; às 19:01 o horário já começou.
    const late = await setupTestApi({ now: () => Date.parse('2026-11-10T19:01:00-03:00') });
    late.ctx.db.waitlist.push({
      id: 80, user_id: 4, court_id: 1, starts_at: taken.starts_at, created_at: new Date(NOW).toISOString(),
      offer_expires_at: '2026-11-10T22:15:00.000Z',
    });
    await expect(late.api.acceptOffer(late.pedro.token, 80)).rejects.toMatchObject({ status: 409, message: 'Essa oferta expirou.' });
    expect(late.ctx.db.waitlist).toEqual([]);
  });

  it('só o dono aceita ou recusa; outro usuário, inexistente e inválido → 404', async () => {
    const { api, mariana, pedroEntry, ctx } = await released();
    for (const id of [pedroEntry.id, 9999, Number.NaN]) {
      await expect(api.acceptOffer(mariana.token, id)).rejects.toMatchObject({ status: 404, message: 'Entrada não encontrada.' });
      await expect(api.declineOffer(mariana.token, id)).rejects.toMatchObject({ status: 404, message: 'Entrada não encontrada.' });
    }
    expect(ctx.db.waitlist).toHaveLength(2);
    expect(ctx.db.bookings.filter((item) => item.status === 'active' && item.starts_at === taken.starts_at)).toEqual([]);
  });

  it('recusar tira a entrada e oferece ao próximo', async () => {
    const { api, pedro, admin, pedroEntry, ctx } = await released();
    await api.declineOffer(pedro.token, pedroEntry.id);
    await expect(api.listWaitlist(pedro.token)).resolves.toEqual([]);
    expect((await api.listWaitlist(admin.token))[0].offer).toEqual({ expires_at: '2026-11-09T17:30:00.000Z' });
    expect(ctx.db.waitlist.map((item) => item.user_id)).toEqual([1]);
  });

  it('recusar sem oferta só tira a entrada; a oferta do primeiro continua', async () => {
    const { api, pedro, admin, anaEntry } = await released();
    await api.declineOffer(admin.token, anaEntry.id);
    await expect(api.listWaitlist(admin.token)).resolves.toEqual([]);
    expect((await api.listWaitlist(pedro.token))[0].offer).toEqual({ expires_at: '2026-11-09T17:30:00.000Z' });
  });

  it('recusar depois de vencer não falha e a vaga segue para o próximo', async () => {
    const { api, pedro, admin, pedroEntry, advance } = await released();
    advance(31);
    await expect(api.declineOffer(pedro.token, pedroEntry.id)).resolves.toBeUndefined();
    expect((await api.listWaitlist(admin.token))[0].offer).toEqual({ expires_at: '2026-11-09T18:01:00.000Z' });
  });

  it('sair da fila com oferta pendente passa a vaga adiante', async () => {
    const { api, pedro, admin, pedroEntry } = await released();
    await api.leaveWaitlist(pedro.token, pedroEntry.id);
    expect((await api.listWaitlist(admin.token))[0].offer).toEqual({ expires_at: '2026-11-09T17:30:00.000Z' });
  });

  it('advanceOffers é idempotente e só grava quando muda algo', async () => {
    const { ctx, advance } = await released();
    const persist = vi.spyOn(ctx, 'persist');
    advanceOffers(ctx);
    expect(persist).not.toHaveBeenCalled();
    advance(31);
    advanceOffers(ctx);
    const after = JSON.stringify(ctx.db.waitlist);
    expect(persist).toHaveBeenCalled();
    persist.mockClear();
    advanceOffers(ctx);
    expect(JSON.stringify(ctx.db.waitlist)).toBe(after);
    expect(persist).not.toHaveBeenCalled();
  });

  it('releaseSlot não oferece horário ocupado, já começado ou com oferta pendente', async () => {
    let clock = NOW;
    const { api, pedro, admin, ctx } = await setupTestApi({ now: () => clock });
    await api.joinWaitlist(pedro.token, taken);
    await api.joinWaitlist(admin.token, taken);
    releaseSlot(ctx, 1, taken.starts_at); // reserva do Bruno ainda ativa
    expect(ctx.db.waitlist.every((item) => item.offer_expires_at === null)).toBe(true);
    ctx.db.bookings.find((item) => item.id === 5)!.status = 'cancelled';
    releaseSlot(ctx, 1, taken.starts_at);
    releaseSlot(ctx, 1, taken.starts_at);
    expect(ctx.db.waitlist.map((item) => item.offer_expires_at)).toEqual(['2026-11-09T15:30:00.000Z', null]);
    ctx.db.waitlist[0].offer_expires_at = null;
    clock = Date.parse('2026-11-10T19:00:00-03:00');
    releaseSlot(ctx, 1, taken.starts_at);
    expect(ctx.db.waitlist.every((item) => item.offer_expires_at === null)).toBe(true);
  });
});
