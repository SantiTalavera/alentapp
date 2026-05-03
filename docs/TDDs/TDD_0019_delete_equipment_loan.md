---
id: 0019
estado: Propuesto
autor: Agostina Pascucci
fecha: 2026-05-02
titulo: Eliminación Lógica de Préstamo de Equipamiento
---

# TDD-0019: Eliminación Lógica de Préstamo de Equipamiento

## Contexto de Negocio (PRD)

### Objetivo

Cuando un préstamo fue registrado por error y aún no fue procesado, la administración necesita poder darlo de baja en el sistema. La baja no borra el registro: el préstamo queda marcado como inactivo mediante el campo `deleted_at`, preservando así el historial de auditoría. La operación está restringida a préstamos en estado `Loaned`; los préstamos ya procesados (`Returned` o `Damaged`) no pueden eliminarse.

### User Persona

- **Nombre**: Administración del Club
- **Necesidad**: Si cometió un error al registrar un préstamo (socio equivocado, ítem equivocado) y el préstamo aún no fue procesado, necesita poder quitarlo de la vista activa antes de que quede en el historial visible. No quiere afectar préstamos que ya fueron devueltos o declarados dañados, ya que eso eliminaría el rastro de auditoría.

> **Nota de diseño**: se eligió soft delete en lugar de eliminación física para mantener trazabilidad. Si en el futuro se necesita auditar qué préstamos fueron registrados por error, esa información va a seguir disponible en la base de datos.

### Criterios de Aceptación

- El sistema debe pedir una **confirmación explícita** (advertencia visual en el frontend, vía `window.confirm`) antes de enviar la petición de borrado lógico.
- El sistema debe verificar que el préstamo exista y esté activo (`deleted_at IS NULL`) antes de intentar marcarlo como eliminado.
- El sistema **solo debe permitir eliminar lógicamente préstamos en estado `Loaned`**. Un préstamo en estado `Returned` o `Damaged` no puede eliminarse.
- Al dar de baja un préstamo, su campo `deleted_at` se establece con el timestamp actual del servidor. El registro permanece en la base de datos pero queda excluido de las consultas normales.
- La respuesta debe incluir el estado final del préstamo para confirmar la operación.

## Diseño Técnico (RFC)

### Modelo de Datos

No se requieren cambios estructurales al esquema de persistencia para este TDD; el campo `deleted_at` (nullable, timestamp con zona) fue incorporado al modelo `EquipmentLoan` en TDD-0016.

La operación consiste exclusivamente en **actualizar** el campo `deleted_at` con el timestamp del servidor (`now()`). No se elimina ninguna fila de la tabla `equipment_loans`.

**Comportamiento del campo `deleted_at`:**

| Valor de `deleted_at` | Significado                              |
| --------------------- | ---------------------------------------- |
| `null`                | Registro activo; visible en la aplicación. |
| Timestamp             | Registro eliminado lógicamente; oculto en las consultas normales. |

**Restricción de integridad referencial**: La clave foránea `member_id` permanece intacta; el registro eliminado lógicamente sigue siendo visible en la tabla y satisface la restricción. No existe conflicto con `ON DELETE RESTRICT`.

### Contrato de API (`@alentapp/shared`)

No se requieren tipos nuevos en el paquete compartido. Se reutiliza `EquipmentLoanDTO` definido en TDD-0016, que ya incluye el campo `deleted_at`.

- **Endpoint**: `DELETE /api/v1/prestamos/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del préstamo a eliminar lógicamente.
- **Request Body**: `None`
- **Response exitosa** (`200 OK`):

```ts
{
  data: EquipmentLoanDTO   // El préstamo con deleted_at poblado
}
```

> **Decisión de diseño**: Se devuelve `200 OK` con el DTO completo (en lugar de `204 No Content`) para que el frontend pueda actualizar su estado local sin necesidad de hacer una segunda petición `GET`. El campo `deleted_at` en la respuesta confirma explícitamente que el registro fue marcado como eliminado.

### Componentes de Arquitectura Hexagonal

Se amplían los componentes creados en TDD-0016 sin crear nuevos archivos de dominio.

- **Domain**: El método `softDelete(id)` ya está declarado en el puerto `EquipmentLoanRepository`. No se requieren nuevos métodos en `EquipmentLoanValidator`: la regla de estado permitido (`solo Loaned`) es simple y se implementa directamente en el caso de uso.

- **Application**: `DeleteEquipmentLoanUseCase` busca el préstamo con `findById` (lanza "no existe" si `null`), verifica que `status === 'Loaned'` (lanza error descriptivo si es `Returned` o `Damaged`), y delega el marcado lógico a `softDelete`. El `findById` que ya filtra `deleted_at IS NULL` garantiza que un préstamo ya eliminado devuelva siempre `404`.

- **Infrastructure**: El método `softDelete` en `PostgresEquipmentLoanRepository` ejecuta `UPDATE SET deleted_at = now()` y retorna el DTO completo con `deleted_at` poblado mediante el método privado `mapToDTO`.

- **Delivery**: `EquipmentLoanController` expone `DELETE /api/v1/prestamos/:id`, extrae el `id` del path y mapea los errores a `404` (no existe), `422` (estado no permitido) o `500` (error inesperado). En éxito responde `200` con el DTO completo. La ruta se registra en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                                        | Resultado Esperado                                                              | Código HTTP               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| `id` con formato no UUID                                         | Error: formato de id de préstamo inválido                                       | 400 Bad Request           |
| `id` no corresponde a ningún préstamo activo                     | Error: el préstamo no existe                                                    | 404 Not Found             |
| `id` de préstamo ya eliminado lógicamente (`deleted_at != null`) | Error: el préstamo no existe (el filtro `deleted_at IS NULL` lo trata igual)    | 404 Not Found             |
| Préstamo en estado `Returned`                                    | Error: no se puede eliminar un préstamo con estado Returned                     | 422 Unprocessable Entity  |
| Préstamo en estado `Damaged`                                     | Error: no se puede eliminar un préstamo con estado Damaged                      | 422 Unprocessable Entity  |
| Eliminación lógica exitosa de préstamo en estado `Loaned`        | `EquipmentLoanDTO` con `deleted_at` poblado; el préstamo desaparece del listado | 200 OK                    |
| Fallo inesperado en la base de datos                             | Error interno                                                                   | 500 Server Error          |

## Plan de Implementación

1. Confirmar que el campo `deleted_at` (nullable timestamp) ya existe en el esquema Prisma del modelo `EquipmentLoan` (pre-requisito: TDD-0016 completado).
2. Confirmar que el Puerto `EquipmentLoanRepository` en `src/domain/` ya incluya el método `softDelete(id): Promise<EquipmentLoanDTO>` (pre-requisito: TDD-0016 completado).
3. Implementar el método `softDelete` en `PostgresEquipmentLoanRepository.ts` con la actualización `SET deleted_at = now()` y el mapeo al DTO.
4. Verificar que los métodos `findAll` y `findById` en `PostgresEquipmentLoanRepository.ts` apliquen el filtro `deleted_at IS NULL` (pre-requisito: TDD-0017 completado).
5. Crear `DeleteEquipmentLoanUseCase.ts` en `src/application/` con la validación de existencia y la regla de estado permitido.
6. Agregar el método `delete` al `EquipmentLoanController` con el mapeo de errores correcto (400, 404, 422, 500) y la respuesta `200` con el DTO.
7. Registrar la ruta `DELETE /api/v1/prestamos/:id` en `src/app.ts`.
8. Agregar el método `delete` al servicio frontend `loans.ts`.
9. Enlazar el botón de eliminación en `EquipmentLoans.tsx` con la llamada al servicio, precedida por `window.confirm` para la confirmación explícita del usuario, y eliminar el elemento de la lista local al recibir la respuesta exitosa.
10. Escribir tests unitarios: eliminación exitosa de préstamo `Loaned`, préstamo inexistente, préstamo ya eliminado lógicamente, intento de eliminar `Returned` o `Damaged`.
11. Escribir tests de integración para el endpoint `DELETE /api/v1/prestamos/:id`.
