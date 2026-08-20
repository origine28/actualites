import { afterEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { makeUser } from '../helpers.ts';
import { getMe, logout } from '../../src/services/api.ts';
import { useAuthStore } from '../../src/store/authStore.ts';

function rejectAdapter(status: number): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    throw Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      config,
      response: {
        status,
        statusText: 'Error',
        data: {},
        headers: {},
        config,
      },
    });
  };
}

function resolveAdapter(): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => ({
    data: { user: makeUser() },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

describe('client API (intercepteurs)', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setLoading(true);
  });

  it('une réponse 401 vide l état d authentification', async () => {
    useAuthStore.getState().setUser(makeUser());
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const api = (await import('../../src/services/api.ts')).default;
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = rejectAdapter(401);

    try {
      await expect(getMe()).rejects.toBeTruthy();
    } finally {
      api.defaults.adapter = originalAdapter;
    }

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("une réponse réussie de /me remplit le store", async () => {
    const api = (await import('../../src/services/api.ts')).default;
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = resolveAdapter();

    try {
      const me = await getMe();
      useAuthStore.getState().setUser(me);
    } finally {
      api.defaults.adapter = originalAdapter;
    }

    expect(useAuthStore.getState().user?.username).toBe('alice');
  });

  it('logout est exposé par le client API', async () => {
    const api = (await import('../../src/services/api.ts')).default;
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async () => ({
      data: '',
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    });

    try {
      await expect(logout()).resolves.toBeUndefined();
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });
});
