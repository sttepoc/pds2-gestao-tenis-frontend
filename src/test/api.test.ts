import { expect, it } from 'vitest';
import { listCourts } from '../api/courts';
import { listMembers } from '../api/members';
import { acceptOffer } from '../api/waitlist';
import { setupTestApi } from './api';

it('setupTestApi entra como Ana, Bruno, Mariana e Pedro', async () => {
  const { admin, player, mariana, pedro } = await setupTestApi();
  expect([admin, player, mariana, pedro].map((session) => [session.user.id, session.user.name])).toEqual([
    [1, 'Ana Administradora'], [2, 'Bruno Usuário'], [3, 'Mariana Silva'], [4, 'Pedro Santos'],
  ]);
});

it('os wrappers de src/api chegam à api de teste', async () => {
  const { admin, player } = await setupTestApi();
  // Pela API HTTP real isto falharia (sem servidor); o simulador devolve as fixtures.
  await expect(listMembers(admin.token)).resolves.toMatchObject({ meta: { total: 3 } });
  await expect(listCourts(player.token)).resolves.toHaveLength(3);
  await expect(acceptOffer(player.token, 1)).rejects.toMatchObject({ status: 404, message: 'Entrada não encontrada.' });
});

it('o cenário vale depois do login', async () => {
  const { admin } = await setupTestApi({ scenario: 'error' });
  await expect(listMembers(admin.token)).rejects.toMatchObject({ status: 500 });
});
