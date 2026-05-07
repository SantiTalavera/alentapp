---
id: 0025
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-06
titulo: Modificación de Inscripción Existente
---

# TDD-0025: Modificación de Inscripción Existente

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo modifique el estado de una inscripción existente, pudiendo activar o desactivar su vigencia sin alterar la información histórica de la misma.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Gestionar la vigencia de las inscripciones de los socios a deportes, pudiendo desactivar o reactivar inscripciones según la situación, sin perder la trazabilidad de cuándo se creó originalmente la inscripción.

### Criterios de Aceptación

- El sistema debe permitir modificar únicamente el campo `is_active`.
- El sistema no debe permitir modificar `member_id`, `sport_id`, `enrollment_date` ni `deleted_at`.
- El sistema debe validar que la inscripción exista.
- El sistema debe validar que la inscripción no esté eliminada lógicamente (`deleted_at` en `null`).
- Si el body no contiene campos modificables, la operación debe fallar con un error de validación.
- Si `is_active` pasa de `false` a `true`, el sistema debe:
  - validar que el socio exista y tenga estado de cuenta activo;
  - validar que el deporte exista y no esté eliminado lógicamente;
  - validar que no exista otra inscripción activa para el mismo `member_id` y `sport_id`;
  - validar que el cupo del deporte no esté completo.
- Si `is_active` pasa de `true` a `false`, el sistema debe desactivar la inscripción sin ejecutar validaciones adicionales de cupo, duplicados, socio o deporte.
- El campo `enrollment_date` no debe modificarse bajo ninguna circunstancia.
- Al completarse correctamente la operación, el sistema debe guardar la inscripción con su nuevo estado de vigencia.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Enrollment` definida en el TDD-0024 de alta de inscripcion.

Entidad involucrada: `Enrollment`.

| Campo             | Tipo     | Editable | Descripción                           |
|------------------ | -------- | -------- |-------------------------------------- |
| `id`              | UUID     | No       | Clave primaria de la entidad          |
| `member_id`       | UUID     | No       | Referencia al socio                   |
| `sport_id`        | UUID     | No       | Referencia al deporte                 |
| `enrollment_date` | DateTime | No       | Fecha original de inscripción         |
| `is_active`       | Boolean  | Sí       | Indica si la inscripción está vigente |
| `deleted_at`      | DateTime | No       | Marca de baja lógica                  |

### Nota de diseño

> `enrollment_date` representa la fecha original de creación de la inscripción y no debe modificarse en operaciones de actualización.  
> Si se requiere registrar una nueva fecha de inscripción, se debe crear una nueva inscripción en lugar de reutilizar la existente.

---

## Contrato de API (`@alentapp/shared`)

Se reutiliza `EnrollmentDTO`, definido en el TDD de alta de inscripción.

- **Endpoint**: `PATCH /api/v1/enrollments/:id`

- **Request Body** (`UpdateEnrollmentRequest`):

```ts
export interface UpdateEnrollmentRequest {
  is_active?: boolean;
}
```

- **Response exitosa** (`200 OK`):

```ts
{
  data: EnrollmentDTO
}
```

---

## Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `EnrollmentRepository` define el contrato de persistencia. El servicio `EnrollmentValidator` aplica reglas de negocio: no permitir modificar campos inmutables, validar estado de la inscripción y validar condiciones para reactivación.

- **Application**: `UpdateEnrollmentUseCase` orquesta la operación. Recibe el `id` y el body, verifica existencia de la inscripción, valida que no esté eliminada, verifica que se no supere el cupo maximo de deporte en caso de querer reactivarla, valida el body y aplica reglas adicionales en caso de reactivación antes de persistir. Para esa reactivación se apoya en `MemberRepository`, `SportRepository` y `EnrollmentRepository` para verificar estado del socio, disponibilidad del deporte, duplicados activos y cupo.

- **Infrastructure**: `PostgresEnrollmentRepository` implementa el método `update`, junto con consultas auxiliares como `findActiveByMemberAndSport` y `countActiveBySportId`.

- **Delivery**: `EnrollmentController` expone `PATCH /api/v1/enrollments/:id`, valida el request y delega al caso de uso.

---

## Casos de Borde y Errores

| Escenario                                     | Resultado Esperado                                            | Código HTTP               |
|---------------------------------------------- |-------------------------------------------------------------- |-------------------------- |
| ID no corresponde a ninguna inscripción       | Mensaje: "Inscripción no encontrada"                          | 404 Not Found             |
| Inscripción eliminada lógicamente             | Mensaje: "No se puede modificar una inscripción eliminada"    | 409 Conflict              |
| Body vacío                                    | Mensaje: "Se requiere al menos un campo para actualizar"      | 400 Bad Request           |
| Se intenta modificar campos no permitidos     | Mensaje: "Campo no permitido para modificación"               | 400 Bad Request           |
| Reactivación con socio no activo              | Mensaje: "El socio no está habilitado"                        | 409 Conflict              |
| Reactivación con deporte eliminado            | Mensaje: "El deporte no está disponible"                      | 409 Conflict              |
| Inscripción duplicada activa                  | Mensaje: "Ya existe una inscripción activa para este deporte" | 409 Conflict              |
| Cupo completo                                 | Mensaje: "No hay cupo disponible para este deporte"           | 409 Conflict              |
| ID con formato inválido                       | Mensaje: "Identificador de inscripción inválido"              | 400 Bad Request           |
| Se envía el mismo valor actual de `is_active` | Retorna la inscripción sin modificaciones                     | 200 OK                    |
| Desactivación exitosa `true → false`          | Retorna la inscripción con `is_active = false`                | 200 OK                    |
| Reactivación exitosa `false → true`           | Retorna la inscripción con `is_active = true`                 | 200 OK                    |
| Error de conexión a DB                        | Mensaje: "Error interno, reintente más tarde"                 | 500 Internal Server Error |

---

## Plan de Implementación

1. Definir `UpdateEnrollmentRequest` en `@alentapp/shared`.
2. Asegurar que el puerto `EnrollmentRepository` incluya el método `update(id, data)`.
3. Implementar validaciones de dominio:
   - campos inmutables;
   - estado de baja lógica de la inscripción;
   - desactivación sin validaciones adicionales;
   - reactivación con validaciones de socio, deporte, duplicados activos y cupo.
4. Implementar `UpdateEnrollmentUseCase`.
5. Implementar el método `update` en `PostgresEnrollmentRepository`.
6. Implementar el endpoint `PATCH /api/v1/enrollments/:id` en `EnrollmentController`.
7. Registrar la ruta en `app.ts`.
8. Implementar la lógica en frontend para activar/desactivar inscripciones.
9. Escribir tests unitarios:
   - inscripción inexistente;
   - inscripción eliminada;
   - body vacío;
   - modificación inválida;
   - reactivación válida;
   - reactivación inválida (cupo, duplicado, socio).
10. Escribir tests de integración del endpoint.