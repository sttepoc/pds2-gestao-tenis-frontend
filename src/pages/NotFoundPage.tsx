import { routePaths } from '../navigation';

export function NotFoundPage() {
  return (
    <section className="content-panel empty-panel">
      <p className="eyebrow">PÁGINA NÃO ENCONTRADA</p>
      <h1>Esse caminho ficou fora da quadra.</h1>
      <p>Use a navegação para encontrar o que procura.</p>
      <a className="text-link" href={routePaths.home}>
        Voltar ao início <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
