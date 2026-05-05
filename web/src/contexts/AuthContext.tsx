import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import * as auth from "@/lib/auth";
import type { User } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => User | null;
  logout: () => void;
  updateUser: (updated: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => auth.getCurrentUser());

  const login = useCallback((email: string, password: string): User | null => {
    const u = auth.loginUser(email, password);
    if (u) setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    auth.setCurrentUserId(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updated: User) => {
    auth.updateUser(updated);
    setUser((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
