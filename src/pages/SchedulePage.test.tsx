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
});
