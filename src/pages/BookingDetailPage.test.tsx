import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/error';
import type { Session } from '../api/types';
import { setupTestApi } from '../test/api';
import { BookingDetailPage } from './BookingDetailPage';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');

function renderPage(session: Session, id: number) {
  const onExpired = vi.fn();
  const view = render(<BookingDetailPage id={id} session={session} onExpired={onExpired} now={() => NOW} />);
  return { ...view, onExpired };
}

describe('BookingDetailPage', () => {
  it('convidado confirma presença e a contagem atualiza', async () => {
    const { mariana } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(mariana, 5);
    expect(await screen.findByRole('heading', { level: 1, name: 'Quadra 1' })).toBeInTheDocument();
    expect(screen.getByText('SUA RESERVA')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 confirmaram')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar presença' }));
    expect(await screen.findByText('Presença confirmada')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 confirmaram')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirmados (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Pendentes/ })).not.toBeInTheDocument();
  });

  it('convidado avisa que não vai', async () => {
    const { mariana } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(mariana, 5);
    await user.click(await screen.findByRole('button', { name: 'Não vou' }));
    expect(await screen.findByText('Você avisou que não vai')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Não vão (1)' })).toBeInTheDocument();
  });

  it('organizador vê os grupos de presença', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player, 5);
    expect(await screen.findByRole('heading', { name: 'Confirmados (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pendentes (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Não vão/ })).not.toBeInTheDocument();
    expect(screen.getByText('Mariana Silva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Minhas reservas/ })).toHaveAttribute('href', '#/reservas');
  });

  it('organizador não vê "Confirmar presença"', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player, 5);
    await screen.findByRole('heading', { name: 'Confirmados (1)' });
    expect(screen.queryByRole('button', { name: 'Confirmar presença' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Não vou' })).not.toBeInTheDocument();
  });

  it('reserva já concluída não oferece resposta', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player, 7);
    await screen.findByRole('heading', { level: 1, name: 'Quadra 2' });
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar presença' })).not.toBeInTheDocument();
  });

  it('reserva de outra pessoa ou inexistente mostra "Reserva não encontrada"', async () => {
    const { pedro } = await setupTestApi({ now: () => NOW });
    const foreign = renderPage(pedro, 5);
    expect(await screen.findByRole('heading', { name: 'Reserva não encontrada' })).toBeInTheDocument();
    foreign.unmount();
    renderPage(pedro, 9999);
    expect(await screen.findByRole('heading', { name: 'Reserva não encontrada' })).toBeInTheDocument();
  });

  it('404 com outro texto também mostra "Reserva não encontrada", sem tentar de novo', async () => {
    const { player, api } = await setupTestApi({ now: () => NOW });
    api.getBooking = vi.fn().mockRejectedValue(new ApiError('Not Found', 404));
    renderPage(player, 5);
    expect(await screen.findByRole('heading', { name: 'Reserva não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('erro de carga que não é 404 mostra alerta e tentar de novo', async () => {
    const { player, api } = await setupTestApi({ now: () => NOW });
    api.getBooking = vi.fn().mockRejectedValue(new ApiError('Falha.', 500));
    renderPage(player, 5);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('erro ao responder mostra o alerta e libera os botões', async () => {
    const { mariana, api } = await setupTestApi({ now: () => NOW });
    api.respondAttendance = vi.fn().mockRejectedValue(new ApiError('Essa reserva já começou ou foi cancelada.', 422));
    const user = userEvent.setup();
    renderPage(mariana, 5);
    await user.click(await screen.findByRole('button', { name: 'Confirmar presença' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa reserva já começou ou foi cancelada.');
    expect(screen.getByRole('button', { name: 'Confirmar presença' })).toBeEnabled();
  });

  it('401 ao responder chama onExpired', async () => {
    const { mariana, api } = await setupTestApi({ now: () => NOW });
    api.respondAttendance = vi.fn().mockRejectedValue(new ApiError('Sessão expirada.', 401));
    const user = userEvent.setup();
    const { onExpired } = renderPage(mariana, 5);
    await user.click(await screen.findByRole('button', { name: 'Confirmar presença' }));
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });

  it('o detalhe mostra a data do clube', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player, 5);
    const time = await screen.findByText('ter., 10 de nov.');
    expect(time).toHaveAttribute('datetime', '2026-11-10T22:00:00.000Z');
    expect(within(time.closest('section')!).getByText(/19:00–20:00/)).toBeInTheDocument();
  });
});

describe('BookingDetailPage cancelamento', () => {
  it('organizador cancela, vê o aviso e as ações somem', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player, 5);
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva da Quadra 1 em ter., 10 de nov. 19:00' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    expect(await screen.findByText('Reserva cancelada.')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('convidado não vê Cancelar', async () => {
    const { mariana } = await setupTestApi({ now: () => NOW });
    renderPage(mariana, 5);
    await screen.findByRole('heading', { level: 1, name: 'Quadra 1' });
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
  });
});

describe('BookingDetailPage reserva em andamento', () => {
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
    const guest = renderPage(player, 50);
    await screen.findByRole('heading', { level: 1, name: 'Quadra 1' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    guest.unmount();
    renderPage(player, 51);
    await screen.findByRole('heading', { level: 1, name: 'Quadra 2' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
