import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/error';
import { useLoad } from './useLoad';

describe('useLoad', () => {
  it('entrega os dados carregados', async () => {
    const { result } = renderHook(() => useLoad('a', async () => 5, vi.fn()));
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 5 }));
  });

  it('chama onExpired quando a carga recebe 401', async () => {
    const onExpired = vi.fn();
    const load = () => Promise.reject(new ApiError('x', 401));
    const { result } = renderHook(() => useLoad('a', load, onExpired));
    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(result.current.state).toEqual({ status: 'loading' });
  });

  it('mostra a mensagem do ApiError no estado de erro', async () => {
    const load = () => Promise.reject(new ApiError('Quadra indisponível.', 500));
    const { result } = renderHook(() => useLoad('a', load, vi.fn()));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: 'Quadra indisponível.' }));
  });

  it('ignora resposta antiga quando key muda', async () => {
    let resolveFirst!: (value: string) => void;
    const first = new Promise<string>((resolve) => { resolveFirst = resolve; });
    const onExpired = vi.fn();
    const { result, rerender } = renderHook(
      ({ k }) => useLoad(k, () => (k === 'a' ? first : Promise.resolve('segunda')), onExpired),
      { initialProps: { k: 'a' } },
    );
    rerender({ k: 'b' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 'segunda' }));
    await act(async () => { resolveFirst('primeira'); await first; });
    expect(result.current.state).toEqual({ status: 'ready', data: 'segunda' });
  });

  it('reload carrega de novo e setData troca o dado', async () => {
    let n = 0;
    const load = async () => ++n;
    const { result } = renderHook(() => useLoad('a', load, vi.fn()));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 1 }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 2 }));
    act(() => result.current.setData(9));
    expect(result.current.state).toEqual({ status: 'ready', data: 9 });
  });

  it('setData aceita função aplicada aos dados atuais e ignora se não estiver pronto', async () => {
    const { result } = renderHook(() => useLoad('a', async () => 5, vi.fn()));
    act(() => result.current.setData((value) => value + 1));
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 5 }));
    act(() => result.current.setData((value) => value + 1));
    act(() => result.current.setData((value) => value * 10));
    expect(result.current.state).toEqual({ status: 'ready', data: 60 });
  });
});
