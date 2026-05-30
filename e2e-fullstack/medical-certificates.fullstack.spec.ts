import { test, expect, request as playwrightRequest } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';

/**
 * Tests E2E Full-Stack para la vista de Certificados Médicos.
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5173
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * beforeAll limpia la DB para que cada ejecución parta de estado conocido.
 */

test.describe('MedicalCertificates Full-Stack E2E', () => {

  test.beforeAll(async () => {
    // Limpiar todas las tablas antes de correr la suite para garantizar estado conocido
    await truncateAllTables();
  });

  test('debe crear un nuevo certificado e invalidar el anterior automáticamente', async ({ page }) => {
    // --- Paso 1: Crear socio vía API ---
    // Representa el alta de un socio que ya existe en el sistema antes de llegar a la UI
    const apiContext = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3001'
    });

    const socioRes = await apiContext.post('/api/v1/socios', {
      data: {
        name: 'Socio E2E Cert',
        dni: '33344455',
        email: 'e2ecert@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno'
      }
    });
    expect(socioRes.ok()).toBeTruthy();
    const socio = await socioRes.json();
    const socioId = socio.data.id;

    // --- Paso 2: Crear primer certificado vía API ---
    // Representa un certificado que el socio ya tenía registrado previamente en el sistema
    const cert1Res = await apiContext.post('/api/v1/medical-certificates', {
      data: {
        member_id: socioId,
        issue_date: '2024-01-01',
        expiry_date: '2025-01-01',
        doctor_license: 'MN-11111'
      }
    });
    expect(cert1Res.ok()).toBeTruthy();

    await apiContext.dispose();

    // --- Paso 3: El usuario navega a /members y registra un segundo certificado desde la UI ---
    // Representa la acción de un operador que registra un nuevo certificado para el socio
    await page.goto('/members');

    // Esperar que la tabla cargue y muestre al socio creado por API
    await expect(page.getByText('Socio E2E Cert')).toBeVisible({ timeout: 10000 });

    // Clic en el botón específico de la fila del socio
    await page.locator('tr', { hasText: 'Socio E2E Cert' })
      .getByRole('button', { name: 'Registrar certificado médico' })
      .click();

    // Esperar que el modal se abra con el título correcto
    await expect(page.getByText(/Registrar Certificado Médico/)).toBeVisible({ timeout: 5000 });

    // Verificar que el sistema advierte al operador sobre la invalidación automática del certificado anterior
    // Esta advertencia es crítica: el operador debe ser consciente del efecto colateral antes de confirmar
    await expect(
      page.getByText('Cualquier certificado previo activo quedará automáticamente invalidado.')
    ).toBeVisible();

    // El operador completa el formulario con los datos del nuevo certificado
    await page.getByLabel('Fecha de Emisión').fill('2025-06-01');
    await page.getByLabel('Fecha de Vencimiento').fill('2026-06-01');
    await page.getByPlaceholder('Ej: MN 12345').fill('MN-22222');

    // Registrar handler de dialog antes del click para no perder el evento
    page.once('dialog', dialog => dialog.accept());

    // El operador confirma el registro del nuevo certificado
    await page.getByRole('button', { name: 'Registrar Certificado' }).click();

    // Esperar que el modal se cierre, indicando que el registro fue exitoso
    await expect(page.getByText(/Registrar Certificado Médico/)).toBeHidden({ timeout: 10000 });

    // --- Paso 4: El usuario navega a /medical-certificates para revisar el historial ---
    // Representa la verificación de que el sistema registró correctamente ambos certificados
    await page.goto('/medical-certificates');

    // El usuario busca al socio por nombre en el input de búsqueda
    await page.getByPlaceholder('Buscar socio...').fill('Socio E2E Cert');

    // El usuario selecciona al socio de la lista de resultados
    await page.getByText('Socio E2E Cert').click();

    // Esperar que cargue la tabla de certificados del socio seleccionado
    // Verificar que hay exactamente 2 certificados registrados en el historial
    const rows = page.getByRole('table').getByRole('row');
    // La tabla incluye el header, por eso esperamos al menos 3 filas (1 header + 2 datos)
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    // Verificar que el nuevo certificado figura como "Activo"
    // Confirma que la creación desde la UI fue persistida correctamente
    await expect(page.getByRole('table').getByText('Activo').first()).toBeVisible();

    // Verificar que el primer certificado fue automáticamente "Invalidado"
    // Esta es la regla de negocio clave: solo puede haber un certificado activo por socio
    await expect(page.getByRole('table').getByText('Invalidado').first()).toBeVisible();
  });

  test('debe eliminar un certificado activo y dejar al socio sin certificados', async ({ page }) => {
    // --- Paso 1: Crear socio vía API ---
    // Representa un socio distinto al del test anterior para evitar dependencias entre tests
    const apiContext = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3001'
    });

    const socioRes = await apiContext.post('/api/v1/socios', {
      data: {
        name: 'Socio E2E Delete',
        dni: '66677788',
        email: 'e2edelete@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno'
      }
    });
    expect(socioRes.ok()).toBeTruthy();
    const socio = await socioRes.json();
    const socioId = socio.data.id;

    // --- Paso 2: Crear certificado vía API ---
    // Representa un certificado activo preexistente que el operador desea eliminar
    const certRes = await apiContext.post('/api/v1/medical-certificates', {
      data: {
        member_id: socioId,
        issue_date: '2025-01-01',
        expiry_date: '2026-06-01',
        doctor_license: 'MN-DELETE'
      }
    });
    expect(certRes.ok()).toBeTruthy();

    await apiContext.dispose();

    // --- Paso 3: El operador navega a /medical-certificates y elimina el certificado ---
    await page.goto('/medical-certificates');

    // El operador busca al socio por nombre
    await page.getByPlaceholder('Buscar socio...').fill('Socio E2E Delete');

    // El operador selecciona al socio de la lista
    await page.getByText('Socio E2E Delete').click();

    // Esperar que el certificado aparezca en la tabla antes de intentar eliminarlo
    await expect(page.getByRole('table').getByText('Activo').first()).toBeVisible({ timeout: 10000 });

    // Registrar el handler de confirmación antes del click para capturar el dialog a tiempo
    page.once('dialog', dialog => dialog.accept());

    // El operador hace clic en "Eliminar" para borrar el certificado activo
    await page.locator('tr', { hasText: 'MN-DELETE' })
      .getByRole('button', { name: 'Eliminar' })
      .click();

    // Verificar que el sistema muestra el estado vacío cuando el socio ya no tiene certificados
    // Esta verificación confirma tanto la eliminación en DB como el re-render correcto del frontend
    await expect(
      page.getByText('El socio no tiene certificados registrados.')
    ).toBeVisible({ timeout: 10000 });
  });

});
