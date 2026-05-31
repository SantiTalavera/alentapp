import { test, expect, request } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';

/**
 * Tests E2E Full-Stack para la vista de Inscripciones (Enrollments).
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * Cada test limpia la DB en beforeEach para garantizar aislamiento total.
 * Todas las precondiciones se crean directamente vía API real.
 */

/** URL base de la API Fastify corriendo en Docker. */
const API_BASE_URL = 'http://localhost:3001';

const MEMBER_PAYLOAD = {
  dni: '40111222',
  name: 'Socio Enrollment E2E',
  email: 'socio.enrollment.e2e@test.com',
  birthdate: '1995-05-15',
  category: 'Pleno',
};

const SPORT_PAYLOAD = {
  name: 'Natación Enrollment E2E',
  description: 'Deporte preparado para probar inscripciones',
  max_capacity: 10,
  additional_price: 250,
  requires_medical_certificate: false,
};

/** Crea un socio activo directamente vía API y devuelve el DTO. */
async function createMemberViaApi(overrides: Record<string, unknown> = {}) {
  const apiContext = await request.newContext({ baseURL: API_BASE_URL });

  try {
    const response = await apiContext.post('/api/v1/socios', {
      data: {
        ...MEMBER_PAYLOAD,
        ...overrides,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    return body.data as { id: string; name: string; dni: string };
  } finally {
    await apiContext.dispose();
  }
}

/** Crea un deporte directamente vía API y devuelve el DTO. */
async function createSportViaApi(overrides: Record<string, unknown> = {}) {
  const apiContext = await request.newContext({ baseURL: API_BASE_URL });

  try {
    const response = await apiContext.post('/api/v1/sports', {
      data: {
        ...SPORT_PAYLOAD,
        ...overrides,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    return body.data as { id: string; name: string; max_capacity: number };
  } finally {
    await apiContext.dispose();
  }
}

/** Crea una inscripción vigente directamente vía API y devuelve el DTO. */
async function createEnrollmentViaApi(memberId: string, sportId: string) {
  const apiContext = await request.newContext({ baseURL: API_BASE_URL });

  try {
    const response = await apiContext.post('/api/v1/enrollments', {
      data: {
        member_id: memberId,
        sport_id: sportId,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    return body.data as { id: string; is_active: boolean };
  } finally {
    await apiContext.dispose();
  }
}

test.describe('Enrollments Full-Stack E2E', () => {
  test.beforeEach(async () => {
    // Limpiar todas las tablas antes de cada test para garantizar aislamiento
    await truncateAllTables();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Estado vacío
  // Verifica que la vista muestra el mensaje correcto cuando la DB
  // no contiene ninguna inscripción registrada.
  // ─────────────────────────────────────────────────────────────────────────
  test('debe mostrar el estado vacío cuando no hay inscripciones en la DB', async ({ page }) => {
    await page.goto('/enrollments');

    // El componente muestra este mensaje cuando no hay inscripciones que mostrar
    await expect(
      page.getByText('No hay inscripciones que coincidan con los filtros.'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Registrar inscripción desde la UI
  //
  // Estrategia:
  //   1. Crear socio y deporte vía API para tenerlos disponibles en los selects.
  //   2. Navegar a /enrollments y abrir el modal "Nueva inscripción".
  //   3. Seleccionar socio y deporte en los custom selects de Chakra UI.
  //   4. Enviar el formulario y verificar éxito + fila con estado "Vigente".
  // ─────────────────────────────────────────────────────────────────────────
  test('debe registrar una inscripción real desde la UI y mostrarla como vigente', async ({ page }) => {
    // Crear precondiciones: socio y deporte deben existir para aparecer en los selects
    const member = await createMemberViaApi();
    const sport = await createSportViaApi();

    await page.goto('/enrollments');

    // Esperar que la vista cargue con el estado vacío inicial
    await expect(
      page.getByText('No hay inscripciones que coincidan con los filtros.'),
    ).toBeVisible({ timeout: 10000 });

    // Abrir el modal de nueva inscripción
    await page.getByRole('button', { name: /Nueva inscripción/i }).click();

    // Acotar al dialog para interactuar con los selects del formulario
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Nueva inscripción')).toBeVisible({ timeout: 5000 });

    // Seleccionar el socio: el trigger de Chakra UI SelectRoot renderiza como <button>
    // con el placeholder como texto hasta que se elige un ítem
    await dialog.locator('button:has-text("Seleccioná un socio")').click();

    // Las opciones se renderizan en un portal fuera del dialog (Chakra UI) → usar page
    // El label del socio sigue el patrón: "${name} — DNI ${dni}"
    await page.getByRole('option', { name: new RegExp(member.name) }).click();

    // Seleccionar el deporte de la misma manera
    await dialog.locator('button:has-text("Seleccioná un deporte activo")').click();

    // El label del deporte sigue el patrón: "${name} (cupo máx. ${max_capacity})"
    await page.getByRole('option', { name: new RegExp(sport.name) }).click();

    // Confirmar el formulario
    await dialog.getByRole('button', { name: /Registrar inscripción/i }).click();

    // Verificar que el modal se cerró tras el registro exitoso
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Verificar el mensaje de éxito del componente
    await expect(
      page.getByText('Inscripción registrada correctamente.'),
    ).toBeVisible({ timeout: 10000 });

    // Verificar que la fila aparece en la tabla con el socio, deporte y estado Vigente
    const row = page
      .getByRole('row')
      .filter({ hasText: member.name })
      .filter({ hasText: sport.name });

    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('Vigente')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Desactivar y reactivar inscripción
  //
  // Estrategia:
  //   1. Crear socio, deporte e inscripción vigente vía API.
  //   2. Navegar a /enrollments y usar el IconButton "Desactivar inscripción".
  //   3. Verificar que el estado cambia a "Histórica".
  //   4. Usar el IconButton "Activar inscripción" y verificar que vuelve a "Vigente".
  //   El mismo registro persiste en ambos sentidos (no se recrea desde cero).
  // ─────────────────────────────────────────────────────────────────────────
  test('debe desactivar y reactivar una inscripción desde la UI conservando su historial', async ({ page }) => {
    // Crear precondiciones directamente vía API real
    const member = await createMemberViaApi();
    const sport = await createSportViaApi();
    await createEnrollmentViaApi(member.id, sport.id);

    await page.goto('/enrollments');

    // Localizar la fila de la inscripción por nombre del socio y del deporte
    const row = page
      .getByRole('row')
      .filter({ hasText: member.name })
      .filter({ hasText: sport.name });

    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('Vigente')).toBeVisible();

    // Desactivar: el IconButton expone aria-label="Desactivar inscripción"
    await row.getByRole('button', { name: 'Desactivar inscripción' }).click();

    // Verificar mensaje de éxito y cambio de estado en la fila
    await expect(
      page.getByText('Inscripción desactivada.'),
    ).toBeVisible({ timeout: 10000 });

    // Re-localizar la fila luego del re-render para verificar el nuevo estado
    const rowAfterDeactivate = page
      .getByRole('row')
      .filter({ hasText: member.name })
      .filter({ hasText: sport.name });

    await expect(rowAfterDeactivate.getByText('Histórica')).toBeVisible({ timeout: 5000 });

    // Reactivar: cuando is_active=false el IconButton expone aria-label="Activar inscripción"
    await rowAfterDeactivate.getByRole('button', { name: 'Activar inscripción' }).click();

    // Verificar mensaje de activación
    await expect(
      page.getByText('Inscripción activada.'),
    ).toBeVisible({ timeout: 10000 });

    // Re-localizar la fila y confirmar que volvió a Vigente (mismo registro histórico)
    const rowAfterActivate = page
      .getByRole('row')
      .filter({ hasText: member.name })
      .filter({ hasText: sport.name });

    await expect(rowAfterActivate.getByText('Vigente')).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Baja lógica desde la UI
  //
  // Estrategia:
  //   1. Crear socio, deporte e inscripción vigente vía API.
  //   2. Navegar a /enrollments y registrar el handler del window.confirm() nativo.
  //   3. Hacer click en el IconButton "Dar de baja inscripción".
  //   4. Verificar que la fila desaparece del listado y se muestra el estado vacío.
  //   La baja es lógica: el registro queda en DB con deleted_at != null.
  // ─────────────────────────────────────────────────────────────────────────
  test('debe dar de baja una inscripción y excluirla del listado operativo', async ({ page }) => {
    // Crear precondiciones directamente vía API real
    const member = await createMemberViaApi();
    const sport = await createSportViaApi();
    await createEnrollmentViaApi(member.id, sport.id);

    await page.goto('/enrollments');

    // Localizar la fila de la inscripción por nombre del socio y del deporte
    const row = page
      .getByRole('row')
      .filter({ hasText: member.name })
      .filter({ hasText: sport.name });

    await expect(row).toBeVisible({ timeout: 10000 });

    // Registrar el handler del window.confirm() nativo ANTES del click
    // (el componente llama window.confirm antes de ejecutar el soft-delete)
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // El IconButton de baja expone aria-label="Dar de baja inscripción"
    await row.getByRole('button', { name: 'Dar de baja inscripción' }).click();

    // Verificar el mensaje de confirmación de baja
    await expect(
      page.getByText('Inscripción dada de baja correctamente.'),
    ).toBeVisible({ timeout: 10000 });

    // La fila debe desaparecer del listado operativo (soft-delete filtra por deleted_at IS NULL)
    await expect(row).toBeHidden({ timeout: 10000 });

    // La vista debe mostrar el estado vacío al no quedar inscripciones visibles
    await expect(
      page.getByText('No hay inscripciones que coincidan con los filtros.'),
    ).toBeVisible({ timeout: 10000 });
  });
});
