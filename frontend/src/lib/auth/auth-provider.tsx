"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, setAccessToken } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import type { User } from "@/types/commerce";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  setUser: (user: User) => void;
  /** Resolves `{ serverRevoked: false }` if the server call failed — local
   * session state is always cleared either way, but callers should tell the
   * user the server session may still be live if this comes back false. */
  logout: () => Promise<{ serverRevoked: boolean }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Restores the session on first load by attempting a silent refresh against
 * the httpOnly refresh cookie — the access token itself only ever lives in
 * memory (see `client.ts`), so a hard reload always starts with none.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.post<{ accessToken: string; user: User }>("/auth/refresh");
        if (cancelled) return;
        setAccessToken(response.data.accessToken);
        setUserState(response.data.user);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setUserState(null);
        setStatus("unauthenticated");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = useCallback((nextUser: User) => {
    setUserState(nextUser);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    // Always drop local session state, even if the network call fails below
    // — the UI must never keep showing a signed-in state once the user has
    // asked to sign out, regardless of whether the server confirmed it.
    let serverRevoked = true;
    try {
      await authApi.logout();
    } catch {
      serverRevoked = false;
    } finally {
      setUserState(null);
      setStatus("unauthenticated");
    }
    return { serverRevoked };
  }, []);

  const value = useMemo(
    () => ({ user, status, setUser, logout }),
    [user, status, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
