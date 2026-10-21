import { useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { ApiError, login, type Session } from '../api/auth';

type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Informe seu e-mail.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  if (!password) errors.password = 'Informe sua senha.';
  return errors;
}

type Props = {
  onLogin: (session: Session) => void;
  notice?: string;
};

export function LoginForm({ onLogin, notice }: Props) {
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  // isPending volta a false sozinho quando a chamada termina, com sucesso ou erro.
  const [submitting, startSubmit] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(email, password);
    setErrors(found);
    setFormError('');
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    startSubmit(async () => {
      try {
        onLogin(await login(email.trim(), password));
      } catch (error) {
        showApiError(error instanceof ApiError ? error : new ApiError('Algo deu errado. Tente de novo.', 0));
      }
    });
  }

  function showApiError(apiError: ApiError) {
    const { email: emailErrors, password: passwordErrors } = apiError.fieldErrors;
    if (apiError.status === 422 && (emailErrors || passwordErrors)) {
      setErrors({
        email: emailErrors ? 'Informe um e-mail válido, como nome@exemplo.com.' : undefined,
        password: passwordErrors?.[0],
      });
      (emailErrors ? emailRef : passwordRef).current?.focus();
      return;
    }
    setFormError(apiError.message);
    if (apiError.status === 401) {
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  const emailErrorId = `${id}-email-error`;
  const passwordErrorId = `${id}-password-error`;

  return (
    <form className="card login-card" onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="card-title">
        Acesse sua conta
      </h2>

      {notice && !formError && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {formError && (
        <p className="alert" role="alert">
          {formError}
        </p>
      )}

      <div className="field">
        <label htmlFor={`${id}-email`}>E-mail</label>
        <input
          ref={emailRef}
          id={`${id}-email`}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? emailErrorId : undefined}
          maxLength={254}
        />
        {errors.email && (
          <p id={emailErrorId} className="field-error">
            {errors.email}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-password`}>Senha</label>
        <div className="password">
          <input
            ref={passwordRef}
            id={`${id}-password`}
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            maxLength={128}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
            aria-controls={`${id}-password`}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
            <span className="visually-hidden"> senha</span>
          </button>
        </div>
        {errors.password && (
          <p id={passwordErrorId} className="field-error">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit" className="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? (
          <>
            <span className="rally" aria-hidden="true" />
            Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </button>

      <p className="card-help">
        Não consegue entrar?<br />
        Fale com a secretaria do clube.
      </p>
    </form>
  );
}
