import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/error';
import type { Session } from '../api/types';
import { setupTestApi } from '../test/api';
import { SchedulePage } from './SchedulePage';

const NOW = Date.parse('2026-11-09T12:00:00-03:00');

function renderPage(session: Session, now = () => NOW, rescheduleId: number | null = null) {
  const onExpired = vi.fn();
  const view = render(<SchedulePage session={session} onExpired={onExpired} rescheduleId={rescheduleId} now={now} />);
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
      expect(await screen.findByRole('button', { name: 'Quadra 2, 18:00, sua reserva' })).toBeInTheDocument();
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
    it('depois de reservar, o formulário some antes da recarga e não há segundo envio', async () => {
      const { player, api } = await setupTestApi({ now: () => NOW });
      const original = api.getSchedule.bind(api);
      let loads = 0;
      vi.spyOn(api, 'getSchedule').mockImplementation(async (token, date) => {
        if (++loads > 1) await new Promise((resolve) => setTimeout(resolve, 300));
        return original(token, date);
      });
      const create = vi.spyOn(api, 'createBooking');
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Reserva confirmada');
      expect(screen.queryByRole('button', { name: 'Reservar quadra' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('busca sem resultado mostra "Nenhum jogador encontrado."', async () => {
      const { player } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await user.type(screen.getByRole('searchbox', { name: 'Convidar jogadores' }), 'zzz');
      expect(await screen.findByText('Nenhum jogador encontrado.')).toBeInTheDocument();
    });

    it('digitar rápido faz uma busca só', async () => {
      const { player, api } = await setupTestApi({ now: () => NOW });
      const search = vi.spyOn(api, 'searchPlayers');
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await user.type(screen.getByRole('searchbox', { name: 'Convidar jogadores' }), 'Mari');
      await screen.findByRole('button', { name: 'Mariana Silva' });
      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith(player.token, 'Mari');
    });

    it('erro na busca mostra aviso sem expor detalhes', async () => {
      const { player, api } = await setupTestApi({ now: () => NOW });
      vi.spyOn(api, 'searchPlayers').mockRejectedValue(new ApiError('detalhe interno', 500));
      const user = userEvent.setup();
      renderPage(player);
      await openPanel(user);
      await user.type(screen.getByRole('searchbox', { name: 'Convidar jogadores' }), 'Mari');
      expect(await screen.findByText('Não foi possível buscar jogadores. Tente de novo.')).toBeInTheDocument();
      expect(screen.queryByText(/detalhe interno/)).not.toBeInTheDocument();
    });

    it('401 na busca chama onExpired', async () => {
      const { player, api } = await setupTestApi({ now: () => NOW });
      vi.spyOn(api, 'searchPlayers').mockRejectedValue(new ApiError('Sessão inválida.', 401));
      const user = userEvent.setup();
      const { onExpired } = renderPage(player);
      await openPanel(user);
      await user.type(screen.getByRole('searchbox', { name: 'Convidar jogadores' }), 'Mari');
      await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
    });
  });

  describe('remarcar', () => {
    it('modo remarcar mostra a faixa com o horário original', async () => {
      const { player } = await setupTestApi({ now: () => NOW });
      renderPage(player, () => NOW, 5);
      const banner = await screen.findByRole('region', { name: 'Remarcação em andamento' });
      expect(banner).toHaveTextContent('Escolha o novo horário para Quadra 1 · ter., 10 de nov. · 19:00');
      expect(within(banner).getByRole('link', { name: 'Cancelar remarcação' })).toHaveAttribute('href', '#/reservas/5');
      // abre no dia da reserva (amanhã)
      expect(await screen.findByRole('button', { name: /TER 10/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('escolher horário livre mostra De → Para e salvar leva ao detalhe', async () => {
      const { player, ctx } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      window.location.hash = '';
      renderPage(player, () => NOW, 5);
      await user.click(await screen.findByRole('button', { name: 'Quadra 2, 20:00, livre' }));
      const panel = screen.getByRole('complementary', { name: 'Horário selecionado' });
      expect(screen.queryByRole('heading', { name: 'Confirmar reserva' })).not.toBeInTheDocument();
      expect(within(panel).getByText('De').nextSibling).toHaveTextContent('Quadra 1 · ter., 10 de nov. · 19:00');
      expect(within(panel).getByText('Para').nextSibling).toHaveTextContent('Quadra 2 · ter., 10 de nov. · 20:00 às 21:00');
      await user.click(screen.getByRole('button', { name: 'Confirmar novo horário' }));
      await vi.waitFor(() => expect(window.location.hash).toBe('#/reservas/5'));
      const moved = ctx.db.bookings.find((item) => item.id === 5)!;
      expect(moved).toMatchObject({ court_id: 2, starts_at: '2026-11-10T23:00:00.000Z' });
    });

    it('o horário atual da reserva não abre nada', async () => {
      const { player } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player, () => NOW, 5);
      await user.click(await screen.findByRole('button', { name: 'Quadra 1, 19:00, sua reserva' }));
      expect(screen.queryByRole('complementary', { name: 'Horário selecionado' })).not.toBeInTheDocument();
    });

    it('conflito ao remarcar mostra alerta e mantém a reserva original', async () => {
      const { player, mariana, api, ctx } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player, () => NOW, 5);
      await user.click(await screen.findByRole('button', { name: 'Quadra 2, 20:00, livre' }));
      await api.createBooking(mariana.token, { court_id: 2, starts_at: '2026-11-10T23:00:00.000Z', participant_ids: [] });
      await user.click(screen.getByRole('button', { name: 'Confirmar novo horário' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
      expect(await screen.findByRole('button', { name: 'Quadra 2, 20:00, ocupado' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
      expect(screen.getByRole('button', { name: 'Confirmar novo horário' })).toBeEnabled();
      expect(ctx.db.bookings.find((item) => item.id === 5)).toMatchObject({ court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' });
    });

    it('reserva de outra pessoa ou inexistente mostra "Reserva não encontrada"', async () => {
      const { pedro } = await setupTestApi({ now: () => NOW });
      renderPage(pedro, () => NOW, 5);
      expect(await screen.findByRole('heading', { name: 'Reserva não encontrada' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Remarcação em andamento' })).not.toBeInTheDocument();
    });

    it('sessão expirada ao carregar a reserva chama onExpired', async () => {
      const { player } = await setupTestApi({ now: () => NOW, scenario: 'expired' });
      const { onExpired } = renderPage(player, () => NOW, 5);
      await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
    });
  });
});

describe('SchedulePage fila de espera', () => {
  async function openTaken(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /TER 10/ }));
    await user.click(await screen.findByRole('button', { name: 'Quadra 1, 19:00, ocupado' }));
  }

  it('horário ocupado mostra a posição prevista e entra na fila', async () => {
    const { pedro, ctx } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(pedro);
    await openTaken(user);
    expect(screen.getByText('Você seria o 1º da fila')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    expect(await screen.findByText('Você é o 1º da fila')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair da fila' })).toBeInTheDocument();
    expect(ctx.db.waitlist).toHaveLength(1);
  });

  it('quem já está na fila vê a posição ao abrir o horário', async () => {
    const { pedro, mariana, api } = await setupTestApi({ now: () => NOW });
    const taken = { court_id: 1, starts_at: '2026-11-10T22:00:00.000Z' };
    await api.joinWaitlist(mariana.token, taken).catch(() => undefined); // participante: não entra
    await api.joinWaitlist(pedro.token, taken);
    const user = userEvent.setup();
    renderPage(pedro);
    await openTaken(user);
    expect(await screen.findByText('Você é o 1º da fila')).toBeInTheDocument();
  });

  it('sair da fila volta ao estado inicial', async () => {
    const { pedro, ctx } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(pedro);
    await openTaken(user);
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    await user.click(await screen.findByRole('button', { name: 'Sair da fila' }));
    expect(await screen.findByText('Você seria o 1º da fila')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar na fila' })).toBeEnabled();
    expect(ctx.db.waitlist).toHaveLength(0);
  });

  it('erro ao entrar na fila aparece no painel e sessão expirada chama onExpired', async () => {
    const { pedro, api } = await setupTestApi({ now: () => NOW });
    const real = api.joinWaitlist;
    api.joinWaitlist = vi.fn().mockRejectedValueOnce(new ApiError('Você já está na fila desse horário.', 409)).mockRejectedValueOnce(new ApiError('Sessão', 401)).mockImplementation(real);
    const user = userEvent.setup();
    const { onExpired } = renderPage(pedro);
    await openTaken(user);
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Você já está na fila desse horário.');
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
  });

  it('após conflito, "Entrar na fila de espera" coloca o jogador na fila', async () => {
    const { pedro, mariana, api, ctx } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(pedro);
    await user.click(await screen.findByRole('button', { name: 'Quadra 2, 18:00, livre' }));
    await api.createBooking(mariana.token, { court_id: 2, starts_at: '2026-11-09T21:00:00.000Z', participant_ids: [] });
    await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário acabou de ser reservado por outra pessoa.');
    await user.click(await screen.findByRole('button', { name: 'Entrar na fila de espera' }));
    expect(await screen.findByText('Você é o 1º da fila')).toBeInTheDocument();
    expect(ctx.db.waitlist).toMatchObject([{ user_id: 4, court_id: 2, starts_at: '2026-11-09T21:00:00.000Z' }]);
    expect(screen.queryByRole('button', { name: 'Entrar na fila de espera' })).not.toBeInTheDocument();
  });

  it('conflito por manutenção não oferece a fila', async () => {
    const { pedro, ctx } = await setupTestApi({ now: () => NOW });
    const user = userEvent.setup();
    renderPage(pedro);
    await user.click(await screen.findByRole('button', { name: 'Quadra 2, 18:00, livre' }));
    ctx.db.courts.find((item) => item.id === 2)!.maintenance.push({
      id: 77, starts_at: '2026-11-09T20:00:00.000Z', ends_at: '2026-11-09T23:00:00.000Z', reason: 'Piso',
    });
    await user.click(screen.getByRole('button', { name: 'Reservar quadra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa quadra está em manutenção nesse horário.');
    expect(screen.queryByRole('button', { name: 'Entrar na fila de espera' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Quadra 2, 18:00, em manutenção' });
    expect(screen.getByRole('complementary', { name: 'Horário selecionado' })).toHaveTextContent('Quadra em manutenção nesse horário.');
    expect(screen.queryByRole('button', { name: 'Entrar na fila de espera' })).not.toBeInTheDocument();
  });
});

