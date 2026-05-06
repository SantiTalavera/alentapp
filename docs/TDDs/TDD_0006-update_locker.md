---
id: 0006
autor: Joaquin Montes
fecha: 2026-05-02
titulo: Modificación de casillero
---

# TDD-0006: Modificación de casillero

## Contexto de Negocio (PRD)

### Objetivo

Una vez que un casillero está registrado en el sistema, puede ser necesario corregir su número, cambiar su ubicación o actualizar su estado operativo. Esta funcionalidad permite realizar esas modificaciones garantizando que las reglas del negocio se sigan cumpliendo: en particular, que un casillero en mantenimiento no pueda tener un socio asignado en ningún momento.

### User Persona

- **Nombre**: Administrador del club
- **Necesidad**: Poder editar los datos de un casillero ya existente sin comprometer la integridad del sistema, sabiendo que el sistema le va a advertir si intenta dejar el casillero en un estado inválido.

### Criterios de Aceptación

- Se debe poder modificar `number`, `location`, `status` y `member_id` de un casillero existente.
- Si el casillero no existe, la operación debe fallar con un error claro antes de intentar cualquier cambio.
- El campo `number` sigue siendo obligatorio, único entre todos los casilleros y mayor a cero.
- El `status` solo puede tomar los valores permitidos: `Available`, `Occupied` o `Maintenance`.
- **Regla de negocio principal**: si el `status` es o pasa a ser `Maintenance`, el campo `member_id` debe ser nulo. El sistema rechaza cualquier combinación que viole esta restricción.
- Al completarse correctamente, se devuelve el casillero con todos sus datos actualizados.

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Locker` ya existente. Los campos modificables en este caso de uso son:

| Campo       | Tipo         | Descripción                                                         |
|-------------|--------------|---------------------------------------------------------------------|
| `number`    | Int          | Número del casillero. Continúa siendo único y mayor a cero         |
| `location`  | String       | Ubicación física dentro del club                                    |
| `status`    | String       | Estado operativo: `Available`, `Occupied` o `Maintenance`           |
| `member_id` | UUID \| null | Socio asignado. Debe ser nulo si `status` es `Maintenance`          |

La restricción clave: **`status = "Maintenance"` y `member_id != null` son mutuamente excluyentes**.

### Contrato de API (`@alentapp/shared`)

**`PATCH /api/v1/lockers/:id`**

Request:
```ts
{
  number: number;
  location: string;
  status: "Available" | "Occupied" | "Maintenance";
  member_id?: string | null;
}
```

Response `200 OK`:
```ts
{
  "data": {
    "id": string;
    "number": number;
    "location": string;
    "status": "Available" | "Occupied" | "Maintenance";
    "member_id": string | null;
    "is_active": boolean;
  }
}
```

**Response Body (Errors 4xx / 500)**:
```ts
{
  error: string; // Mensaje descriptivo del error
}
```

> Se usa `PATCH` en lugar de `PUT` porque no se reemplaza el recurso completo, sino que se actualizan campos puntuales.

### Componentes de Arquitectura Hexagonal

- **Domain**: La entidad `Locker` expone el método `isAssignable()` que devuelve `false` cuando el status es `Maintenance`. Esta lógica vive en el dominio para que no pueda ser salteada desde ninguna capa superior.

- **Application**: `UpdateLockerUseCase` orquesta la operación: primero verifica que el casillero exista, luego que el nuevo `number` no esté en uso por otro casillero, luego aplica la regla de `Maintenance` vs `member_id`, y finalmente delega la escritura al repositorio.

- **Infrastructure**: `PostgresLockerRepository` implementa `findById`, `findByNumber` y `update` usando Prisma. `LockerController` recibe el request `PATCH`, extrae `id` de los params y el body tipado, y llama al caso de uso correspondiente.

## Casos de Borde y Errores

| Escenario                                                         | Resultado Esperado (JSON)                                    | Código HTTP               |
|-------------------------------------------------------------------|--------------------------------------------------------------|---------------------------|
| ID no corresponde a ningún casillero                              | `{ "error": "casillero no encontrado" }`                     | 404 Not Found             |
| `number` ausente en el body                                       | `{ "error": "campo requerido" }`                             | 400 Bad Request           |
| `number` es cero o negativo                                       | `{ "error": "debe ser mayor a cero" }`                       | 400 Bad Request           |
| El `number` enviado pertenece a otro casillero                    | `{ "error": "número ya está en uso" }`                       | 409 Conflict              |
| `status` con valor fuera de los permitidos                        | `{ "error": "estado no válido" }`                            | 400 Bad Request           |
| `status: "Maintenance"` con `member_id` no nulo                  | `{ "error": "casillero en mantenimiento no puede tener socio" }` | 422 Unprocessable Entity  |
| `member_id` presente y el status actual/nuevo es `"Maintenance"` | `{ "error": "no se puede asignar socio en este estado" }`    | 422 Unprocessable Entity  |
| Fallo inesperado en la base de datos                              | `{ "error": "Error interno" }`                               | 500 Server Error          |

## Plan de Implementación

1. Agregar tipo `UpdateLockerRequest` en `@alentapp/shared`.
2. Incorporar el método `isAssignable()` a la entidad `Locker` en el dominio.
3. Implementar `UpdateLockerUseCase` con todas las validaciones encadenadas.
4. Agregar los métodos `findById` y `update` al repositorio si no existen.
5. Implementar el endpoint `PATCH /api/v1/lockers/:id` en el controlador.
6. Escribir tests unitarios para cada rama del caso de uso (casillero no encontrado, número duplicado, violación de Maintenance, éxito).
7. Escribir tests de integración para el endpoint.