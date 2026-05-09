import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = {
  id: number;
  email: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });

    if (!response.ok) {
      setUser(null);
      return;
    }

    const data = await response.json();
    setUser(data.user ?? null);
  };

  useEffect(() => {
    async function boot() {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, []);

  const login = async (input: LoginInput) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = await response.json();
    setUser(data.user ?? null);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
