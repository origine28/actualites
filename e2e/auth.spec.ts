import { expect, test, type Page } from '@playwright/test';

const ADMIN = { username: 'e2e_admin', password: 'E2eAdminP@ss2026!' };
const USER = { username: 'e2e_user', password: 'E2eUserP@ss2026!' };

async function login(page: Page, creds: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel(/Nom d'utilisateur/).fill(creds.username);
  await page.getByLabel(/Mot de passe/).fill(creds.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe('Authentification (E2E)', () => {
  test('l accès à une zone protégée redirige vers /login sans session', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('flux complet ADMIN : connexion, espace admin, déconnexion', async ({ page }) => {
    await login(page, ADMIN);

    await expect(page.getByText('e2e_admin', { exact: true })).toBeVisible();
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Espace admin' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Espace ADMIN' })).toBeVisible();

    await page.getByRole('link', { name: 'Espace connecté' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('flux complet USER : connexion, accès admin refusé, déconnexion', async ({ page }) => {
    await login(page, USER);

    await expect(page.getByText('e2e_user', { exact: true })).toBeVisible();
    await expect(page.getByText('USER', { exact: true })).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByText('Accès refusé')).toBeVisible();

    await page.goto('/app');
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('identifiants invalides : message d erreur et pas de redirection', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Nom d'utilisateur/).fill('ghost');
    await page.getByLabel(/Mot de passe/).fill('mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toContainText('Identifiants invalides');
    await expect(page).toHaveURL(/\/login$/);
  });
});
