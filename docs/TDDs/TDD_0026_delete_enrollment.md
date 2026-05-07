---
id: 0026
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-06
titulo: Baja de Inscripción Existente
---

# TDD-0026: Baja de Inscripción Existente

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo elimine lógicamente una inscripción existente, retirándola de las operaciones activas sin perder su registro histórico en la base de datos.

La baja se realiza mediante **eliminación lógica**, estableciendo el campo `deleted_at` con la fecha y hora actuales del servidor. Además, la inscripción deja de estar vigente (`is_active = false`).

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Eliminar una inscripción cargada por error o que ya no deba considerarse operativa, sin perder el historial asociado.

---

## Criterios de Aceptación

- El sistema debe permitir eliminar una inscripción mediante su `id`.
- El sistema debe validar que la inscripción exista.
- El sistema debe validar que la inscripción no haya sido eliminada previamente (`deleted_at` en `null`).
- Al realizar la baja:
  - se debe establecer `deleted_at` con la fecha actual del servidor;
  - se debe establecer `is_active = false`.
- El registro no debe eliminarse físicamente de la base de datos.
- La inscripción eliminada no debe aparecer en listados operativos.
- La inscripción eliminada no debe ser considerada en validaciones de cupo ni duplicados.
- Si la baja es exitosa, la API debe responder con estado `200 OK` y retornar el `EnrollmentDTO` actualizado.
- - Al realizar la baja, el sistema debe establecer `deleted_at` con la fecha y hora actuales del servidor.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Enrollment` definida en el TDD-0024 de alta de inscripción.

| Campo             | Tipo     | Nullable | Descripción                           |
|------------------ |--------- | -------- |-------------------------------------- |
| `id`              | UUID     | No       | Identificador de la inscripción       |
| `member_id`       | UUID     | No       | Referencia al socio                   |
| `sport_id`        | UUID     | No       | Referencia al deporte                 |
| `enrollment_date` | DateTime | No       | Fecha original de inscripción         |
| `is_active`       | Boolean  | No       | Indica si la inscripción está vigente |
| `deleted_at`      | DateTime | Sí       | Marca de baja lógica                  |


### Nota de diseño

> Una inscripción representa un hecho de negocio: un socio estuvo inscripto a un deporte en una fecha determinada. Por este motivo, no se elimina físicamente el registro, ya que conserva valor histórico para auditoría, trazabilidad, reportes y análisis de cupos.
>
> Una inscripción eliminada lógicamente se considera fuera del circuito operativo del sistema. Para efectos de negocio, como cupo, duplicados y listados operativos, solo se consideran las inscripciones con `is_active = true` y `deleted_at = null`.

---

## Contrato de API (`@alentapp/shared`)

Se reutiliza `EnrollmentDTO`, definido en el TDD-0024 de alta.

- **Endpoint**: `DELETE /api/v1/enrollments/:id`
- **Request Body**: `None`

- **Response exitosa** (`200 OK`):

```ts
{
  data: EnrollmentDTO
}
```

> Se retorna el DTO actualizado porque la operación modifica el recurso (`deleted_at` y `is_active`).

---

## Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `EnrollmentRepository` define el contrato de persistencia. El servicio `EnrollmentValidator` valida que la inscripción exista y que no esté eliminada previamente.

- **Application**: `DeleteEnrollmentUseCase` orquesta la operación. Recibe el `id`, verifica existencia de la inscripción, valida que no esté eliminada y delega la baja lógica al repositorio.

- **Infrastructure**: `PostgresEnrollmentRepository` implementa el método `softDelete`, actualizando `deleted_at` con la fecha actual y `is_active` a `false`.

- **Delivery**: `EnrollmentController` expone `DELETE /api/v1/enrollments/:id`, valida el parámetro, invoca el caso de uso y devuelve `200 OK` con `{ data: EnrollmentDTO }`.

---

## Casos de Borde y Errores

| Escenario                               | Resultado Esperado                                             | Código HTTP               |
|---------------------------------------- |--------------------------------------------------------------- |-------------------------- |
| ID no corresponde a ninguna inscripción | Mensaje: "Inscripción no encontrada"                           | 404 Not Found             |
| ID con formato inválido                 | Mensaje: "Identificador de inscripción inválido"               | 400 Bad Request           |
| Inscripción ya eliminada                | Mensaje: "La inscripción ya fue eliminada"                     | 409 Conflict              |
| Baja lógica exitosa                     | `EnrollmentDTO` con `deleted_at` poblado y `is_active = false` | 200 OK                    |
| Error de conexión a DB                  | Mensaje: "Error interno, reintente más tarde"                  | 500 Internal Server Error |

---

## Plan de Implementación

1. Confirmar que el modelo `Enrollment` incluya el campo `deleted_at` nullable.
2. Confirmar que `EnrollmentDTO` incluya `deleted_at` e `is_active`.
3. Agregar el método `softDelete(id)` al puerto `EnrollmentRepository`.
4. Implementar `DeleteEnrollmentUseCase`, validando existencia y estado de la inscripción.
5. Implementar `softDelete` en `PostgresEnrollmentRepository`:
   - actualizar `deleted_at = now()`
   - actualizar `is_active = false`
6. Implementar el endpoint `DELETE /api/v1/enrollments/:id` en `EnrollmentController`.
7. Registrar la ruta en `app.ts`.
8. Agregar acción de eliminación en frontend con confirmación previa.
9. Asegurar que listados y validaciones excluyan `deleted_at != null`.
10. Escribir tests unitarios:
   - inscripción inexistente;
   - inscripción ya eliminada;
   - eliminación exitosa.
11. Escribir tests de integración del endpoint.