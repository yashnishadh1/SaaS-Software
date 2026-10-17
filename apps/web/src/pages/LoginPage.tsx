import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    void (async () => {
      try {
        await login(email, password);
        await navigate(from, { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <main className="auth-page">
      <h1>Sign in to BizFlow</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p>
        Don&apos;t have an account? <Link to="/register">Create one</Link>
      </p>
    </main>
  );
}
