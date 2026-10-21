import { MOCK_SCENARIO } from '../api/config';

export function MockNotice() {
  return (
    <aside className="mock-notice" aria-label="Ambiente de desenvolvimento">
      <details>
        <summary><strong>Desenvolvimento · dados simulados</strong></summary>
        <p>Administrador: <code>admin@clube.example</code><br />
          Usuário comum: <code>usuario@clube.example</code><br />
          Senha das duas contas: <code>SenhaSegura123</code></p>
        <p>Cenário: <code>{MOCK_SCENARIO}</code>. Configure o modo no arquivo .env.local.</p>
      </details>
    </aside>
  );
}
