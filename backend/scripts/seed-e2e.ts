import 'dotenv/config';
import { prisma } from '../src/db/client.ts';
import { userRepository } from '../src/repositories/user.repository.ts';
import { hashPassword } from '../src/services/password.service.ts';

/**
 * Fixtures pour les tests E2E Playwright uniquement (jamais exposé en HTTP).
 * Crée/mets à jour un ADMIN et un USER de test, et purge leurs sessions pour
 * garantir un état propre.
 */
const FIXTURES = [
  { username: 'e2e_admin', email: 'e2e_admin@example.test', password: 'E2eAdminP@ss2026!', role: 'ADMIN' as const, first_name: 'E2E', last_name: 'Admin' },
  { username: 'e2e_user', email: 'e2e_user@example.test', password: 'E2eUserP@ss2026!', role: 'USER' as const, first_name: 'E2E', last_name: 'User' },
];

async function main(): Promise<void> {
  console.log('--- Seed E2E (fixtures Playwright) ---');
  for (const fixture of FIXTURES) {
    const passwordHash = await hashPassword(fixture.password);
    const existing = await userRepository.findByUsername(fixture.username);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: fixture.email,
          password_hash: passwordHash,
          role: fixture.role,
          status: 'ACTIVE',
          first_name: fixture.first_name,
          last_name: fixture.last_name,
          failed_login_attempts: 0,
          locked_until: null,
          deleted_at: null,
        },
      });
      await prisma.session.updateMany({ where: { user_id: existing.id }, data: { revoked_at: new Date() } });
      console.log(`- mis a jour : ${fixture.username}`);
    } else {
      await userRepository.create({
        username: fixture.username,
        email: fixture.email,
        password_hash: passwordHash,
        role: fixture.role,
        first_name: fixture.first_name,
        last_name: fixture.last_name,
      });
      console.log(`- cree : ${fixture.username}`);
    }
  }
  console.log('Seed E2E termine.');
}

main()
  .catch((err) => {
    console.error('Echec du seed E2E :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
