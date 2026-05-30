import { test, expect, type Page } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup';

/**
 * Tests E2E Full-Stack para la entidad Discipline.
 * NO hay mocks de red. Playwright interactúa con:
 *   - Frontend React en http://localhost:5174
 *   - API Fastify real en http://localhost:3001
 *   - PostgreSQL de test (alentapp_test_db)
 */

const memberName = 'Socio Discipline E2E';
const memberDni = '77112233';
const memberEmail = 'discipline-e2e@test.com';
const disciplineReason = 'Suspensión total E2E';

function toDateTimeLocal(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return toDateTimeLocal(date);
}

async function createActiveMember(page: Page) {
  await page.goto('/members');

  await page.getByRole('button', { name: /Agregar Miembro/i }).click();
  await expect(page.getByText('Agregar Nuevo Miembro')).toBeVisible();

  await page.getByPlaceholder('Ej. Juan Pérez').fill(memberName);
  await page.getByPlaceholder('Ej. 12345678').fill(memberDni);
  await page.getByPlaceholder('ejemplo@correo.com').fill(memberEmail);
  await page.getByLabel(/Fecha de Nacimiento/i).fill('1995-06-15');

  await page.getByRole('button', { name: 'Crear Miembro' }).click();

  await expect(page.getByRole('button', { name: 'Crear Miembro' })).toBeHidden();
  await expect(page.getByText(memberName)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(memberDni)).toBeVisible();
  await expect(page.getByText('Activo')).toBeVisible();
}

async function createTotalDiscipline(page: Page, options?: { endDate?: string }) {
  await page.goto('/members');
  await expect(page.getByText(memberName)).toBeVisible({ timeout: 10000 });

  const memberRow = page.getByRole('row').filter({ hasText: memberName });
  await memberRow.getByRole('button', { name: /Registrar disciplina/i }).click();
  await expect(page.getByText(`Registrar Disciplina - ${memberName}`)).toBeVisible();

  await page.getByPlaceholder('Ej. Incumplimiento del reglamento').fill(disciplineReason);
  await page.getByLabel(/Fecha de Inicio/i).fill(daysFromToday(-1));
  await page.getByLabel(/Fecha de Fin/i).fill(options?.endDate ?? daysFromToday(7));
  await page.getByLabel(/Suspende totalmente al socio/i).check();

  await page.getByRole('button', { name: 'Registrar Disciplina' }).click();
}

async function expectMemberStatus(page: Page, status: 'Activo' | 'Suspendido') {
  await page.goto('/members');
  await expect(page.getByText(memberName)).toBeVisible({ timeout: 10000 });

  const memberRow = page.getByRole('row').filter({ hasText: memberName });
  await expect(memberRow.getByText(status)).toBeVisible({ timeout: 10000 });
}

test.describe('Disciplines Full-Stack E2E', () => {
  test.beforeEach(async () => {
    await truncateAllTables();
  });

  test('flujo completo alta con suspensión total: suspende al socio en la UI', async ({ page }) => {
    await createActiveMember(page);

    await createTotalDiscipline(page);

    await expect(page.getByText(`Registrar Disciplina - ${memberName}`)).toBeHidden();
    await expectMemberStatus(page, 'Suspendido');
  });

  test('flujo completo eliminación con restauración de estado: elimina la sanción y restaura el socio', async ({ page }) => {
    await createActiveMember(page);
    await createTotalDiscipline(page);
    await expectMemberStatus(page, 'Suspendido');

    await page.goto('/disciplines');
    await page.getByPlaceholder('Buscar socio...').fill(memberDni);
    await page.getByText(memberName).click();

    await expect(page.getByText(disciplineReason)).toBeVisible({ timeout: 10000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Eliminar/i }).click();

    await expect(page.getByText('Sanción eliminada correctamente.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('El socio no tiene sanciones registradas.')).toBeVisible();

    await expectMemberStatus(page, 'Activo');
  });

  test('flujo validación de fechas: rechaza end_date anterior a start_date y mantiene el formulario abierto', async ({ page }) => {
    await createActiveMember(page);

    let alertMessage = '';
    page.once('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await createTotalDiscipline(page, { endDate: daysFromToday(-2) });

    expect(alertMessage).toContain('La fecha de fin debe ser posterior a la fecha de inicio');

    await expect(page.getByText(`Registrar Disciplina - ${memberName}`)).toBeVisible();
    await expect(page).toHaveURL(/\/members$/);
  });
});
