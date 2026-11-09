import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../api/types';
import { setupTestApi } from '../test/api';
import { SchedulePage } from './SchedulePage';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');

function renderPage(session: Session, now = () => NOW) {
  const onExpired = vi.fn();
  const view = render(<SchedulePage session={session} onExpired={onExpired} rescheduleId={null} now={now} />);
  return { ...view, onExpired };
}

describe('SchedulePage', () => {
  it('mostra os estados com rótulos acessíveis', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player);
    expect(await screen.findByRole('button', { name: 'Quadra 3, 17:00, em manutenção' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Quadra 2, 18:00, livre' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /TER 10/ }));
    expect(await screen.findByRole('button', { name: 'Quadra 1, 19:00, sua reserva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quadra 2, 19:00, livre' })).toBeInTheDocument();
  });

  it('mostra o estado ocupado para reserva de outra pessoa', async () => {
    const { pedro } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(pedro);
    await user.click(await screen.findByRole('button', { name: /TER 10/ }));
    expect(await screen.findByRole('button', { name: 'Quadra 1, 19:00, ocupado' })).toBeInTheDocument();
  });

  it('a legenda usa os quatro textos da especificação', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    renderPage(player);
    const legend = await screen.findByRole('list', { name: 'Legenda' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Livre', 'Ocupado', 'Sua reserva', 'Manutenção']);
  });

  it('trocar o dia recarrega a grade', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player);
    expect(await screen.findByRole('button', { name: 'Quadra 3, 17:00, em manutenção' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /TER 10/ }));
    expect(await screen.findByRole('button', { name: 'Quadra 1, 19:00, sua reserva' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quadra 3, 17:00, em manutenção' })).not.toBeInTheDocument();
  });

  it('a faixa de dias começa no hoje do clube', async () => {
    const now = () => Date.parse('2026-11-10T01:00:00Z'); // 22:00 de segunda 9 em São Paulo
    const { player } = await setupTestApi({ now });
    renderPage(player, now);
    const days = await screen.findAllByRole('button', { name: /^(DOM|SEG|TER|QUA|QUI|SEX|SÁB) \d\d$/ });
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveAccessibleName('SEG 09');
    expect(days[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('selecionar horário livre abre o painel lateral; manutenção explica', async () => {
    const { player } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(player);
    await user.click(await screen.findByRole('button', { name: 'Quadra 2, 18:00, livre' }));
    const panel = screen.getByRole('complementary', { name: 'Horário selecionado' });
    expect(panel).toHaveTextContent('Quadra 2');
    expect(panel).toHaveTextContent('18:00');
    await user.click(screen.getByRole('button', { name: 'Quadra 3, 17:00, em manutenção' }));
    expect(screen.getByRole('complementary', { name: 'Horário selecionado' })).toHaveTextContent('Quadra em manutenção nesse horário.');
  });

  it('sem quadras mostra o convite vazio', async () => {
    const { player, ctx } = await setupTestApi({ now: () => NOW });
    ctx.db.courts.splice(0);
    renderPage(player);
    expect(await screen.findByText('Nenhuma quadra cadastrada ainda.')).toBeInTheDocument();
  });

  it('erro de carga mostra alerta e "Tentar novamente"', async () => {
    const { player, ctx } = await setupTestApi({ now: () => NOW, scenario: 'error' });
    const user = userEvent.setup();
    renderPage(player);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha simulada no servidor. Tente novamente.');
    ctx.scenario = 'success';
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('button', { name: 'Quadra 2, 18:00, livre' })).toBeInTheDocument();
  });

  it('sessão expirada chama onExpired', async () => {
    const { player } = await setupTestApi({ now: () => NOW, scenario: 'expired' });
    const { onExpired } = renderPage(player);
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });
  describe('reservar', () => {
    const slot = { court_id: 2, starts_at: '2026-11-09T21:00:00.000Z', participant_ids: [] as number[] };

    async function openPanel(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Quadra 2, 18:00, livre' }));
    }
    async function invite(user: ReturnType<typeof userEvent.setup>, search: string, name: string) {
      await user.type(screen.getByRole('searchbox', { name: 'Convidar jogadores' }), search);
      await user.click(await screen.findByRole('button', { name }));
    }

    it('reservar horário livre marca "Sua reserva" e mostra link para a reserva', async () => {
      const { player, ctx } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      expect(screen.getByRole('heading', { name: 'Confirmar reserva' })).toBeInTheDocument();
      await invite(user, 'Mari', 'Mariana Silva');
      expect(screen.getByRole('button', { name: 'Remover Mariana Silva' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Reserva confirmada');
      expect(screen.getByRole('link', { name: 'Ver reserva' })).toHaveAttribute('href', expect.stringMatching(/^#\/reservas\/\d+$/));
      expect(screen.getByRole('button', { name: 'Quadra 2, 18:00, sua reserva' })).toBeInTheDocument();
      expect(ctx.db.bookings.at(-1)!.participants.map((item) => item.user_id)).toEqual([2, 3]);
    });

    it('conflito mostra alerta e recarrega a agenda', async () => {
      const { player, mariana, api } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await api.createBooking(mariana.token, slot);
      await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
      expect(await screen.findByRole('button', { name: 'Quadra 2, 18:00, ocupado' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
      expect(screen.getByRole('button', { name: 'Reservar quadra' })).toBeEnabled();
    });

    it('clique duplo cria uma reserva só', async () => {
      const { player, ctx } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      const before = ctx.db.bookings.length;
      await user.dblClick(screen.getByRole('button', { name: 'Reservar quadra' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Reserva confirmada');
      expect(ctx.db.bookings).toHaveLength(before + 1);
    });

    it('não deixa convidar o quarto jogador', async () => {
      const { player } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await invite(user, 'Mari', 'Mariana Silva');
      await invite(user, 'Pedro', 'Pedro Santos');
      await invite(user, 'Camila', 'Camila Oliveira');
      expect(screen.queryByRole('searchbox', { name: 'Convidar jogadores' })).not.toBeInTheDocument();
      expect(screen.getByText('Até 3 convidados.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remover Pedro Santos' }));
      expect(screen.getByRole('searchbox', { name: 'Convidar jogadores' })).toBeInTheDocument();
    });

    it('sessão expirada ao reservar chama onExpired', async () => {
      let current = NOW;
      const { player } = await setupTestApi({ now: () => current });
      const user = userEvent.setup();
      const { onExpired } = renderPage(player, () => current);
      await openPanel(user);
      current += 2 * 3600000; // a sessão do mock dura 1 h
      await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
      await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
    });
  });
});
