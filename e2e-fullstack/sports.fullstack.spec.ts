import { test, expect, request } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';

/**
 * Tests E2E Full-Stack para la entidad Sport (Deportes).
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * Cada test empieza desde un estado limpio gracias al beforeEach que hace
 * TRUNCATE de todas las tablas, garantizando aislamiento total entre casos.
 */

const API_BASE_URL = 'http://localhost:3001';

const SPORT_PAYLOAD = {
  name: 'Tenis E2E',
  description: 'Deporte de raqueta para pruebas E2E',
  max_capacity: 20,
  additional_price: 500,
  requires_medical_certificate: false,
};

async function createSportViaApi(
  overrides: Partial<typeof SPORT_PAYLOAD> = {},
): Promise<{ id: string; name: string }> {
  const apiContext = await request.newContext({ baseURL: API_BASE_URL });

  try {
    const response = await apiContext.post('/api/v1/sports', {
      data: { ...SPORT_PAYLOAD, ...overrides },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    return body.data;
  } finally {
    await apiContext.dispose();
  }
}

test.describe('Sports Full-Stack E2E', () => {
  test.beforeEach(async () => {
    await truncateAllTables();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Estado vacío
  // Verifica que la vista muestra el mensaje correcto cuando no hay deportes
  // en la DB (condición garantizada por el truncateAllTables del beforeEach).
  // ─────────────────────────────────────────────────────────────────────────
  test('debe mostrar el estado vacío cuando no hay deportes activos en la DB', async ({ page }) => {
    await page.goto('/sports');

    await expect(
      page.getByText('No hay deportes activos en el catálogo.'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Crear deporte desde UI
  // Completa el formulario de alta, confirma el cierre del modal y verifica
  // que la fila aparece en la tabla con todos los valores correctos.
  // ─────────────────────────────────────────────────────────────────────────
  test('debe crear un deporte real desde la UI y mostrarlo en el catálogo', async ({ page }) => {
    await page.goto('/sports');

    await page.getByRole('button', { name: /Agregar Deporte/i }).click();
    await expect(page.getByText('Registrar nuevo deporte')).toBeVisible();

    // Acotar todos los inputs al modal para evitar strict mode violations
    const dialog = page.getByRole('dialog');

    await dialog.getByPlaceholder('Ej: Natación').fill(SPORT_PAYLOAD.name);
    await dialog.getByPlaceholder('Breve descripción del deporte').fill(SPORT_PAYLOAD.description);
    await dialog.getByLabel('Cupo máximo').fill(String(SPORT_PAYLOAD.max_capacity));
    await dialog.getByLabel('Precio adicional').fill(String(SPORT_PAYLOAD.additional_price));
    // El checkbox de "Requiere certificado médico" inicia en false por defecto; no se modifica

    await dialog.getByRole('button', { name: 'Crear deporte' }).click();

    // Esperar que el modal se cierre y aparezca el mensaje de éxito
    await expect(page.getByText('Registrar nuevo deporte')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Deporte registrado correctamente.')).toBeVisible({ timeout: 10000 });

    // Verificar que la fila aparece con los valores correctos en todas las columnas
    const row = page.getByRole('row').filter({ hasText: SPORT_PAYLOAD.name });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(SPORT_PAYLOAD.description);
    await expect(row).toContainText('20');
    await expect(row).toContainText('$500.00');
    await expect(row).toContainText('No');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Editar deporte desde UI
  // Crea el deporte vía API directa para no depender de la UI de alta,
  // luego edita descripción, cupo, precio y certificado desde el modal.
  // ─────────────────────────────────────────────────────────────────────────
  test('debe editar un deporte existente y reflejar los cambios en el catálogo', async ({ page }) => {
    // Crear el deporte con nombre único para este test
    await createSportViaApi({ name: 'Tenis E2E Edición' });

    await page.goto('/sports');

    const row = page.getByRole('row').filter({ hasText: 'Tenis E2E Edición' });
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.getByRole('button', { name: /Editar/i }).click();
    await expect(page.getByText('Editar deporte')).toBeVisible();

    const dialog = page.getByRole('dialog');

    // El campo Nombre es readOnly; se verifica su presencia pero no se modifica
    await expect(dialog.locator('input[readonly]')).toHaveValue('Tenis E2E Edición');

    await dialog.getByPlaceholder('Breve descripción del deporte').fill('Descripción actualizada desde E2E');
    await dialog.getByLabel('Cupo máximo').fill('30');
    await dialog.getByLabel('Precio adicional').fill('750.5');
    // Chakra UI Field no asocia htmlFor al checkbox nativo; se apunta directamente
    await dialog.locator('input[type="checkbox"]').check();

    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();

    // Esperar cierre del modal y mensaje de éxito
    await expect(page.getByText('Editar deporte')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Deporte actualizado correctamente.')).toBeVisible({ timeout: 10000 });

    // Verificar que la fila refleja los nuevos valores
    const updatedRow = page.getByRole('row').filter({ hasText: 'Tenis E2E Edición' });
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(updatedRow).toContainText('Descripción actualizada desde E2E');
    await expect(updatedRow).toContainText('30');
    await expect(updatedRow).toContainText('$750.50');
    await expect(updatedRow).toContainText('Sí');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Baja lógica desde UI
  // Crea el deporte vía API, confirma el dialog nativo del navegador y
  // verifica que el deporte desaparece del listado operativo (soft delete).
  // ─────────────────────────────────────────────────────────────────────────
  test('debe dar de baja un deporte y excluirlo del catálogo activo', async ({ page }) => {
    // Crear el deporte con nombre único para este test
    await createSportViaApi({ name: 'Tenis E2E Baja' });

    await page.goto('/sports');

    const row = page.getByRole('row').filter({ hasText: 'Tenis E2E Baja' });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Registrar el handler ANTES del click para no perder el evento del dialog nativo
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Tenis E2E Baja');
      await dialog.accept();
    });

    await row.getByRole('button', { name: /Dar de baja/i }).click();

    await expect(page.getByText('Deporte dado de baja correctamente.')).toBeVisible({ timeout: 10000 });
    await expect(row).toBeHidden({ timeout: 10000 });
    // La vista debe mostrar el estado vacío al no quedar deportes activos
    await expect(page.getByText('No hay deportes activos en el catálogo.')).toBeVisible({ timeout: 10000 });
  });
});
