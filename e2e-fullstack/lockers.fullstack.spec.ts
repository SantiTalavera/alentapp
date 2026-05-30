import { test, expect } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup';
import pg from 'pg';

/**
 * Tests E2E Full-Stack para la vista de Casilleros (Locker).
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174 (con baseURL configurado)
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * De acuerdo con la PR #77, aislamos la limpieza de la base de datos
 * usando truncateAllTables() en el beforeAll de esta suite.
 */

const DB_URL = 'postgresql://admin:password123@localhost:5433/alentapp_test_db';
const TEST_MEMBER_ID = 'a5342a1e-84fc-4809-968b-fb19e685f40c';

test.describe('Lockers Full-Stack E2E', () => {

  test.beforeAll(async () => {
    // 1. Limpieza de tablas (Aislamiento según PR #77)
    await truncateAllTables();

    // 2. Sembrar un socio de prueba para poder asignarlo a los casilleros
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query(`
        INSERT INTO members (id, dni, name, email, birthdate, category, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        TEST_MEMBER_ID,
        '99999999',
        'Socio E2E',
        'socio@e2e.com',
        new Date('1990-01-01'),
        'Pleno',
        'Activo'
      ]);
    } finally {
      await client.end();
    }
  });

  test('[1] Flujo completo alta y asignación: crear locker Available -> asignar socio -> verificar en listado', async ({ page }) => {
    await page.goto('/lockers');

    // 1. Crear casillero con status Available (por defecto)
    await page.getByRole('button', { name: /Nuevo casillero/i }).click();
    await expect(page.getByText('Registrar Casillero')).toBeVisible();

    // Scoping to dialog to avoid strict mode violation on 'Ubicación'
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Número de casillero').fill('201');
    await dialog.getByLabel('Ubicación').fill('Vestuario A');
    await dialog.getByRole('button', { name: 'Crear casillero' }).click();

    // Esperar que el modal se cierre
    await expect(page.getByText('Registrar Casillero')).toBeHidden();

    // Verificar que aparece en la tabla con "Disponible" y "Sin socio asignado"
    const row = page.locator('tr:has-text("#201")');
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('td').nth(1)).toContainText('Vestuario A');
    await expect(row).toContainText('Disponible');
    await expect(row).toContainText('Sin socio asignado');

    // 2. Asignar el socio
    await row.getByRole('button', { name: /Modificar casillero/i }).click();
    await expect(page.getByText('Modificar Casillero #201')).toBeVisible();

    const editDialog = page.getByRole('dialog');
    // Abrir el selector de socio asignado (que inicialmente muestra "Sin socio asignado")
    await editDialog.locator('button:has-text("Sin socio asignado")').click();
    // Seleccionar el socio sembrado
    await page.getByRole('option', { name: 'Socio E2E — DNI 99999999' }).click();

    // Guardar cambios
    await editDialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Modificar Casillero #201')).toBeHidden();

    // 3. Verificar que aparece con el socio asignado en el listado
    await expect(row).toContainText('Socio E2E');
  });

  test('[2] Flujo restricción Maintenance: dado locker en Maintenance -> intentar asignar socio -> verificar error y no modifica', async ({ page }) => {
    await page.goto('/lockers');

    // 1. Crear otro casillero
    await page.getByRole('button', { name: /Nuevo casillero/i }).click();
    await expect(page.getByText('Registrar Casillero')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Número de casillero').fill('202');
    await dialog.getByLabel('Ubicación').fill('Vestuario B');
    await dialog.getByRole('button', { name: 'Crear casillero' }).click();
    await expect(page.getByText('Registrar Casillero')).toBeHidden();

    const row = page.locator('tr:has-text("#202")');
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Cambiar estado a Mantenimiento
    await row.getByRole('button', { name: /Modificar casillero/i }).click();
    await expect(page.getByText('Modificar Casillero #202')).toBeVisible();

    const editDialog = page.getByRole('dialog');
    // Abrir el selector de estado
    await editDialog.locator('button:has-text("Disponible")').click();
    // Seleccionar "Mantenimiento"
    await page.getByRole('option', { name: 'Mantenimiento' }).click();

    // Guardar cambios
    await editDialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Modificar Casillero #202')).toBeHidden();

    // Verificar en la tabla que el estado es "Mantenimiento"
    await expect(row).toContainText('Mantenimiento');

    // 3. Intentar asignar socio
    await row.getByRole('button', { name: /Modificar casillero/i }).click();
    await expect(page.getByText('Modificar Casillero #202')).toBeVisible();

    const editDialog2 = page.getByRole('dialog');
    // Seleccionar el socio
    await editDialog2.locator('button:has-text("Sin socio asignado")').click();
    await page.getByRole('option', { name: 'Socio E2E — DNI 99999999' }).click();

    // Intentar guardar y verificar que el formulario muestra el error del backend
    await editDialog2.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(editDialog2.getByText('casillero en mantenimiento no puede tener socio')).toBeVisible();

    // Cancelar la edición
    await editDialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Modificar Casillero #202')).toBeHidden();

    // Verificar que el locker no fue modificado en la tabla (sigue "Sin socio asignado")
    await expect(row).toContainText('Sin socio asignado');
  });

  test('[3] Flujo baja: dado un locker activo -> dar de baja -> verificar que desaparece', async ({ page }) => {
    await page.goto('/lockers');

    // 1. Crear un casillero nuevo para darlo de baja
    await page.getByRole('button', { name: /Nuevo casillero/i }).click();
    await expect(page.getByText('Registrar Casillero')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Número de casillero').fill('203');
    await dialog.getByLabel('Ubicación').fill('Vestuario C');
    await dialog.getByRole('button', { name: 'Crear casillero' }).click();
    await expect(page.getByText('Registrar Casillero')).toBeHidden();

    const row = page.locator('tr:has-text("#203")');
    await expect(row).toBeVisible({ timeout: 10000 });

    // Aceptar el confirm del navegador automáticamente para dar de baja
    page.on('dialog', (dialog) => dialog.accept());

    // 2. Dar de baja
    await row.getByRole('button', { name: /Dar de baja casillero/i }).click();

    // 3. Verificar que desaparece del listado activo
    await expect(row).toBeHidden({ timeout: 10000 });
  });
});
