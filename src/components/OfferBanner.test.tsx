import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../pages/HomePage';
import { BookingsPage } from '../pages/BookingsPage';
import { setupTestApi } from '../test/api';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');
const MINUTE = 60000;
const taken = { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' }; // reserva do Bruno, 19:00 de amanhã

// Pedro e depois Ana entram na fila; Bruno cancela e a vaga vai para Pedro até 12:30.
async function offered({ release = true } = {}) {
  let clock = NOW;
  const setup = await setupTestApi({ now: () => clock });
  const { api, pedro, admin, player } = setup;
  await api.joinWaitlist(pedro.token, taken);
  await api.joinWaitlist(admin.token, taken);
  const cancel = () => api.cancelBooking(player.token, 5);
  if (release) await cancel();
  return { ...setup, cancel, advance: (minutes: number) => { clock += minutes * MINUTE; } };
}

function renderHome(session: Parameters<typeof HomePage>[0]['session']) {
  const onExpired = vi.fn();
  render(<HomePage session={session} access={{ status: 'denied' }} onRetry={() => {}} onExpired={onExpired} />);
  return { onExpired };
}

describe('OfferBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('faixa aparece no Início e "Aceitar vaga" cria a reserva', async () => {
    const { pedro, ctx } = await offered();
    const user = userEvent.setup();
    renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    expect(within(banner).getByRole('heading', { name: 'Vaga liberada para você' })).toBeInTheDocument();
    expect(banner).toHaveTextContent('Quadra 1 · ter., 10 de nov. · 19:00. Responda até 12:30.');
    await user.click(within(banner).getByRole('button', { name: 'Aceitar vaga' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Vaga confirmada. A reserva já está em Minhas reservas.');
    expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument();
    expect(ctx.db.bookings.filter((item) => item.status === 'active' && item.starts_at === taken.starts_at))
      .toMatchObject([{ court_id: 1, organizer_id: 4 }]);
    expect(ctx.db.waitlist.map((item) => item.user_id)).toEqual([1]);
  });

  it('em Minhas reservas, a vaga aceita aparece em Próximas', async () => {
    const { pedro } = await offered();
    const user = userEvent.setup();
    render(<BookingsPage session={pedro} onExpired={vi.fn()} now={() => NOW} />);
    expect(await screen.findByText('Nenhuma reserva marcada.')).toBeInTheDocument();
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    await user.click(within(banner).getByRole('button', { name: 'Aceitar vaga' }));
    const link = await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' });
    expect(within(link.closest('article')!).getByText('Organizador')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument();
  });

  it('"Recusar" esconde a faixa e passa a vaga adiante', async () => {
    const { api, pedro, admin } = await offered();
    const user = userEvent.setup();
    renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    await user.click(within(banner).getByRole('button', { name: 'Recusar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Vaga recusada. Ela segue para o próximo da fila.');
    expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument();
    expect((await api.listWaitlist(admin.token))[0].offer).toEqual({ expires_at: '2026-11-09T15:30:00.000Z' });
  });

  it('aceitar oferta vencida mostra o alerta e a faixa some', async () => {
    const { pedro, advance } = await offered();
    const user = userEvent.setup();
    renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    advance(31);
    await user.click(within(banner).getByRole('button', { name: 'Aceitar vaga' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa oferta expirou.');
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Essa oferta expirou.');
  });

  it('falha do servidor mostra o alerta na faixa e libera os botões', async () => {
    const { pedro, ctx } = await offered();
    const user = userEvent.setup();
    renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    ctx.scenario = 'error';
    await user.click(within(banner).getByRole('button', { name: 'Aceitar vaga' }));
    expect(await within(banner).findByRole('alert')).toHaveTextContent('Falha simulada no servidor. Tente novamente.');
    expect(within(banner).getByRole('button', { name: 'Aceitar vaga' })).toBeEnabled();
    expect(within(banner).getByRole('button', { name: 'Recusar' })).toBeEnabled();
  });

  it('sessão expirada ao responder chama onExpired', async () => {
    const { pedro, ctx } = await offered();
    const user = userEvent.setup();
    const { onExpired } = renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    ctx.scenario = 'expired';
    await user.click(within(banner).getByRole('button', { name: 'Recusar' }));
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });

  it('a faixa aparece quando a aba volta a ficar visível', async () => {
    const { api, pedro, cancel } = await offered({ release: false });
    const list = vi.spyOn(api, 'listWaitlist');
    renderHome(pedro);
    // Espera a primeira carga (ainda sem oferta) terminar antes de liberar a vaga.
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await act(async () => { await list.mock.results[0].value; });
    await act(async () => { await cancel(); });
    expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(await screen.findByRole('region', { name: 'Vaga liberada' })).toBeInTheDocument();
  });

  it('recarregar ao voltar à aba mantém a mesma faixa montada, com o foco, até chegar a lista nova', async () => {
    const { api, pedro } = await offered();
    renderHome(pedro);
    const banner = await screen.findByRole('region', { name: 'Vaga liberada' });
    const accept = within(banner).getByRole('button', { name: 'Aceitar vaga' });
    act(() => { accept.focus(); });
    let finish!: () => void;
    const original = api.listWaitlist.bind(api);
    vi.spyOn(api, 'listWaitlist').mockImplementationOnce((token) =>
      new Promise((resolve) => { finish = () => resolve(original(token)); }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    // Recarregando: a faixa é o mesmo elemento e o botão segue com o foco.
    expect(screen.getByRole('region', { name: 'Vaga liberada' })).toBe(banner);
    expect(accept).toHaveFocus();
    await act(async () => { finish(); });
    expect(screen.getByRole('region', { name: 'Vaga liberada' })).toBe(banner);
    expect(accept).toHaveFocus();
  });

  it('trocar de sessão não mostra a faixa da sessão anterior enquanto carrega', async () => {
    const { api, pedro, admin } = await offered();
    const view = render(<HomePage session={pedro} access={{ status: 'denied' }} onRetry={() => {}} onExpired={vi.fn()} />);
    expect(await screen.findByRole('region', { name: 'Vaga liberada' })).toBeInTheDocument();
    vi.spyOn(api, 'listWaitlist').mockImplementationOnce(() => new Promise(() => {}));
    view.rerender(<HomePage session={admin} access={{ status: 'denied' }} onRetry={() => {}} onExpired={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'Vaga liberada' })).not.toBeInTheDocument();
  });
});
