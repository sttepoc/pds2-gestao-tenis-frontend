import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
