import 'dotenv/config';
import { prisma } from '../src/db/client.ts';
import { userRepository } from '../src/repositories/user.repository.ts';
import { hashPassword } from '../src/services/password.service.ts';

const DEMO_USERS = [
  { username: 'demo_user', email: 'demo_user@demo.test', password: 'DemoUser1!', role: 'USER' as const, first_name: 'Demo', last_name: 'Utilisateur' },
  { username: 'demo_admin', email: 'demo_admin@demo.test', password: 'DemoAdmin1!', role: 'ADMIN' as const, first_name: 'Demo', last_name: 'Admin' },
];

async function main(): Promise<void> {
  console.log('--- Seed Demo V0.1 ---');

  console.log('1/5 Verification PostgreSQL...');
  await prisma.$queryRaw`SELECT 1`;

  console.log('2/5 Creation des comptes...');
  for (const u of DEMO_USERS) {
    const hash = await hashPassword(u.password);
    const existing = await userRepository.findByUsername(u.username);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: u.email,
          password_hash: hash,
          role: u.role,
          status: 'ACTIVE',
          first_name: u.first_name,
          last_name: u.last_name,
          failed_login_attempts: 0,
          locked_until: null,
          deleted_at: null,
        },
      });
      await prisma.session.updateMany({ where: { user_id: existing.id }, data: { revoked_at: new Date() } });
      console.log(`  - mis a jour : ${u.username}`);
    } else {
      await userRepository.create({
        username: u.username,
        email: u.email,
        password_hash: hash,
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      });
      console.log(`  - cree : ${u.username}`);
    }
  }

  console.log('3/5 Creation des categories...');
  const categoryData = [
    { name: 'Technologie', slug: 'technologie', sort_order: 1 },
    { name: 'Sciences', slug: 'sciences', sort_order: 2 },
    { name: 'Economie', slug: 'economie', sort_order: 3 },
  ];
  const categoryIds: string[] = [];
  for (const c of categoryData) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (existing) {
      categoryIds.push(existing.id);
      console.log(`  - existe : ${c.name}`);
    } else {
      const created = await prisma.category.create({ data: { ...c, status: 'ACTIVE' } });
      categoryIds.push(created.id);
      console.log(`  - creee : ${c.name}`);
    }
  }

  console.log('4/5 Creation des tags...');
  const tagData = [
    { name: 'React', slug: 'react' },
    { name: 'Node.js', slug: 'nodejs' },
    { name: 'PostgreSQL', slug: 'postgresql' },
    { name: 'Securite', slug: 'securite' },
  ];
  const tagIds: string[] = [];
  for (const t of tagData) {
    const existing = await prisma.tag.findUnique({ where: { slug: t.slug } });
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const created = await prisma.tag.create({ data: t });
      tagIds.push(created.id);
      console.log(`  - cree : ${t.name}`);
    }
  }

  console.log('5/5 Creation des articles...');
  const admin = await userRepository.findByUsername('demo_admin');
  const adminId = admin?.id;

  const articleData = [
    {
      title: 'Bienvenue sur la plateforme NEWS',
      slug: 'bienvenue-plateforme-news',
      summary: 'Decouvrez notre nouvelle plateforme d\'actualites avec administration complete.',
      content: '<h2>Bienvenue</h2><p>Cette plateforme d\'actualites permet de gerer des articles, des telechargements, des medias et bien plus.</p><p>Fonctionnalites principales :</p><ul><li>Gestion complete des articles (creation, modification, publication, archivage)</li><li>Systeme de categories et tags</li><li>Telechargements (PDF, applications mobiles/desktops)</li><li>Administration securisee</li><li>Formulaire de contact avec moderation</li></ul>',
      status: 'PUBLISHED' as const,
      categoryIdx: 0,
      tagIdxs: [0, 3],
    },
    {
      title: 'Nouvelles fonctionnalites securite',
      slug: 'nouvelles-fonctionnalites-securite',
      summary: 'Presentation des mesures de securite implementees dans la plateforme.',
      content: '<h2>Securite renforcee</h2><p>Notre plateforme integre les protections suivantes :</p><ul><li>Authentification Argon2id</li><li>Sessions serveur avec cookies httpOnly</li><li>Protection CSRF double-submit</li><li>CSP Helmet personnalisee</li><li>Rate limiting global et par route</li><li>Audit complet des actions</li></ul>',
      status: 'PUBLISHED' as const,
      categoryIdx: 0,
      tagIdxs: [3],
    },
    {
      title: 'Brouillon : article en cours de redaction',
      slug: 'brouillon-article-cours',
      summary: 'Cet article est en cours de redaction.',
      content: '<p>Contenu en cours de preparation...</p>',
      status: 'DRAFT' as const,
      categoryIdx: 1,
      tagIdxs: [],
    },
  ];

  for (const a of articleData) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (!existing && adminId) {
      const article = await prisma.article.create({
        data: {
          title: a.title,
          slug: a.slug,
          summary: a.summary,
          content: a.content,
          status: a.status,
          language: 'fr',
          author_id: adminId,
          category_id: categoryIds[a.categoryIdx] ?? null,
          published_at: a.status === 'PUBLISHED' ? new Date() : null,
        },
      });
      if (a.tagIdxs.length > 0) {
        await prisma.articleTag.createMany({
          data: a.tagIdxs.map((ti) => ({ article_id: article.id, tag_id: tagIds[ti] })),
        });
      }
      console.log(`  - article cree : ${a.title} (${a.status})`);
    } else {
      console.log(`  - article existe : ${a.title}`);
    }
  }

  console.log('Seed Demo V0.1 termine.');
  console.log('');
  console.log('Comptes de demonstration :');
  console.log('  USER  : demo_user / DemoUser1!');
  console.log('  ADMIN : demo_admin / DemoAdmin1!');
}

main()
  .catch((err) => {
    console.error('Echec du seed demo :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
