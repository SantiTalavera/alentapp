import { test, expect, request } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';
/**
 * Tests E2E Full-Stack para la vista de Préstamos de Equipamiento.
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * El global-setup se encarga de limpiar la DB antes de correr la suite,
 * por lo que el Test 1 siempre empieza desde un estado vacío conocido.
 * Los tests son SECUENCIALES e interdependientes: el préstamo creado en el
 * Test 2 es el mismo que se elimina en el Test 3.
 */

/** URL base de la API Fastify corriendo en Docker (distinta del frontend). */
const API_BASE_URL = 'http://localhost:3001';

/**
 * Socio válido para crear vía API directa antes del Test 2.
 * Debe ser mayor de edad, Activo y con categoría Pleno u Honorario
 * para que la UI lo muestre en el buscador de préstamos.
 */
const MEMBER_PAYLOAD = {
  name: 'Socio E2E Préstamos',
  dni: '77788899',
  email: 'e2e.prestamos@test.com',
  birthdate: '1990-03-20',
  category: 'Pleno',
  status: 'Activo',
};

/** Nombre del ítem que se prestará en el Test 2. */
const ITEM_NAME = 'Raqueta E2E';

test.describe('Equipment Loans Full-Stack E2E', () => {

  // ✅ Cada spec file limpia la DB antes de su propia suite
  test.beforeAll(async () => {
    await truncateAllTables();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Estado vacío
  // Verifica que la vista muestra el mensaje de tabla vacía cuando no hay
  // ningún préstamo registrado en la DB (condición inicial garantizada por
  // el global-setup que hace TRUNCATE de todas las tablas).
  // ─────────────────────────────────────────────────────────────────────────
  test('debe mostrar el estado vacío cuando no hay préstamos en la DB', async ({ page }) => {
    // Navegar a la ruta de préstamos de equipamiento
    await page.goto('/loans');

    // Esperar a que la vista cargue y confirmar el mensaje de tabla vacía.
    // El texto exacto viene del componente: "No se encontraron préstamos."
    await expect(
      page.getByText('No se encontraron préstamos.'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Crear un préstamo real desde la UI
  //
  // Estrategia:
  //   1. Crear el socio DIRECTAMENTE vía API (request.post) para evitar
  //      depender de la UI de Members y mantener el test enfocado en Loans.
  //   2. Navegar a la vista de préstamos.
  //   3. Buscar al socio en el buscador del formulario y seleccionarlo.
  //   4. Completar el nombre del ítem y enviar el formulario.
  //   5. Verificar que el préstamo aparece en la tabla con estado "Prestado".
  // ─────────────────────────────────────────────────────────────────────────
  test('debe crear un préstamo real y mostrarlo en la tabla', async ({ page }) => {
    // ── Paso 1: Crear socio vía API (bypasea la UI de Members) ──────────
    // Usamos request.newContext() para tener un contexto HTTP independiente
    // del navegador que apunte directamente a la API en puerto 3001.
    const apiContext = await request.newContext({ baseURL: API_BASE_URL });

    const memberResponse = await apiContext.post('/api/v1/socios', {
      data: MEMBER_PAYLOAD,
    });

    // Confirmar que el socio se creó correctamente antes de continuar
    expect(memberResponse.status()).toBe(201);

    await apiContext.dispose();

    // ── Paso 2: Navegar a la vista de préstamos ──────────────────────────
    await page.goto('/loans');

    // Esperar a que la vista cargue y el mensaje de estado vacío sea visible
    // (aún no hay préstamos, pero el socio ya existe en la DB)
    await expect(
      page.getByText('No se encontraron préstamos.'),
    ).toBeVisible({ timeout: 10000 });

    // ── Paso 3: Buscar y seleccionar el socio en el buscador del formulario ─
    // El input de búsqueda tiene placeholder "Buscar por nombre o DNI…"
    await page.getByPlaceholder('Buscar por nombre o DNI…').fill(MEMBER_PAYLOAD.name);

    // El socio aparece como una tarjeta clickable con su nombre.
    // Esperamos a que el resultado de búsqueda sea visible en el panel del buscador.
    // Usamos el párrafo (<p>) dentro de la tarjeta para ser precisos y evitar
    // que el Select de filtro (que también contiene el nombre) cause ambigüedad.
    const memberCard = page.getByRole('paragraph').filter({ hasText: MEMBER_PAYLOAD.name });
    await expect(memberCard.first()).toBeVisible({ timeout: 5000 });
    await memberCard.first().click();

    // Después de seleccionar, el componente reemplaza el buscador por la tarjeta
    // de confirmación que muestra el nombre y el DNI del socio elegido.
    // Acotamos la búsqueda al panel de confirmación para evitar el strict mode
    // violation: el Select de filtro también renderiza el nombre del socio como
    // un <div role="option">, lo que haría que getByText() resuelva 2 elementos.
    await expect(
      page.getByRole('paragraph').filter({ hasText: MEMBER_PAYLOAD.name }).first(),
    ).toBeVisible({ timeout: 5000 });

    // ── Paso 4: Completar el nombre del ítem y enviar el formulario ──────
    // El input del ítem tiene placeholder "Ej: Raqueta de tenis N°3"
    await page.getByPlaceholder('Ej: Raqueta de tenis N°3').fill(ITEM_NAME);

    // Clic en el botón de submit "Registrar préstamo"
    await page.getByRole('button', { name: /Registrar préstamo/i }).click();

    // ── Paso 5: Verificar que el préstamo aparece en la tabla ────────────
    // Usamos getByRole('cell') para apuntar específicamente a la celda <td> de
    // la tabla. Esto evita el strict mode violation: el formulario también muestra
    // un <p> con el mensaje de éxito que contiene el nombre del ítem.
    await expect(page.getByRole('cell', { name: ITEM_NAME })).toBeVisible({ timeout: 10000 });

    // El badge de estado debe mostrar "Prestado" (estado inicial siempre).
    // Usamos exact:true para apuntar al <span> del badge que contiene únicamente
    // "Prestado", y no al <p> del mensaje de éxito que incluye "Estado: Prestado".
    await expect(page.getByText('Prestado', { exact: true })).toBeVisible({ timeout: 5000 });

    // El nombre del socio en la celda de la tabla (también una <td>)
    await expect(page.getByRole('cell', { name: MEMBER_PAYLOAD.name })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Eliminar el préstamo creado en el Test 2
  //
  // Estrategia:
  //   1. Navegar a la vista de préstamos (el préstamo del Test 2 persiste en DB).
  //   2. Registrar el handler del dialog de confirmación ANTES de hacer click
  //      (window.confirm nativo del navegador).
  //   3. Hacer clic en el botón "Eliminar" de la fila del préstamo.
  //   4. Aceptar el diálogo de confirmación automáticamente.
  //   5. Verificar que la tabla vuelve al estado vacío (el préstamo desaparece).
  // ─────────────────────────────────────────────────────────────────────────
  test('debe eliminar el préstamo creado y mostrar el estado vacío', async ({ page }) => {
    // ── Paso 1: Navegar a la vista de préstamos ──────────────────────────
    await page.goto('/loans');

    // Esperar a que el préstamo del Test 2 esté visible en la tabla.
    // Usamos getByRole('cell') para apuntar a la <td> y evitar ambigüedad.
    await expect(page.getByRole('cell', { name: ITEM_NAME })).toBeVisible({ timeout: 10000 });

    // ── Paso 2: Registrar el handler del dialog ANTES del click ──────────
    // El componente usa window.confirm() nativo para pedir confirmación.
    // Si no se registra el handler antes del click, Playwright lanza un error
    // porque el dialog bloquea la ejecución.
    page.on('dialog', (dialog) => dialog.accept());

    // ── Paso 3: Hacer clic en el botón "Eliminar" de la fila ─────────────
    // El botón tiene texto " Eliminar" (ícono LuTrash2 + texto).
    // Usamos getByRole con name para mayor robustez.
    await page.getByRole('button', { name: /Eliminar/i }).first().click();

    // ── Paso 4 (implícito): El dialog se acepta automáticamente via handler ─

    // ── Paso 5: Verificar que la tabla vuelve al estado vacío ────────────
    // Tras el soft delete, el préstamo desaparece del listado (filtered_at IS NULL)
    // y el componente muestra el mensaje de tabla vacía.
    await expect(
      page.getByText('No se encontraron préstamos.'),
    ).toBeVisible({ timeout: 10000 });

    // Confirmar también que el ítem eliminado ya no está en el DOM
    await expect(page.getByText(ITEM_NAME)).toBeHidden();
  });
});
