import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/error';
import type { Session } from '../api/types';
import { setupTestApi } from '../test/api';
import { BookingsPage } from './BookingsPage';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');

function renderPage(session: Session) {
  const onExpired = vi.fn();
  const view = render(<BookingsPage session={session} onExpired={onExpired} now={() => NOW} />);
  return { ...view, onExpired };
}

describe('BookingsPage', () => {
  it('Próximas lista as reservas do jogador com papel e contagem', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player);
    const mine = await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' });
    expect(mine).toHaveAttribute('href', '#/reservas/5');
    const first = mine.closest('article')!;
    expect(within(first).getByText('Organizador')).toBeInTheDocument();
    expect(within(first).getByText('1 de 2 confirmaram')).toBeInTheDocument();
    expect(within(first).getByText('TER')).toBeInTheDocument();
    expect(first).toHaveTextContent('ter., 10 de nov.');
    expect(within(first).getByText('ter., 10 de nov.')).toHaveAttribute('datetime', '2026-11-10T22:00:00.000Z');
    const second = screen.getByRole('link', { name: 'Quadra 2 · 08:00–09:00' }).closest('article')!;
    expect(within(second).getByText('Convidado por Camila Oliveira')).toBeInTheDocument();
    expect(within(second).getByText('1 de 2 confirmaram')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('Anteriores mostra "Concluída" e "Cancelada"', async () => {
    const { player, ctx } = await setupTestApi({ now: () => NOW });
    ctx.db.bookings.push({
      id: 30, court_id: 1, starts_at: '2026-11-05T13:00:00.000Z', ends_at: '2026-11-05T14:00:00.000Z',
      status: 'cancelled', organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    const user = userEvent.setup();
    renderPage(player);
    await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' });
    await user.click(screen.getByRole('tab', { name: 'Anteriores' }));
    const done = (await screen.findByRole('link', { name: 'Quadra 2 · 10:00–11:00' })).closest('article')!;
    expect(within(done).getByText('Concluída')).toBeInTheDocument();
    const cancelled = screen.getByRole('link', { name: 'Quadra 1 · 10:00–11:00' }).closest('article')!;
    expect(within(cancelled).getByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).not.toBeInTheDocument();
  });

  it('sem reservas futuras mostra o convite para a agenda', async () => {
    const { pedro } = await setupTestApi({ now: () => NOW });
    renderPage(pedro);
    expect(await screen.findByText('Nenhuma reserva marcada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver agenda' })).toHaveAttribute('href', '#/agenda');
  });

  it('as abas respondem às setas do teclado', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player);
    const upcoming = await screen.findByRole('tab', { name: 'Próximas' });
    const past = screen.getByRole('tab', { name: 'Anteriores' });
    expect(upcoming).toHaveAttribute('aria-selected', 'true');
    expect(upcoming).toHaveAttribute('tabindex', '0');
    expect(past).toHaveAttribute('tabindex', '-1');
    upcoming.focus();
    await user.keyboard('{ArrowRight}');
    expect(past).toHaveAttribute('aria-selected', 'true');
    expect(past).toHaveFocus();
    expect(await screen.findByRole('tabpanel', { name: 'Anteriores' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(upcoming).toHaveFocus();
    await user.keyboard('{End}');
    expect(past).toHaveFocus();
    await user.keyboard('{Home}');
    expect(upcoming).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(past).toHaveFocus();
    expect(past).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
  });

  it('falha de carga com ApiError mostra a mensagem e permite tentar de novo', async () => {
    const { player, api } = await setupTestApi({ now: () => NOW });
    const real = api.listBookings;
    api.listBookings = vi.fn().mockRejectedValueOnce(new ApiError('Reserva não encontrada.', 404)).mockImplementation(real);
    const user = userEvent.setup();
    renderPage(player);
    expect(await screen.findByRole('alert')).toHaveTextContent('Reserva não encontrada.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).toBeInTheDocument();
  });

  it('erro mostra alerta e permite tentar de novo; 401 chama onExpired', async () => {
    const { player } = await setupTestApi({ now: () => NOW, scenario: 'error' });
    const failing = renderPage(player);
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    failing.unmount();
    await setupTestApi({ now: () => NOW, scenario: 'expired' });
    const { onExpired } = renderPage(player);
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });
});

describe('BookingsPage presença', () => {
  it('convidado responde no próprio card e a contagem muda', async () => {
    const { mariana } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(mariana);
    const card = (await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Confirmar presença' }));
    expect(await within(card).findByText('Presença confirmada')).toBeInTheDocument();
    expect(within(card).getByText('2 de 2 confirmaram')).toBeInTheDocument();
  });

  it('organizador não vê botões de presença no card', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player);
    const card = (await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).closest('article')!;
    expect(within(card).queryByRole('button', { name: /presença|Não vou/ })).not.toBeInTheDocument();
  });

  it('duas respostas rápidas em cards diferentes ficam as duas', async () => {
    const { mariana, api, ctx } = await setupTestApi({ now: () => NOW });
    ctx.db.bookings.find((item) => item.id === 6)!.participants.push({ user_id: 3, attendance: 'pending' });
    const real = api.respondAttendance;
    const releases: (() => void)[] = [];
    api.respondAttendance = vi.fn((...args: Parameters<typeof real>) =>
      new Promise((resolve) => { releases.push(() => resolve(real(...args))); })) as typeof real;
    const user = userEvent.setup();
    renderPage(mariana);
    const first = (await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).closest('article')!;
    const second = screen.getByRole('link', { name: 'Quadra 2 · 08:00–09:00' }).closest('article')!;
    await user.click(within(first).getByRole('button', { name: 'Confirmar presença' }));
    await user.click(within(second).getByRole('button', { name: 'Confirmar presença' }));
    releases.forEach((release) => release());
    expect(await within(first).findByText('Presença confirmada')).toBeInTheDocument();
    expect(await within(second).findByText('Presença confirmada')).toBeInTheDocument();
  });

  it('responder e trocar de aba antes da resposta não sobrescreve Anteriores', async () => {
    const { mariana, api } = await setupTestApi({ now: () => NOW });
    const real = api.respondAttendance;
    let release!: () => void;
    api.respondAttendance = vi.fn((...args: Parameters<typeof real>) =>
      new Promise((resolve) => { release = () => resolve(real(...args)); })) as typeof real;
    const user = userEvent.setup();
    renderPage(mariana);
    await user.click(await screen.findByRole('button', { name: 'Confirmar presença' }));
    await user.click(screen.getByRole('tab', { name: 'Anteriores' }));
    expect(await screen.findByText('Nenhuma reserva anterior.')).toBeInTheDocument();
    release();
    await vi.waitFor(() => expect(api.respondAttendance).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('Nenhuma reserva anterior.')).toBeInTheDocument();
    expect(screen.queryByText('Carregando reservas…')).not.toBeInTheDocument();
  });
});

describe('BookingsPage cancelamento', () => {
  const cancelName = 'Cancelar reserva da Quadra 1 em ter., 10 de nov. 19:00';

  it('cancelar pede confirmação e "Manter reserva" não altera nada e devolve o foco', async () => {
    const { player, api } = await setupTestApi({ now: () => NOW });
    const spy = vi.spyOn(api, 'cancelBooking');
    const user = userEvent.setup();
    renderPage(player);
    const opener = await screen.findByRole('button', { name: cancelName });
    await user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Cancelar reserva?' });
    expect(within(dialog).getByText('Os participantes serão avisados e a vaga vai para a fila de espera.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Manter reserva' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Manter reserva' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).toBeInTheDocument();
  });

  it('confirmar tira o card de Próximas, avisa e move para Anteriores como Cancelada', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player);
    await user.click(await screen.findByRole('button', { name: cancelName }));
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    expect(await screen.findByText('Reserva cancelada.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Anteriores' }));
    const card = (await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' })).closest('article')!;
    expect(within(card).getByText('Cancelada')).toBeInTheDocument();
  });

  it('convidado não vê Cancelar e o mock responde 403 se tentar', async () => {
    const { mariana, api } = await setupTestApi({ now: () => NOW });
    renderPage(mariana);
    await screen.findByRole('link', { name: 'Quadra 1 · 19:00–20:00' });
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
    await expect(api.cancelBooking(mariana.token, 5)).rejects.toMatchObject({ status: 403 });
  });

  it('erro do servidor aparece no painel e permite tentar de novo; 401 chama onExpired', async () => {
    const { player, api } = await setupTestApi({ now: () => NOW });
    const real = api.cancelBooking;
    api.cancelBooking = vi.fn().mockRejectedValueOnce(new ApiError('Essa reserva já começou ou foi cancelada.', 422)) as typeof real;
    const user = userEvent.setup();
    const { onExpired } = renderPage(player);
    await user.click(await screen.findByRole('button', { name: cancelName }));
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa reserva já começou ou foi cancelada.');
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeEnabled();
    api.cancelBooking = vi.fn().mockRejectedValueOnce(new ApiError('Sessão expirada.', 401)) as typeof real;
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });
});

describe('BookingsPage reserva em andamento', () => {
  it('não oferece Cancelar nem presença', async () => {
    const { player, ctx } = await setupTestApi({ now: () => NOW });
    ctx.db.bookings.push({
      id: 50, court_id: 1, starts_at: '2026-11-09T14:30:00.000Z', ends_at: '2026-11-09T15:30:00.000Z',
      status: 'active', organizer_id: 3, participants: [{ user_id: 3, attendance: 'confirmed' }, { user_id: 2, attendance: 'pending' }],
    });
    ctx.db.bookings.push({
      id: 51, court_id: 2, starts_at: '2026-11-09T14:30:00.000Z', ends_at: '2026-11-09T15:30:00.000Z',
      status: 'active', organizer_id: 2, participants: [{ user_id: 2, attendance: 'confirmed' }],
    });
    renderPage(player);
    const guest = (await screen.findByRole('link', { name: 'Quadra 1 · 11:30–12:30' })).closest('article')!;
    const own = screen.getByRole('link', { name: 'Quadra 2 · 11:30–12:30' }).closest('article')!;
    expect(within(guest).queryByRole('button')).not.toBeInTheDocument();
    expect(within(own).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('BookingsPage remarcação', () => {
  it('organizador de reserva futura vê o link Remarcar; convidado não', async () => {
    const { player, mariana } = await setupTestApi({ now: () => NOW });
    const first = renderPage(player);
    const link = await screen.findByRole('link', { name: /^Remarcar reserva da Quadra 1 em .* 19:00$/ });
    expect(link).toHaveAttribute('href', '#/agenda/remarcar/5');
    first.unmount();
    renderPage(mariana);
    await screen.findByRole('link', { name: /Quadra 1 · 19:00/ });
    expect(screen.queryByRole('link', { name: /^Remarcar/ })).not.toBeInTheDocument();
  });
});
