---
autor: Joaquin Montes
fecha: 2026-05-02
titulo: Eliminar casillero
---

# TDD-0005: Eliminar casillero

## Contexto de Negocio (PRD)

### Objetivo

Cuando un casillero deja de estar disponible de forma permanente —ya sea porque fue retirado físicamente del club o porque dejó de operar— el administrador necesita poder darlo de baja en el sistema. La baja no borra el registro: el casillero pasa a estar inactivo, preservando así cualquier información histórica vinculada a él.

### User Persona

- **Nombre**: Administrador del club
- **Necesidad**: Retirar casilleros del circuito operativo sin perder el historial, y tener la certeza de que un casillero dado de baja no va a aparecer disponible ni podrá ser asignado.

### Criterios de Aceptación

- Al dar de baja un casillero, su campo `is_active` pasa a `false`. El registro permanece en la base de datos.
- El sistema debe verificar que el casillero exista antes de intentar la baja.
- Si el casillero ya estaba inactivo, el sistema debe rechazar la operación.
- Un casillero inactivo queda excluido de cualquier operación futura (asignación, modificación de estado, etc.).
- La respuesta debe incluir el estado final del casillero para confirmar la operación.

> **Nota de diseño**: se eligió soft delete en lugar de eliminación física para mantener trazabilidad. Si en el futuro se necesita auditar qué casilleros tuvo el club, esa información va a seguir disponible.

## Diseño Técnico (RFC)

### Modelo de Datos

No se agregan campos nuevos al modelo. Se opera sobre el campo `is_active` ya definido en `Locker`:

| Campo       | Tipo    | Descripción                                       |
|-------------|---------|---------------------------------------------------|
| `id`        | UUID    | Identifica el casillero a dar de baja             |
| `is_active` | Boolean | Pasa de `true` a `false` al ejecutar la baja      |

El resto de los campos (`number`, `location`, `status`, `member_id`) no se modifican durante este flujo.

### Contrato de API (`@alentapp/shared`)

**`DELETE /api/v1/lockers/:id`**

Request: sin body.

Response `200 OK`:
```ts
{
  id: string;
  number: number;
  location: string;
  status: "Available" | "Occupied" | "Maintenance";
  is_active: boolean;  // siempre false en esta respuesta
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: La entidad `Locker` incorpora la regla de que no se puede dar de baja un casillero que ya está inactivo. Esto se valida antes de cualquier escritura.

- **Application**: `DeleteLockerUseCase` recibe el `id`, busca el casillero, verifica que exista y que esté activo, y le pide al repositorio que actualice `is_active` a `false`.

- **Infrastructure**: `PostgresLockerRepository` implementa el método `deactivate(id)` que hace un `update` con Prisma sobre el campo `is_active`. `LockerController` expone el endpoint `DELETE`, extrae el `id` de los params y delega al caso de uso.

## Casos de Borde y Errores

| Escenario                           | Resultado Esperado                                    | Código HTTP      |
|-------------------------------------|-------------------------------------------------------|------------------|
| El ID no corresponde a ningún casillero | Error: casillero no encontrado                    | 404 Not Found    |
| El casillero ya tiene `is_active: false` | Error: el casillero ya fue dado de baja          | 409 Conflict     |
| Fallo inesperado en la base de datos | Error interno                                        | 500 Server Error |

## Plan de Implementación

1. Verificar que el campo `is_active` esté presente en el modelo Prisma de `Locker`.
2. Agregar al puerto `LockerRepository` el método `deactivate(id: string)`.
3. Implementar `DeleteLockerUseCase` con las validaciones de existencia e inactividad previa.
4. Implementar `deactivate` en `PostgresLockerRepository`.
5. Exponer el endpoint `DELETE /api/v1/lockers/:id` en `LockerController`.
6. Escribir tests unitarios: baja exitosa, casillero no encontrado, casillero ya inactivo.
7. Escribir tests de integración para el endpoint.