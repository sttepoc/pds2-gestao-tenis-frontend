import { describe, expect, it } from 'vitest';
import { setupTestApi } from '../test/api';

const valid = { name: 'Quadra Central', surface: 'clay', covered: true } as const;

describe('courtHandlers', () => {
  it('qualquer usuário autenticado lista as quadras', async () => {
    const { api, player } = await setupTestApi();
    const courts = await api.listCourts(player.token);
    expect(courts.map((court) => court.name)).toEqual(['Quadra 1', 'Quadra 2', 'Quadra 3']);
  });

  it('jogador comum recebe 403 ao criar quadra', async () => {
    const { api, player } = await setupTestApi();
    await expect(api.createCourt(player.token, valid)).rejects.toMatchObject({ status: 403 });
  });

  it('jogador comum recebe 403 ao editar quadra', async () => {
    const { api, player } = await setupTestApi();
    await expect(api.updateCourt(player.token, 1, { name: 'Outra' })).rejects.toMatchObject({ status: 403 });
  });

  it('nome duplicado ignora maiúsculas → 409 em name', async () => {
    const { api, admin } = await setupTestApi();
    await expect(api.createCourt(admin.token, { ...valid, name: ' quadra 1 ' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { name: [expect.any(String)] },
    });
  });

  it('campo extra → 422', async () => {
    const { api, admin } = await setupTestApi();
    const input = { ...valid, id: 99 } as unknown as typeof valid;
    await expect(api.createCourt(admin.token, input)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { id: ['Este campo não pode ser informado.'] },
    });
  });

  it('nome vazio ou com mais de 60 caracteres → 422', async () => {
    const { api, admin } = await setupTestApi();
    await expect(api.createCourt(admin.token, { ...valid, name: '   ' })).rejects.toMatchObject({ status: 422 });
    await expect(api.createCourt(admin.token, { ...valid, name: 'a'.repeat(61) })).rejects.toMatchObject({ status: 422 });
    await expect(api.createCourt(admin.token, { ...valid, name: 'a'.repeat(60) })).resolves.toMatchObject({ covered: true });
  });

  it('piso inválido → 422', async () => {
    const { api, admin } = await setupTestApi();
    const input = { ...valid, surface: 'lava' } as unknown as typeof valid;
    await expect(api.createCourt(admin.token, input)).rejects.toMatchObject({ status: 422, fieldErrors: { surface: [expect.any(String)] } });
  });

  it('cria quadra sem manutenção e ela aparece na lista', async () => {
    const { api, admin } = await setupTestApi();
    const court = await api.createCourt(admin.token, { ...valid, name: '  Quadra Central ' });
    expect(court).toMatchObject({ name: 'Quadra Central', surface: 'clay', covered: true, maintenance: [] });
    expect((await api.listCourts(admin.token)).map((item) => item.id)).toContain(court.id);
  });

  it('edita só os campos enviados; 404 para quadra inexistente; 409 em nome de outra quadra', async () => {
    const { api, admin } = await setupTestApi();
    const updated = await api.updateCourt(admin.token, 1, { name: 'quadra 1', covered: true });
    expect(updated).toMatchObject({ id: 1, name: 'quadra 1', surface: 'hard', covered: true });
    await expect(api.updateCourt(admin.token, 999, { covered: true })).rejects.toMatchObject({ status: 404 });
    await expect(api.updateCourt(admin.token, 1, { name: 'Quadra 2' })).rejects.toMatchObject({ status: 409 });
  });

  it('cenário error aplica wait()', async () => {
    const { api, admin } = await setupTestApi({ scenario: 'error' });
    await expect(api.listCourts(admin.token)).rejects.toMatchObject({ status: 500 });
  });

  describe('manutenção', () => {
    const NOW = Date.parse('2026-11-09T12:00:00-03:00');
    const window = { starts_at: '2026-11-10T18:00:00-03:00', ends_at: '2026-11-10T21:00:00-03:00', reason: 'Piso novo' };

    it('jogador comum recebe 403', async () => {
      const { api, player } = await setupTestApi({ now: () => NOW });
      await expect(api.addMaintenance(player.token, 1, window)).rejects.toMatchObject({ status: 403 });
      await expect(api.removeMaintenance(player.token, 3, 4)).rejects.toMatchObject({ status: 403 });
    });

    it('registra a janela e devolve a quadra', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      const court = await api.addMaintenance(admin.token, 2, window);
      expect(court.maintenance).toHaveLength(1);
      expect(court.maintenance[0]).toMatchObject({ reason: 'Piso novo' });
      expect(Date.parse(court.maintenance[0].starts_at)).toBe(Date.parse(window.starts_at));
    });

    it('fim igual ou antes do início → 422 em ends_at; motivo fora de 1–200 → 422 em reason', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      await expect(api.addMaintenance(admin.token, 2, { ...window, ends_at: window.starts_at })).rejects.toMatchObject({
        status: 422, fieldErrors: { ends_at: ['O fim precisa ser depois do início.'] },
      });
      await expect(api.addMaintenance(admin.token, 2, { ...window, reason: ' ' })).rejects.toMatchObject({ status: 422, fieldErrors: { reason: [expect.any(String)] } });
      await expect(api.addMaintenance(admin.token, 2, { ...window, reason: 'a'.repeat(201) })).rejects.toMatchObject({ status: 422 });
      await expect(api.addMaintenance(admin.token, 2, { ...window, reason: 'a'.repeat(200) })).resolves.toBeDefined();
    });

    it('quadra inexistente → 404', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      await expect(api.addMaintenance(admin.token, 999, window)).rejects.toMatchObject({ status: 404 });
    });

    it('reserva ativa no período → 409 sem cancelar nada', async () => {
      const { api, admin, ctx } = await setupTestApi({ now: () => NOW });
      await expect(api.addMaintenance(admin.token, 1, window)).rejects.toMatchObject({
        status: 409,
        message: 'Há 1 reserva(s) nesse período.',
        fieldErrors: { cancel_bookings: [expect.any(String)] },
      });
      expect(ctx.db.bookings.find((item) => item.id === 5)?.status).toBe('active');
    });

    it('cancel_bookings cancela as reservas e remove a fila dos horários', async () => {
      const { api, admin, ctx } = await setupTestApi({ now: () => NOW });
      const booking = ctx.db.bookings.find((item) => item.id === 5)!;
      ctx.db.waitlist.push({ id: 50, user_id: 3, court_id: 1, starts_at: booking.starts_at, created_at: booking.starts_at, offer_expires_at: null });
      ctx.db.waitlist.push({ id: 51, user_id: 3, court_id: 2, starts_at: booking.starts_at, created_at: booking.starts_at, offer_expires_at: null });
      await api.addMaintenance(admin.token, 1, { ...window, cancel_bookings: true });
      expect(ctx.db.bookings.find((item) => item.id === 5)?.status).toBe('cancelled');
      expect(ctx.db.waitlist.map((item) => item.id)).toEqual([51]);
    });

    it('reserva já cancelada ou fora do período não conta', async () => {
      const { api, admin, ctx } = await setupTestApi({ now: () => NOW });
      ctx.db.bookings.find((item) => item.id === 5)!.status = 'cancelled';
      await expect(api.addMaintenance(admin.token, 1, window)).resolves.toBeDefined();
      await expect(api.addMaintenance(admin.token, 2, window)).resolves.toBeDefined();
    });

    it('janela que só encosta na reserva (fim = início) não conflita', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      await expect(api.addMaintenance(admin.token, 1, { ...window, ends_at: '2026-11-10T19:00:00-03:00' })).resolves.toBeDefined();
    });

    it('campo extra → 422', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      const input = { ...window, id: 1 } as unknown as typeof window;
      await expect(api.addMaintenance(admin.token, 2, input)).rejects.toMatchObject({ status: 422, fieldErrors: { id: [expect.any(String)] } });
    });

    it('remove a janela; 404 para janela ou quadra inexistente', async () => {
      const { api, admin } = await setupTestApi({ now: () => NOW });
      const court = await api.removeMaintenance(admin.token, 3, 4);
      expect(court.maintenance).toEqual([]);
      await expect(api.removeMaintenance(admin.token, 3, 4)).rejects.toMatchObject({ status: 404 });
      await expect(api.removeMaintenance(admin.token, 999, 4)).rejects.toMatchObject({ status: 404 });
    });
  });
});
