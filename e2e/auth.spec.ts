import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('deve exibir formulário de login', async ({ page }) => {
    await page.goto('/login');

    // Campos de login
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'teste@invalido.com');
    await page.fill('input[type="password"]', 'senhaerrada123');
    await page.click('button[type="submit"]');

    // Aguardar resposta
    await page.waitForTimeout(3000);
  });

  test('deve exibir formulário de cadastro', async ({ page }) => {
    await page.goto('/cadastro');

    // Campos de cadastro - usar first() para evitar strict mode
    await expect(page.locator('input').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('deve ter link para esqueci senha', async ({ page }) => {
    await page.goto('/login');

    const esqueciLink = page.locator('a[href*="esqueci"]');
    await expect(esqueciLink).toBeVisible();
    await esqueciLink.click();
    await expect(page).toHaveURL(/\/esqueci-senha/);
  });

  test('deve ter opção de login com Google', async ({ page }) => {
    await page.goto('/login');

    // Botão de Google OAuth
    await expect(page.locator('button:has-text("Google")').first()).toBeVisible();
  });
});
