import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('npm run seed:e2e --workspace @news/backend', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}
