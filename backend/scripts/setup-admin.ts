import 'dotenv/config';
import { stdin, stdout } from 'node:process';
import { prisma } from '../src/db/client.ts';
import { userRepository } from '../src/repositories/user.repository.ts';
import { hashPassword } from '../src/services/password.service.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AskOptions {
  mask?: boolean;
  validate?: (value: string) => string | null;
}

function ask(question: string, options: AskOptions = {}): Promise<string> {
  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw;
    const useRaw = options.mask === true && stdin.isTTY;
    if (useRaw) {
      try {
        stdin.setRawMode(true);
      } catch {
        stdout.write('\n');
      }
    }

    stdout.write(question);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (useRaw) {
        try {
          stdin.setRawMode(wasRaw);
        } catch {
          /* non-TTY */
        }
      }
      stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          cleanup();
          stdout.write('\n');
          process.exit(130);
        } else if (ch === '\r' || ch === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(buf.trim());
        } else if (ch === '\u007f' || ch === '\b') {
          buf = buf.slice(0, -1);
          if (options.mask) stdout.write('\b \b');
        } else {
          buf += ch;
          if (options.mask) stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function askValidated(question: string, options: AskOptions = {}): Promise<string> {
  for (;;) {
    const value = await ask(question, options);
    const error = options.validate ? options.validate(value) : null;
    if (!error) return value;
    console.error(`  Erreur : ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('--- Bootstrap du premier administrateur ---\n');

  console.log('1/4 Verification de PostgreSQL...');
  await prisma.$queryRaw`SELECT 1`;

  console.log('2/4 Verification des administrateurs existants...');
  const existing = await userRepository.findFirstAdmin();
  if (existing) {
    console.error(
      `\nUn compte ADMIN existe deja (${existing.username}).\n` +
        'Refus de creation automatique : l ADMIN existant n est jamais modifie ni supprime.\n',
    );
    process.exit(1);
  }

  console.log('3/4 Saisie des informations...\n');
  const username = await askValidated(
    'Nom d utilisateur : ',
    {
      validate: (v) =>
        v.length < 3
          ? 'au moins 3 caracteres'
          : v.length > 32
            ? 'au maximum 32 caracteres'
            : null,
    },
  );

  const email = await askValidated('Email : ', {
    validate: (v) => (EMAIL_RE.test(v) ? null : 'adresse email invalide'),
  });

  const firstName = await askValidated('Prenom : ', {
    validate: (v) => (v.length > 0 ? null : 'prenom requis'),
  });

  const lastName = await askValidated('Nom : ', {
    validate: (v) => (v.length > 0 ? null : 'nom requis'),
  });

  const password = await askValidated('Mot de passe : ', {
    mask: true,
    validate: (v) => (v.length >= 8 ? null : 'au moins 8 caracteres'),
  });

  const confirmation = await ask('Confirmation du mot de passe : ', { mask: true });
  if (password !== confirmation) {
    console.error('\nErreur : les mots de passe ne correspondent pas.');
    process.exit(1);
  }

  const normalizedUsername = username.toLowerCase();

  const existingUsername = await userRepository.findByUsername(normalizedUsername);
  if (existingUsername) {
    console.error(`\nErreur : le nom d utilisateur "${normalizedUsername}" est deja pris.`);
    process.exit(1);
  }
  const existingEmail = await userRepository.findByEmail(email.toLowerCase());
  if (existingEmail) {
    console.error(`\nErreur : l email "${email}" est deja utilise.`);
    process.exit(1);
  }

  console.log('\n4/4 Creation du compte...');
  const passwordHash = await hashPassword(password);
  const admin = await userRepository.create({
    username: normalizedUsername,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    role: 'ADMIN',
    first_name: firstName,
    last_name: lastName,
  });

  console.log(`\nAdministrateur cree avec succes : ${admin.username} (role ${admin.role}, statut ${admin.status}).`);
  console.log('Connectez-vous sur /login.');
}

main()
  .catch((err) => {
    console.error('Echec du bootstrap :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
