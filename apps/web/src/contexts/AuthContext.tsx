import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Auth context
//
// Provides the current Firebase user and helper functions.
// IMPORTANT: This context is for UI state only.
// The API enforces all permissions server-side — never trust this context for
// security decisions on the server.
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      throw err;
    }
  };

  const register = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
    setUser(null);
  };

  const getIdToken = async (): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken(/* forceRefresh= */ false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
