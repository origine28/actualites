import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';

describe('GET /api/health', () => {
  it('retourne 200 avec { status: "ok" }', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('est accessible sans authentification', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
