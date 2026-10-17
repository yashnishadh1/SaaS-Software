import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    void logout();
  };

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.email}</p>
      <button onClick={handleLogout} type="button">
        Sign out
      </button>
    </main>
  );
}
