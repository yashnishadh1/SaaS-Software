import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    void (async () => {
      try {
        await logout();
        await navigate('/login', { replace: true });
      } catch {
        // error handled in auth context
      }
    })();
  };

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <NavLink to="/dashboard" className="nav-brand">
          BizFlow
        </NavLink>
        <nav className="nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/customers"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Customers
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Tasks
          </NavLink>
        </nav>
      </div>

      <div className="nav-actions">
        {user?.email && <span className="user-badge">{user.email}</span>}
        <button type="button" onClick={handleLogout} className="btn btn-secondary btn-sm">
          Sign out
        </button>
      </div>
    </header>
  );
}
