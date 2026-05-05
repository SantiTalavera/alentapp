---
id: 0009
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-02
titulo: Baja de Deporte Existente
---

# TDD-0009: Baja de Deporte Existente

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo dé de baja un deporte que el club ya no ofrece, sin borrar el registro en base de datos. La baja se realiza mediante **eliminación lógica**: se marca el campo `deleted_at` con la fecha y hora actuales (según el servidor). El deporte deja de aparecer en el **catálogo activo** y **no puede recibir nuevas inscripciones**. Las **inscripciones (`Enrollment`) asociadas no se eliminan**: se conservan como **historial** para auditoría y trazabilidad.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Retirar el deporte del catálogo activo de forma segura y con confirmación previa, **sin perder el historial de inscripciones previas** asociadas a ese deporte.

### Criterios de Aceptación

- El sistema debe pedir una confirmación explícita antes de proceder con la baja.
- El sistema debe validar que el deporte exista antes de intentar darlo de baja.
- El sistema debe validar que el deporte no haya sido dado de baja previamente (`deleted_at` debe estar en `null`).
- Al dar de baja el deporte, el sistema debe establecer `deleted_at` con la fecha y hora actuales del servidor.
- El registro de `Sport` permanece en la base de datos.
- No se eliminan los `Enrollment` asociados; se conservan como historial.
- El deporte dado de baja no debe aparecer en los listados activos ni estar disponible para nuevas inscripciones.
- Si la baja es exitosa, el sistema debe retornar el `SportDTO` actualizado dentro de `{ data }` con estado `200 OK`.

## Diseño Técnico (RFC)

### Modelo de Datos

La baja de un deporte es **soft delete** sobre la entidad principal `Sport`. La relación con `Enrollment` se mantiene para conservar historial; **no** se trata de una entidad a eliminar en este flujo.

Entidad principal: `Sport`.

| Campo                          | Tipo                 | Nullable | Descripción |
| ------------------------------ | -------------------- | -------- | ----------- |
| `id`                           | UUID                 | No       | Identificador del deporte. |
| `name`                         | String               | No       | Nombre del deporte. |
| `description`                  | String               | No       | Descripción del deporte. |
| `max_capacity`                 | Int                  | No       | Cupo máximo del deporte. |
| `additional_price`             | Float                | No       | Precio adicional del deporte. |
| `requires_medical_certificate` | Boolean              | No       | Indica si el deporte requiere certificado médico. |
| `deleted_at`                   | DateTime             | Si       | Marca de baja lógica. `null` indica deporte activo; con valor indica deporte eliminado lógicamente. |

Los registros de **`Enrollment`** vinculados al deporte (por `sport_id`) **no se borran** en la operación de baja del deporte; permanecen como historial.

> **Nota de diseño**: La baja lógica de `Sport` no elimina sus `Enrollment` asociados. Estos registros se conservan como historial. Los casos de uso de `Enrollment` deberán impedir crear nuevas inscripciones asociadas a deportes con `deleted_at` distinto de `null`.

### Contrato de API (@alentapp/shared)

No se requieren tipos nuevos en el paquete compartido. Se reutiliza `SportDTO`, definido en el TDD de alta de deporte, que incluye el campo `deleted_at`.

- Endpoint: `DELETE /api/v1/sports/:id`
- Request Body: `None`

**Response exitosa (`200 OK`):**

```ts
{
  data: SportDTO
}
```

> Se devuelve `200 OK` con el DTO actualizado, en lugar de `204 No Content`, porque la baja lógica actualiza el recurso estableciendo `deleted_at`.

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `SportRepository` con métodos `findById(id)` y `softDelete(id)`. Permite verificar existencia y marcar el deporte como eliminado lógicamente sin depender de Prisma.
2. **Servicio de Dominio / Entidad**: `Sport` o `SportValidator`, encargado de validar que el deporte exista y que no tenga `deleted_at` informado antes de permitir la baja.
3. **Caso de Uso**: `DeleteSportUseCase`, que recibe el `id`, verifica existencia, valida que no esté eliminado previamente y delega el soft delete al repositorio.
4. **Adaptador de Salida**: `PostgresSportRepository`, que implementa `softDelete` usando Prisma mediante una actualización de `deleted_at = now()` y retorna el `SportDTO` actualizado.
5. **Adaptador de Entrada**: `SportController`, ruta `DELETE /api/v1/sports/:id`, extrae el `id`, invoca el caso de uso y responde `200 OK` con `{ data: SportDTO }`.

**Importante**: No incluir `EnrollmentRepository` como dependencia del caso de uso de baja de `Sport`. `Enrollment` se verá afectado solo a nivel de **reglas futuras**: no permitir nuevas inscripciones a deportes eliminados lógicamente.

## Casos de Borde y Errores

| Escenario                          | Resultado esperado                                                             | Código HTTP               |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| ID no corresponde a ningún deporte | "Deporte no encontrado"                                                        | 404 Not Found             |
| ID con formato inválido            | "Identificador de deporte inválido"                                            | 400 Bad Request           |
| Deporte ya eliminado lógicamente   | "El deporte ya fue dado de baja"                                               | 409 Conflict              |
| Baja lógica exitosa                | `SportDTO` con `deleted_at` poblado; el deporte desaparece de listados activos | 200 OK                    |
| Error de conexión a DB             | "Error interno, reintente más tarde"                                           | 500 Internal Server Error |

## Plan de Implementación

1. Confirmar que el modelo `Sport` incluya el campo `deleted_at` nullable, definido desde el TDD de alta.
2. Confirmar que `SportDTO` incluya `deleted_at: string | null`.
3. Agregar al puerto `SportRepository` el método `softDelete(id): Promise<SportDTO>` y asegurar que exista `findById(id)`.
4. Implementar `DeleteSportUseCase`, validando existencia del deporte y que `deleted_at` esté en `null`.
5. Implementar `softDelete` en `PostgresSportRepository` usando Prisma, actualizando `deleted_at` con la fecha actual del servidor.
6. Implementar el endpoint `DELETE /api/v1/sports/:id` en `SportController` y registrarlo en Fastify.
7. Añadir el método `delete` o `softDelete` al servicio frontend.
8. Enlazar el botón de baja en la vista de deportes, agregando confirmación visual antes de ejecutar la operación.
9. Asegurar que los listados y búsquedas operativas de deportes excluyan registros con `deleted_at` distinto de `null`.
10. Escribir tests unitarios para el caso de uso: deporte inexistente, deporte ya eliminado y baja lógica exitosa.
11. Escribir tests de integración para el endpoint `DELETE /api/v1/sports/:id`.
