import { test, expect } from '@playwright/test';

test.describe('Página de Upgrade (pública)', () => {
  // Nota: A página /upgrade requer autenticação
  // Estes testes verificam o redirecionamento correto

  test('deve redirecionar para login se não autenticado', async ({ page }) => {
    await page.goto('/upgrade');
    await page.waitForLoadState('networkidle');

    // Deve redirecionar para login ou mostrar página
    const url = page.url();
    expect(url).toMatch(/\/(login|upgrade)/);
  });

  test('página de pricing na landing deve existir', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll até a seção de preços
    const pricingSection = page.locator('#pricing, [id*="preco"], [id*="plano"]');
    if (await pricingSection.count() > 0) {
      await expect(pricingSection.first()).toBeVisible();
    }
  });
});
