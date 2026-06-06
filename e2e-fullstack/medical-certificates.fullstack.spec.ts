import { test, expect, request as playwrightRequest } from '@playwright/test';
import { truncateAllTables } from './helpers/db-cleanup.js';

/**
 * Función auxiliar para generar fechas relativas al día de hoy en formato YYYY-MM-DD.
 */
function getRelativeDate(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

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
        issue_date: getRelativeDate(-400),
        expiry_date: getRelativeDate(-35),
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
    await page.getByLabel('Fecha de Emisión').fill(getRelativeDate(-10));
    await page.getByLabel('Fecha de Vencimiento').fill(getRelativeDate(355));
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
        issue_date: getRelativeDate(-10),
        expiry_date: getRelativeDate(355),
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

  test('debe mostrar error cuando expiry_date es anterior a issue_date y mantener el modal abierto', async ({ page }) => {
    // --- Paso 1: Crear socio vía API ---
    // Representa un socio que ya existe en el sistema antes de que el operador intente registrar el certificado
    const apiContext = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3001'
    });

    const socioRes = await apiContext.post('/api/v1/socios', {
      data: {
        name: 'Socio E2E Fechas',
        dni: '99988877',
        email: 'e2efecas@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno'
      }
    });
    expect(socioRes.ok()).toBeTruthy();

    await apiContext.dispose();

    // --- Paso 2: El operador navega a /members y abre el modal de certificado ---
    await page.goto('/members');

    // Esperar que la tabla cargue con el socio recién creado
    await expect(page.getByText('Socio E2E Fechas')).toBeVisible({ timeout: 10000 });

    // El operador hace clic en el botón de la fila específica del socio
    await page.locator('tr', { hasText: 'Socio E2E Fechas' })
      .getByRole('button', { name: 'Registrar certificado médico' })
      .click();

    // Verificar que el modal está abierto antes de intentar el envío inválido
    await expect(page.getByText(/Registrar Certificado Médico/)).toBeVisible({ timeout: 5000 });

    // --- Paso 3: El operador completa el formulario con fechas inválidas (vencimiento anterior a emisión) ---
    // Representa el error humano más frecuente al cargar fechas: invertir el orden
    await page.getByLabel('Fecha de Emisión').fill(getRelativeDate(10));
    await page.getByLabel('Fecha de Vencimiento').fill(getRelativeDate(-10));
    await page.getByPlaceholder('Ej: MN 12345').fill('MN-INVALID');

    // --- Paso 4: Capturar el alert de validación y verificar el comportamiento defensivo del sistema ---
    // El handler debe registrarse ANTES del click para no perder el evento de dialog
    let alertMessage = '';
    page.once('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // El operador intenta enviar el formulario con las fechas incorrectas
    await page.getByRole('button', { name: 'Registrar Certificado' }).click();

    // Verificar que el mensaje del alert comunica exactamente el error de validación esperado
    // expect sincrónico: alertMessage ya fue capturado cuando dialog se resolvió
    expect(alertMessage).toContain('La fecha de vencimiento debe ser posterior a la fecha de emisión');

    // Verificar que el modal permanece abierto — el sistema no debe cerrar el formulario ante un error
    // Si el modal se cerrara, el operador perdería los datos ya ingresados
    await expect(page.getByText(/Registrar Certificado Médico/)).toBeVisible();

    // Verificar que no hubo navegación — la URL sigue siendo /members
    await expect(page).toHaveURL(/\/members$/);
  });

});
