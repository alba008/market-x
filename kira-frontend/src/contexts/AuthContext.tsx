import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "urql";
import { clearTokens, getAccess, getRefresh, setTokens, hasTokens } from "../auth/tokens";

type AuthUser = { id: string; username: string; email: string };

type AuthCtx = {
  user: AuthUser | null;
  isAuthed: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

const ME_QUERY = `
query Me { me { id username email } }
`;

const LOGIN_MUT = `
mutation Login($username: String!, $password: String!) {
  login(username: $username, password: $password) {
    user { id username email }
    tokens { access refresh }
  }
}
`;

const REGISTER_MUT = `
mutation Register($username: String!, $email: String!, $password: String!) {
  register(username: $username, email: $email, password: $password) {
    user { id username email }
    tokens { access refresh }
  }
}
`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [{ data }, reexecMe] = useQuery({
    query: ME_QUERY,
    pause: !hasTokens(),
    requestPolicy: "cache-and-network",
  });

  const [, loginMut] = useMutation(LOGIN_MUT);
  const [, registerMut] = useMutation(REGISTER_MUT);

  useEffect(() => {
    if (data?.me) setUser(data.me);
  }, [data]);

  async function login(username: string, password: string) {
    const res = await loginMut({ username, password });
    const payload = res.data?.login;
    if (!payload?.tokens?.access) throw new Error(res.error?.message || "Login failed");
    setTokens(payload.tokens.access, payload.tokens.refresh);
    setUser(payload.user);
    reexecMe({ requestPolicy: "network-only" });
  }

  async function register(username: string, email: string, password: string) {
    const res = await registerMut({ username, email, password });
    const payload = res.data?.register;
    if (!payload?.tokens?.access) throw new Error(res.error?.message || "Register failed");
    setTokens(payload.tokens.access, payload.tokens.refresh);
    setUser(payload.user);
    reexecMe({ requestPolicy: "network-only" });
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthed: Boolean(user) || Boolean(getAccess() && getRefresh()),
      login,
      register,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
