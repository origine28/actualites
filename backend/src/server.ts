import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { ensureStorageDirs } from './utils/storage.ts';

ensureStorageDirs(env.STORAGE_ROOT);

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  console.log(`[backend] API ecoute sur http://${env.HOST}:${env.PORT}`);
});
