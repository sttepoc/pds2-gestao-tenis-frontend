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
});
