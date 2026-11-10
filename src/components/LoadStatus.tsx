import { routePaths } from '../navigation';

/** Linha de "carregando" com a bolinha animada; anunciada por leitores de tela. */
export function Loading({ children }: { children: string }) {
  return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />{children}</p>;
}

/** Erro de carga com o botão para tentar de novo. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="access-feedback">
      <p className="alert" role="alert">{message}</p>
      <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
}

/** Reserva que não abriu: erro de carga (com nova tentativa) ou inexistente. */
export function BookingUnavailable({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <>
      <section className="content-panel empty-panel">
        {error === undefined ? (
          <>
            <h1>Reserva não encontrada</h1>
            <p>Ela pode ter sido removida ou não ser sua.</p>
          </>
        ) : (
          <>
            <h1>Não foi possível abrir a reserva</h1>
            <p className="alert" role="alert">{error}</p>
            <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button>
          </>
        )}
      </section>
      <BackToBookings />
    </>
  );
}

export function BackToBookings() {
  return <a className="text-link" href={routePaths.bookings}><span aria-hidden="true">←</span> Minhas reservas</a>;
}
