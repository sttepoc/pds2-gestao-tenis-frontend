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

  it('durante a recarga da mesma chave mantém os dados anteriores em previous', async () => {
    let finish!: (value: number) => void;
    let n = 0;
    const load = () => (++n === 1 ? Promise.resolve(1) : new Promise<number>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useLoad('a', load, vi.fn()));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 1 }));
    act(() => result.current.reload());
    expect(result.current.state).toEqual({ status: 'loading', previous: 1 });
    await act(async () => finish(2));
    expect(result.current.state).toEqual({ status: 'ready', data: 2 });
  });

  it('trocar a chave volta a carregando no mesmo render, sem dados da chave anterior', async () => {
    const { result, rerender } = renderHook(
      ({ k }) => useLoad(k, () => (k === 'a' ? Promise.resolve('primeira') : new Promise<string>(() => {})), vi.fn()),
      { initialProps: { k: 'a' } },
    );
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 'primeira' }));
    rerender({ k: 'b' });
    expect(result.current.state).toEqual({ status: 'loading' });
    expect(result.current.state).not.toHaveProperty('previous', 'primeira');
  });

  it('setData criado para uma chave é ignorado depois que a chave muda', async () => {
    const { result, rerender } = renderHook(
      ({ k }) => useLoad(k, async () => [k], vi.fn()),
      { initialProps: { k: 'a' } },
    );
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['a'] }));
    const setDataForA = result.current.setData;
    rerender({ k: 'b' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['b'] }));
    act(() => setDataForA((items) => [...items, 'atrasada']));
    act(() => setDataForA(['valor atrasado']));
    expect(result.current.state).toEqual({ status: 'ready', data: ['b'] });
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
