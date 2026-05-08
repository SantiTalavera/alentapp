---
id: 0011
estado: propuesto
autor: Agustina Pilar Egüen
fecha: 2026-05-02
titulo: Actualización de Certificados Médicos Existentes
---

# TDD-0011: Actualización de Certificados Médicos Existentes

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos corregir datos de un certificado médico ya registrado —como una fecha de vencimiento mal ingresada o un número de matrícula erróneo— sin necesidad de dar de baja y recrear el registro. Esta operación aplica únicamente sobre los datos del certificado en sí; el cambio de socio titular no está permitido.

### User Persona

- **Nombre**: Administrativo del club.
- **Necesidad**: Corregir un error de tipeo en la matrícula del médico o en la fecha de vencimiento detectado después de guardar el formulario. Necesita poder modificar solo los campos afectados sin alterar el resto del registro ni el estado de validez del certificado.

### Criterios de Aceptación

- El sistema debe validar que el certificado a actualizar exista.
- El sistema debe permitir actualizar uno o varios campos: `issue_date`, `expiry_date`, `doctor_license`.
- El campo `member_id` es inmutable: si el cliente lo envía en el body, el sistema debe rechazar la petición con un error explícito (`400 Bad Request`).
- Si se modifica alguna de las fechas, el sistema debe revalidar que `expiry_date` sea estrictamente posterior a `issue_date` (usando los valores resultantes, no solo los enviados).
- Si la edición es correcta, debe retornar el registro completo con los datos actualizados.

---

## Diseño Técnico (RFC)

### Contrato de API (`@alentapp/shared`)

Se trata de una actualización parcial a nivel de negocio. Todos los campos del body son opcionales.

- **Endpoint**: `PATCH /api/v1/medical-certificates/:id`

```ts
export interface UpdateMedicalCertificateRequest {
    issue_date?: string;        // ISO Date (YYYY-MM-DD)
    expiry_date?: string;       // ISO Date (YYYY-MM-DD)
    doctor_license?: string;    // Número de matrícula del médico emisor
}
```

- **Response exitosa** (`200 OK`):

```ts
{
  data: MedicalCertificateDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `MedicalCertificateRepository` incluye los métodos `findById` y `update`. El servicio `MedicalCertificateValidator` centraliza la validación de coherencia de fechas (`expiry_date > issue_date`), reutilizable entre casos de uso.

- **Application**: `UpdateMedicalCertificateUseCase` orquesta el flujo: recupera el registro existente, rechaza la petición si se envía `member_id`, aplica los campos entrantes sobre los actuales, valida la coherencia de fechas resultante y delega la persistencia al repositorio.

- **Infrastructure**: `PostgresMedicalCertificateRepository` implementa la actualización usando el método `update` de Prisma sobre el campo `id`, y mapea el resultado a `MedicalCertificateDTO`.

- **Delivery**: `MedicalCertificateController` expone `PATCH /api/v1/medical-certificates/:id`, extrae el `id` de la URL, valida el body tipado como `UpdateMedicalCertificateRequest`, delega al caso de uso y devuelve `200 OK` con `{ data: MedicalCertificateDTO }`.

---

## Casos de Borde y Errores

| Escenario                                | Resultado Esperado                                                          | Código HTTP               |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| Certificado inexistente                  | Mensaje: "El certificado médico no existe"                                  | 404 Not Found             |
| `expiry_date` <= `issue_date` resultante | Mensaje: "La fecha de vencimiento debe ser posterior a la de emisión"       | 400 Bad Request           |
| Body vacío (ningún campo enviado)        | Mensaje: "Se debe enviar al menos un campo para actualizar"                 | 400 Bad Request           |
| Intento de modificar `member_id`         | Mensaje: "El socio titular del certificado no puede modificarse"            | 400 Bad Request           |
| Error de conexión a DB                   | Mensaje: "Error interno, reintente más tarde"                               | 500 Internal Server Error |
| Actualización exitosa                    | Retorna el certificado completo con los nuevos valores                      | 200 OK                    |

---

## Plan de Implementación

1. Crear el tipo `UpdateMedicalCertificateRequest` en `@alentapp/shared`, con los campos opcionales permitidos.
2. Agregar los métodos `findById` y `update` al puerto `MedicalCertificateRepository`.
3. Extraer la validación de fechas al servicio de dominio `MedicalCertificateValidator`.
4. Implementar `UpdateMedicalCertificateUseCase`, verificando existencia, body no vacío, validando fechas resultantes y persistiendo.
5. Implementar el método `update` en `PostgresMedicalCertificateRepository` usando Prisma.
6. Implementar el endpoint `PATCH /api/v1/medical-certificates/:id` en el controlador y registrarlo en `app.ts`.
7. Reutilizar/adaptar el formulario modal en el Frontend para el modo edición.
8. Escribir tests unitarios para el caso de uso: certificado inexistente, fechas inválidas, body vacío, rechazo de `member_id` (400) y actualización exitosa.
9. Escribir tests de integración para el endpoint.

