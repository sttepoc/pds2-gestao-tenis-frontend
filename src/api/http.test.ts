import { describe, expect, it, vi } from 'vitest';
import { request } from './http';

// fetch é a fronteira externa, então o stub é legítimo aqui.
describe('request', () => {
  it('converte 422 em ApiError com fieldErrors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Dados inválidos.', errors: { name: ['Obrigatório'] } }), {
            status: 422,
          }),
      ),
    );
    await expect(request('/x')).rejects.toMatchObject({
      status: 422,
      message: 'Dados inválidos.',
      fieldErrors: { name: ['Obrigatório'] },
    });
  });

  it('converte falha de rede em ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/x')).rejects.toMatchObject({ name: 'ApiError', status: 0 });
  });

  it('devolve o corpo JSON em sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(request('/x')).resolves.toEqual({ ok: true });
  });
});
