import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Base de données partagée : les fichiers de tests s'exécutent
    // séquentiellement pour éviter toute course entre fixtures.
    fileParallelism: false,
  },
});
