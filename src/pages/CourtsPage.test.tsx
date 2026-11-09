import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../api/types';
import { listCourts } from '../api/courts';
import { setupTestApi } from '../test/api';
import { CourtsPage } from './CourtsPage';

function renderPage(session: Session, status: 'allowed' | 'denied' | 'checking' = 'allowed') {
  const onExpired = vi.fn();
  const onRetry = vi.fn();
  const view = render(<CourtsPage session={session} access={{ status }} onRetry={onRetry} onExpired={onExpired} />);
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
    expect(await screen.findByRole('heading', { name: 'Quadra Central' })).toBeInTheDocument();
    expect(screen.getAllByText('Saibro').length).toBeGreaterThan(0);
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
});
