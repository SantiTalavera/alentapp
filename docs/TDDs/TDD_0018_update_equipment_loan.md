---
id: 0018
estado: Propuesto
autor: Agostina Pascucci
fecha: 2026-05-02
titulo: Actualización de Estado de Préstamo de Equipamiento
---

# TDD-0018: Actualización de Estado de Préstamo de Equipamiento

## Contexto de Negocio (PRD)

### Objetivo

Permitir que el administrativo actualice el estado de un préstamo existente, principalmente para registrar la devolución de un ítem (`Loaned → Returned`) o declarar que fue dañado (`Loaned → Damaged`). También permite corregir la `due_date` pactada. La operación es una actualización parcial: solo se modifican los campos explícitamente enviados en el cuerpo de la petición.

### User Persona

- **Nombre**: Administración del Club
- **Necesidad**: Cuando un socio devuelve un equipo, necesita marcarlo como "Returned" con un solo clic desde la tabla de préstamos. Si el equipo llega en mal estado, debe poder registrarlo como "Damaged" para sostener el reclamo al socio. No quiere que un préstamo ya cerrado pueda ser reabierto accidentalmente.

### Criterios de Aceptación

- El sistema debe validar que el préstamo (`id`) exista y esté activo (`deleted_at IS NULL`) antes de intentar actualizarlo.
- Solo se permiten las siguientes **transiciones de estado**:
  - `Loaned → Returned` ✅ (devolución normal)
  - `Loaned → Damaged` ✅ (declaración de daño)
  - `Returned → *` ❌ (préstamo cerrado, no se puede reabrir)
  - `Damaged → *` ❌ (ítem dañado, requiere proceso externo al sistema)
- La actualización es **parcial**: campos no enviados no se modifican.
- Si solo se envía `due_date` sin `status`, se actualiza solo la fecha de devolución sin cambiar el estado.
- Si la actualización es exitosa, se retorna el objeto completo del préstamo actualizado con HTTP `200 OK`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia. Se opera sobre el modelo `EquipmentLoan` definido en TDD-0016.

La regla de transición de estado se implementa como **máquina de estados finita** a nivel de capa de dominio:

| Estado Actual | Transición a `Returned` | Transición a `Damaged` | Transición a `Loaned` |
| ------------- | ----------------------- | ---------------------- | --------------------- |
| `Loaned`      | ✅ Permitido             | ✅ Permitido            | ❌ Prohibido (loop)   |
| `Returned`    | ❌ Prohibido             | ❌ Prohibido            | ❌ Prohibido          |
| `Damaged`     | ❌ Prohibido             | ❌ Prohibido            | ❌ Prohibido          |

Los estados `Returned` y `Damaged` son **estados terminales**: una vez alcanzados, el préstamo no puede modificarse. Representan historial de auditoría inmutable.

### Contrato de API (`@alentapp/shared`)

Se añade la interfaz `UpdateEquipmentLoanRequest` al paquete compartido. Todos los campos son opcionales para soportar la actualización parcial.

- **Endpoint**: `PATCH /api/v1/loans/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador del préstamo a actualizar.
- **Request Body** (`UpdateEquipmentLoanRequest`):

```ts
export interface UpdateEquipmentLoanRequest {
  status?: LoanStatus;   // 'Loaned' | 'Returned' | 'Damaged' (opcional)
  due_date?: string;     // ISO DateTime String (opcional)
}
```

- **Response exitosa** (`200 OK`):

```ts
{
  data: EquipmentLoanDTO   // El préstamo completo con los valores actualizados
}
```

> Se usa `PATCH` porque no se reemplaza el recurso completo, sino que se actualizan campos puntuales.

### Componentes de Arquitectura Hexagonal

Se amplían los componentes creados en TDD-0016 sin crear nuevos archivos de infraestructura.

- **Domain**: El método `update(id, data)` ya está declarado en el puerto `EquipmentLoanRepository`. Se agrega el método síncrono `validateStatusTransition(currentStatus, newStatus)` a `EquipmentLoanValidator`: si el estado actual es `Returned` o `Damaged` (terminales), lanza error de dominio descriptivo.

- **Application**: `UpdateEquipmentLoanUseCase` busca el préstamo con `findById` (lanza "no existe" si `null`), valida la transición de estado si se envía `status`, valida el formato ISO de `due_date` si se envía, y delega la escritura al repositorio.

- **Infrastructure**: El método `update` en `PostgresEquipmentLoanRepository` construye dinámicamente el objeto de actualización incluyendo solo los campos enviados en el request (actualización parcial) y retorna el DTO completo actualizado.

- **Delivery**: `EquipmentLoanController` expone `PATCH /api/v1/loans/:id`, extrae el `id` del path y el body como `UpdateEquipmentLoanRequest`, y mapea los errores a `404`, `422` o `400` según corresponda. La ruta se registra en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                               | Resultado Esperado                                                         | Código HTTP               |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `id` de préstamo inexistente o eliminado lógicamente    | Error: el préstamo no existe                                               | 404 Not Found             |
| Intento de cambiar estado desde `Returned`              | Error: no se puede cambiar el estado de un préstamo en estado Returned     | 422 Unprocessable Entity  |
| Intento de cambiar estado desde `Damaged`               | Error: no se puede cambiar el estado de un préstamo en estado Damaged      | 422 Unprocessable Entity  |
| Intento de transición `Loaned → Loaned` (mismo estado)  | El préstamo no cambia; retorna el objeto sin modificaciones                | 200 OK                    |
| `due_date` con formato no ISO 8601                      | Error: formato de fecha de devolución inválido                             | 400 Bad Request           |
| Body vacío `{}` (sin campos)                            | El préstamo se retorna sin ninguna modificación                            | 200 OK                    |
| Solo se actualiza `due_date` sin cambiar `status`       | El `status` se mantiene; solo cambia `due_date`                           | 200 OK                    |
| Actualización exitosa `Loaned → Returned`               | `EquipmentLoanDTO` con `status: 'Returned'`                               | 200 OK                    |
| Fallo inesperado en la base de datos                    | Error interno                                                              | 500 Server Error          |

## Plan de Implementación

1. Añadir `UpdateEquipmentLoanRequest` al paquete `@alentapp/shared` (`packages/shared/index.ts`).
2. Confirmar que el Puerto `EquipmentLoanRepository` en `src/domain/` ya incluya el método `update(id, data)`.
3. Agregar el método `validateStatusTransition(currentStatus, newStatus)` al `EquipmentLoanValidator.ts`.
4. Crear `UpdateEquipmentLoanUseCase.ts` en `src/application/` con el flujo de orquestación completo.
5. Implementar el método `update` en `PostgresEquipmentLoanRepository.ts` con actualización parcial.
6. Agregar el método `update` al `EquipmentLoanController` con el mapeo de errores correcto.
7. Registrar la ruta `PATCH /api/v1/loans/:id` en `src/app.ts`.
8. Agregar el método `update` al servicio frontend `loans.ts`.
9. Conectar los botones de acción ("Marcar devuelto", "Marcar dañado") en la vista `EquipmentLoans.tsx`.
10. Escribir tests unitarios: actualización exitosa (`Loaned → Returned`, `Loaned → Damaged`), préstamo inexistente, transición desde estado terminal, `due_date` con formato inválido, body vacío.
11. Escribir tests de integración para el endpoint `PATCH /api/v1/loans/:id`.
