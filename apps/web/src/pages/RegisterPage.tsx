import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

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
        await register(email, password);
        await navigate('/dashboard', { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <main className="auth-page">
      <h1>Create your BizFlow account</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <label htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
