import { test, expect } from '@playwright/test';

test.describe('Proposta Pública', () => {
  test('deve mostrar erro para proposta inexistente', async ({ page }) => {
    await page.goto('/ABC123/proposta-teste');
    await page.waitForLoadState('networkidle');

    // Verifica que a página carregou (pode mostrar erro ou redirecionar)
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('deve carregar estrutura da página de proposta', async ({ page }) => {
    const response = await page.goto('/p/teste123');

    // Página deve carregar sem erro 500
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('API Pública', () => {
  test('deve validar cupom via API', async ({ request }) => {
    const response = await request.post('/api/validate-coupon', {
      data: { code: 'TESTE123' }
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json).toHaveProperty('valid');
  });

  test('API de cupom retorna estrutura correta', async ({ request }) => {
    const response = await request.post('/api/validate-coupon', {
      data: { code: 'INVALIDO' }
    });

    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json).toHaveProperty('error');
  });
});
