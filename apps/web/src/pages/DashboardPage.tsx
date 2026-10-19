import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div className="page-header">
          <div className="header-titles">
            <h1>Workspace Dashboard</h1>
            <p className="header-subtitle">Welcome back, {user?.email}</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginTop: '1rem',
          }}
        >
          <div className="table-wrapper" style={{ padding: '1.5rem' }}>
            <h3
              style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}
            >
              👥 Customer Management
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9375rem',
                marginBottom: '1.25rem',
              }}
            >
              Create, view, update, and manage your customers with strict workspace isolation and
              role permissions.
            </p>
            <Link to="/customers" className="btn btn-primary btn-sm">
              Manage Customers &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
