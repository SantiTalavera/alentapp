import { test, expect } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';

/**
 * Tests E2E Full-Stack para la entidad Payment (Pagos).
 * NO mockea la red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db) corriendo en Docker.
 *
 * Los tests se ejecutan de manera SECUENCIAL y limpia en cada suite.
 */

test.describe('Payments Full-Stack E2E', () => {

  // Limpiamos la base de datos antes de comenzar la suite de tests
  test.beforeAll(async () => {
    await truncateAllTables();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [1] Flujo completo de cobro
  // ─────────────────────────────────────────────────────────────────────────
  test('[1] Flujo completo de cobro: crear un pago → marcar como pagado → verificar en tabla', async ({ page }) => {
    // 1. Crear socio a través de la UI para poder registrarle pagos
    await page.goto('/members');
    await page.getByRole('button', { name: /Agregar Miembro/i }).click();
    await expect(page.getByText('Agregar Nuevo Miembro')).toBeVisible();

    const memberName = 'Socio Pagos E2E';
    await page.getByPlaceholder('Ej. Juan Pérez').fill(memberName);
    await page.getByPlaceholder('Ej. 12345678').fill('11223344');
    await page.getByPlaceholder('ejemplo@correo.com').fill('pago.socio@e2e.com');
    await page.getByLabel(/Fecha de Nacimiento/i).fill('1990-05-10');
    await page.getByRole('button', { name: 'Crear Miembro' }).click();

    // Confirmar que el socio se creó correctamente en la tabla de miembros
    await expect(page.getByText(memberName)).toBeVisible({ timeout: 10000 });

    // 2. Crear un Pago Pendiente desde la UI de Miembros para este socio
    const memberRow = page.getByRole('row').filter({ hasText: memberName });
    await memberRow.getByRole('button', { name: /Registrar pago/i }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeVisible();

    // Completar el formulario de registro de pago
    await page.getByPlaceholder('Ej. 1500.50').fill('3500');
    await page.getByPlaceholder('Ej. 5').fill('6'); // Mes 6
    await page.getByPlaceholder('Ej. 2026').fill('2026'); // Año 2026
    await page.getByLabel(/Fecha de Vencimiento/i).fill('2026-06-30');

    // Manejar el alert que se muestra al registrar el pago exitosamente
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Pago registrado correctamente');
      await dialog.accept();
    });

    // Enviar formulario
    await page.getByRole('button', { name: 'Registrar Pago' }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeHidden();

    // 3. Ir a la vista de pagos para gestionarlo
    await page.goto('/payments');

    // Verificar que el pago aparece en la tabla con estado Pendiente y monto correcto
    const paymentRow = page.getByRole('row').filter({ hasText: memberName });
    await expect(paymentRow).toBeVisible({ timeout: 10000 });
    await expect(paymentRow.getByText('Pendiente')).toBeVisible();
    await expect(paymentRow.getByText('$3500.00')).toBeVisible();

    // 4. Marcar como pagado (Cobrar)
    // El componente muestra un window.confirm para reconfirmar la acción
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('¿Está seguro de marcar este pago como cobrado?');
      await dialog.accept();
    });

    await paymentRow.getByRole('button', { name: 'Cobrar' }).click();

    // Verificar que el badge en la tabla cambia a "Pagado"
    await expect(paymentRow.getByText('Pagado')).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [2] Flujo completo de cancelación
  // ─────────────────────────────────────────────────────────────────────────
  test('[2] Flujo completo de cancelación: crear pago → cancelar pago → verificar estado', async ({ page }) => {
    const memberName = 'Socio Pagos E2E';

    // 1. Crear otro pago pendiente para el mismo socio
    await page.goto('/members');
    const memberRow = page.getByRole('row').filter({ hasText: memberName });
    await memberRow.getByRole('button', { name: /Registrar pago/i }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeVisible();

    await page.getByPlaceholder('Ej. 1500.50').fill('1800');
    await page.getByPlaceholder('Ej. 5').fill('7'); // Mes 7
    await page.getByPlaceholder('Ej. 2026').fill('2026'); // Año 2026
    await page.getByLabel(/Fecha de Vencimiento/i).fill('2026-07-31');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Pago registrado correctamente');
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'Registrar Pago' }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeHidden();

    // 2. Ir a la vista de pagos
    await page.goto('/payments');

    // Identificar la fila correspondiente al nuevo pago (Mes 7, monto $1800.00)
    const paymentRow = page.getByRole('row').filter({ hasText: '7/2026' }).filter({ hasText: '$1800.00' });
    await expect(paymentRow).toBeVisible({ timeout: 10000 });
    await expect(paymentRow.getByText('Pendiente')).toBeVisible();

    // 3. Cancelar el pago
    // El sistema pide confirmación mediante window.confirm
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('¿Está seguro que desea cancelar este pago?');
      await dialog.accept();
    });

    await paymentRow.getByRole('button', { name: 'Cancelar' }).click();

    // 4. Verificar que el badge muestra Cancelado
    await expect(paymentRow.getByText('Cancelado')).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [3] Flujo validación
  // ─────────────────────────────────────────────────────────────────────────
  test('[3] Flujo validación: error al crear pago inválido e inexistencia de botón eliminar', async ({ page }) => {
    const memberName = 'Socio Pagos E2E';

    // 1. Intentar registrar pago con datos inválidos (monto negativo y mes = 0)
    await page.goto('/members');
    const memberRow = page.getByRole('row').filter({ hasText: memberName });
    await memberRow.getByRole('button', { name: /Registrar pago/i }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeVisible();

    const amountInput = page.getByPlaceholder('Ej. 1500.50');
    const monthInput = page.getByPlaceholder('Ej. 5');

    // Rellenamos datos inválidos
    await amountInput.fill('-100');
    await monthInput.fill('0');
    await page.getByPlaceholder('Ej. 2026').fill('2026');
    await page.getByLabel(/Fecha de Vencimiento/i).fill('2026-08-31');

    // Verificar que los inputs nativos marcan error de validación (HTML5 constraint validation)
    const isAmountInvalid = await amountInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    const isMonthInvalid = await monthInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isAmountInvalid || isMonthInvalid).toBe(true);

    // Intentamos hacer submit; el formulario no debe procesarse ni cerrarse debido a la validación HTML5
    await page.getByRole('button', { name: 'Registrar Pago' }).click();
    await expect(page.getByText(`Registrar Pago - ${memberName}`)).toBeVisible();

    // Cerrar el modal
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // 2. Verificar que no existe botón de eliminar pagos en la sección de pagos
    await page.goto('/payments');
    
    // El listado de pagos no debe contener ningún botón para eliminar
    const deleteButton = page.getByRole('button', { name: /Eliminar/i });
    await expect(deleteButton).toBeHidden();
  });
});
