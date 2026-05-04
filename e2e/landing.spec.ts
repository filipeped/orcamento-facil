import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('deve carregar a página inicial', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/JARDINEI/);
  });

  test('deve exibir seções principais', async ({ page }) => {
    await page.goto('/');

    // Hero - verifica que tem conteúdo
    await expect(page.locator('h1').first()).toBeVisible();

    // CTA principal - pelo menos um link de cadastro
    await expect(page.locator('a[href="/cadastro"]').first()).toBeVisible();
  });

  test('deve navegar para login', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/login"]').first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('deve navegar para cadastro', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/cadastro"]').first().click();
    await expect(page).toHaveURL(/\/cadastro/);
  });
});
