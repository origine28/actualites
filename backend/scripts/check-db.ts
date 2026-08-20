import 'dotenv/config';
import { prisma } from '../src/db/client.ts';

const count = await prisma.systemInfo.count();
console.log(`[db] Connexion PostgreSQL OK — modeles visibles : systemInfo (count=${count})`);
await prisma.$disconnect();
