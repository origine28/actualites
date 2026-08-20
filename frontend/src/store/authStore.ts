import { create } from 'zustand';
import type { User } from '../types/auth.ts';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  setUser: (user) => set({ user, isAuthenticated: user !== null, loading: false }),
  clearAuth: () => set({ user: null, isAuthenticated: false, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
