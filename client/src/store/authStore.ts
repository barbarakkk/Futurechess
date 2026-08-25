import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  userCode: string;
  role: "player" | "coach";
  createdAt: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      // Patches just the user object — used to refresh role/profile fields (e.g. after a
      // coach application is approved) without touching the token.
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: "futurechess-auth" },
  ),
);
