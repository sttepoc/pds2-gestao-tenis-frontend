import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../api/types';
import { listCourts } from '../api/courts';
import { setupTestApi } from '../test/api';
import { CourtsPage } from './CourtsPage';

// 12:00 em São Paulo; as fixtures do mock são relativas a este instante.
const NOW = Date.parse('2026-11-09T12:00:00-03:00');

function renderPage(session: Session, status: 'allowed' | 'denied' | 'checking' = 'allowed') {
  const onExpired = vi.fn();
  const onRetry = vi.fn();
  const view = render(<CourtsPage session={session} access={{ status }} now={() => NOW} onRetry={onRetry} onExpired={onExpired} />);
  return { ...view, onExpired, onRetry };
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Nova quadra' }));
  await user.type(screen.getByLabelText('Nome'), name);
  await user.selectOptions(screen.getByLabelText('Piso'), 'Saibro');
  await user.click(screen.getByLabelText('Coberta'));
  await user.click(screen.getByRole('button', { name: 'Salvar quadra' }));
}

describe('CourtsPage', () => {
  it('admin cadastra quadra e ela aparece na lista', async () => {
    const { admin } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(admin);
    await fillAndSave(user, 'Quadra Central');
    const heading = await screen.findByRole('heading', { name: 'Quadra Central' });
    const card = heading.closest('article') as HTMLElement;
    expect(within(card).getByText('Saibro')).toBeInTheDocument();
    expect(within(card).getByText('Coberta')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  it('lista as quadras existentes com piso e selo Disponível', async () => {
    const { admin } = await setupTestApi();
    renderPage(admin);
    expect(await screen.findByRole('heading', { name: 'Quadra 3' })).toBeInTheDocument();
    expect(screen.getAllByText('Disponível')).toHaveLength(3);
    expect(screen.getByText('Coberta')).toBeInTheDocument();
  });

  it('nome vazio mostra erro no campo e foca nele', async () => {
    const { admin } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(admin);
    await user.click(await screen.findByRole('button', { name: 'Nova quadra' }));
    await user.click(screen.getByRole('button', { name: 'Salvar quadra' }));
    expect(screen.getByText('Informe o nome da quadra.')).toBeInTheDocument();
    const name = screen.getByLabelText('Nome');
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('maxlength', '60');
  });

  it('admin edita o nome da quadra', async () => {
    const { admin } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(admin);
    await screen.findByRole('heading', { name: 'Quadra 1' });
    await user.click(screen.getAllByRole('button', { name: /^Editar/ })[0]);
    const name = screen.getByLabelText('Nome');
    expect(name).toHaveValue('Quadra 1');
    await user.clear(name);
    await user.type(name, 'Quadra 1 Coberta');
    await user.click(screen.getByRole('button', { name: 'Salvar quadra' }));
    expect(await screen.findByRole('heading', { name: 'Quadra 1 Coberta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quadra 1' })).not.toBeInTheDocument();
  });

  it('nome duplicado mostra o erro do servidor no campo', async () => {
    const { admin } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(admin);
    await fillAndSave(user, 'quadra 2');
    const name = await screen.findByLabelText('Nome');
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Já existe uma quadra com este nome.');
    expect(name).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Salvar quadra' })).toBeEnabled();
  });

  it('jogador comum vê o painel "Acesso restrito" e nenhum botão de cadastro', async () => {
    const { player } = await setupTestApi();
    renderPage(player, 'denied');
    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova quadra' })).not.toBeInTheDocument();
  });

  it('403 do servidor aparece como alerta mesmo com o botão visível', async () => {
    const { player } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(player, 'allowed');
    await fillAndSave(user, 'Quadra Nova');
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso restrito a administradores.');
  });

  it('sessão expirada chama onExpired', async () => {
    const { admin } = await setupTestApi({ scenario: 'expired' });
    const { onExpired } = renderPage(admin);
    await waitFor(() => expect(onExpired).toHaveBeenCalled());
  });

  it('erro ao carregar mostra alerta e permite tentar de novo', async () => {
    const { admin, ctx } = await setupTestApi({ scenario: 'error' });
    const user = userEvent.setup();
    renderPage(admin);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha simulada no servidor.');
    ctx.scenario = 'success';
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Quadra 1' })).toBeInTheDocument();
  });

  it('nome com HTML aparece como texto', async () => {
    const { admin, api } = await setupTestApi();
    await api.createCourt(admin.token, { name: '<img src=x onerror=alert(1)>', surface: 'grass', covered: false });
    const { container } = renderPage(admin);
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('botão Salvar não envia duas vezes em clique duplo', async () => {
    const { admin } = await setupTestApi();
    const user = userEvent.setup();
    renderPage(admin);
    await user.click(await screen.findByRole('button', { name: 'Nova quadra' }));
    await user.type(screen.getByLabelText('Nome'), 'Quadra Dupla');
    await user.dblClick(screen.getByRole('button', { name: 'Salvar quadra' }));
    await screen.findByRole('heading', { name: 'Quadra Dupla' });
    expect(await listCourts(admin.token)).toHaveLength(4);
  });

  describe('manutenção', () => {
    async function openMaintenance(user: ReturnType<typeof userEvent.setup>, courtName: string) {
      await user.click(await screen.findByRole('button', { name: `Marcar manutenção em ${courtName}` }));
    }
    function fillWindow(start: string, end: string, reason: string) {
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: start } });
      fireEvent.change(screen.getByLabelText('Fim'), { target: { value: end } });
      fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: reason } });
    }

    it('fim antes do início → erro no campo Fim', async () => {
      const { admin } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(admin);
      await openMaintenance(user, 'Quadra 2');
      fillWindow('2026-11-10T18:00', '2026-11-10T17:00', 'Piso novo');
      await user.click(screen.getByRole('button', { name: 'Salvar manutenção' }));
      const end = screen.getByLabelText('Fim');
      expect(end).toHaveAccessibleDescription('O fim precisa ser depois do início.');
      expect(end).toHaveAttribute('aria-invalid', 'true');
      expect(end).toHaveFocus();
    });

    it('período com reservas mostra o aviso e pede confirmação', async () => {
      const { admin, ctx } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(admin);
      await openMaintenance(user, 'Quadra 1');
      fillWindow('2026-11-10T18:00', '2026-11-10T21:00', 'Pintura');
      await user.click(screen.getByRole('button', { name: 'Salvar manutenção' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Há 1 reserva(s) nesse período.');
      expect(ctx.db.bookings.find((item) => item.id === 5)?.status).toBe('active');
      await user.click(screen.getByLabelText('Cancelar as reservas afetadas'));
      await user.click(screen.getByRole('button', { name: 'Salvar manutenção' }));
      expect(await screen.findByText('Pintura')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Manutenção registrada.');
      expect(ctx.db.bookings.find((item) => item.id === 5)?.status).toBe('cancelled');
    });

    it('janela cobrindo agora mostra "Em manutenção até"', async () => {
      const { admin } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(admin);
      await openMaintenance(user, 'Quadra 2');
      fillWindow('2026-11-09T11:00', '2026-11-09T14:00', 'Reforma');
      await user.click(screen.getByRole('button', { name: 'Salvar manutenção' }));
      const card = (await screen.findByRole('heading', { name: 'Quadra 2' })).closest('article') as HTMLElement;
      expect(await within(card).findByText(/^Em manutenção até .*14:00/)).toBeInTheDocument();
      expect(within(card).getByText('Reforma')).toBeInTheDocument();
    });

    it('remover janela volta o status para Disponível', async () => {
      const { admin, api } = await setupTestApi({ now: () => NOW });
      await api.addMaintenance(admin.token, 2, {
        starts_at: '2026-11-09T11:00:00-03:00', ends_at: '2026-11-09T14:00:00-03:00', reason: 'Reforma',
      });
      const user = userEvent.setup();
      renderPage(admin);
      const card = (await screen.findByRole('heading', { name: 'Quadra 2' })).closest('article') as HTMLElement;
      expect(within(card).getByText('Em manutenção')).toBeInTheDocument();
      await user.click(within(card).getByRole('button', { name: /^Remover manutenção de Quadra 2/ }));
      await waitFor(() => expect(within(card).getByText('Disponível')).toBeInTheDocument());
      expect(within(card).queryByText('Reforma')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Manutenção removida.');
    });

    it('janela futura da fixture aparece com botão Remover de nome distinto', async () => {
      const { admin } = await setupTestApi({ now: () => NOW });
      renderPage(admin);
      expect(await screen.findByText('Troca da rede')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Remover manutenção de Quadra 3/ })).toHaveLength(1);
    });

    it('403 ao registrar mostra alerta; formulário continua aberto', async () => {
      const { player } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(player, 'allowed');
      await openMaintenance(user, 'Quadra 2');
      fillWindow('2026-11-10T08:00', '2026-11-10T09:00', 'Teste');
      await user.click(screen.getByRole('button', { name: 'Salvar manutenção' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Acesso restrito a administradores.');
      expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    });
  });

  describe('acessibilidade dos cartões', () => {
    it('botões têm nomes distintos por quadra', async () => {
      const { admin } = await setupTestApi({ now: () => NOW });
      renderPage(admin);
      await screen.findByRole('heading', { name: 'Quadra 1' });
      expect(screen.getByRole('button', { name: 'Editar Quadra 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Marcar manutenção em Quadra 3' })).toBeInTheDocument();
    });

    it('foco vai ao primeiro campo ao abrir e volta ao botão ao cancelar ou salvar', async () => {
      const { admin } = await setupTestApi({ now: () => NOW });
      const user = userEvent.setup();
      renderPage(admin);
      await user.click(await screen.findByRole('button', { name: 'Editar Quadra 2' }));
      expect(screen.getByLabelText('Nome')).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Editar Quadra 2' })).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Marcar manutenção em Quadra 2' }));
      expect(screen.getByLabelText('Início')).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Marcar manutenção em Quadra 2' })).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Nova quadra' }));
      expect(screen.getByLabelText('Nome')).toHaveFocus();
      await user.type(screen.getByLabelText('Nome'), 'Quadra Foco');
      await user.click(screen.getByRole('button', { name: 'Salvar quadra' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Quadra salva.');
      expect(screen.getByRole('button', { name: 'Nova quadra' })).toHaveFocus();
    });
  });
});
