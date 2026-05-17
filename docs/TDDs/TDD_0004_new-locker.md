---
id: 0004
autor: Joaquin Montes
fecha: 2026-05-02
titulo: Alta de casillero
---

# TDD-0004: Alta de casillero

## Contexto de Negocio (PRD)

### Objetivo

El club necesita llevar un registro ordenado de sus casilleros físicos. Esta funcionalidad cubre el proceso de incorporar un nuevo casillero al sistema, asegurando que cada uno tenga un identificador numérico único y quede en un estado inicial coherente con el resto de la operatoria del club.

### User Persona

- **Nombre**: Administrador del club
- **Necesidad**: Poder incorporar casilleros al sistema sin riesgo de generar duplicados ni inconsistencias, y que el casillero quede listo para ser operado desde el momento de su creación.

### Criterios de Aceptación

- Se debe poder crear un casillero indicando su número y su ubicación dentro del club.
- El campo `number` es obligatorio y debe ser un entero mayor a cero.
- El campo `location` es obligatorio.
- No puede registrarse un casillero si ya existe otro con el mismo `number`.
- Todo casillero recién creado debe tener `status: "Available"`, `is_active: true` y `member_id: null` de forma automática, sin que el usuario los especifique.
- Ante un número duplicado, el sistema debe devolver un error descriptivo sin persistir nada.

## Diseño Técnico (RFC)

### Modelo de Datos

Entidad involucrada: `Locker`.

| Campo       | Tipo    | Descripción                                              |
|-------------|---------|----------------------------------------------------------|
| `id`        | UUID    | Clave primaria generada automáticamente                  |
| `number`    | Int     | Número del casillero. Único y mayor a cero               |
| `location`  | String  | Descripción de la ubicación física dentro del club       |
| `status`    | String  | Estado operativo. Se inicializa siempre en `Available`   |
| `member_id` | UUID    | Socio asignado. Se inicializa siempre en `null`         |
| `is_active` | Boolean | Indica si el casillero está activo. Por defecto `true`   |

Valores válidos para `status`: `Available`, `Occupied`, `Maintenance`.

### Contrato de API (`@alentapp/shared`)

**`POST /api/v1/lockers`**

**Request Body** (`CreateLockerRequest`):
```ts
{
  number: number;    // requerido, entero > 0
  location: string;  // requerido
}
```

**Response Body (Success 201)**:
```ts
{
  "data": {
    "id": string;
    "number": number;
    "location": string;
    "status": "Available";
    "member_id": null;
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

### Componentes de Arquitectura Hexagonal

- **Domain**: Entidad `Locker` con sus campos: `number` único y positivo, `location` obligatorio, y estado inicial fijo en `Available`. El valor de `is_active` también se establece en la construcción de la entidad.

- **Application**: `CreateLockerUseCase` recibe los datos del request, verifica mediante el repositorio que no exista otro casillero con el mismo `number`, construye la entidad y delega la persistencia.

- **Infrastructure**: `PostgresLockerRepository` implementa el puerto de dominio usando Prisma. Captura el error `P2002` de constraint único y lo traduce a un error de dominio comprensible. `LockerController` expone el endpoint, valida el body y llama al caso de uso.

## Casos de Borde y Errores

| Escenario                              | Resultado Esperado (JSON)                       | Código HTTP      |
|----------------------------------------|-------------------------------------------------|------------------|
| Falta el campo `number`                | `{ "error": "campo requerido" }`                | 400 Bad Request  |
| Falta el campo `location`              | `{ "error": "campo requerido" }`                | 400 Bad Request  |
| `number` es cero o negativo            | `{ "error": "debe ser mayor a cero" }`          | 400 Bad Request  |
| `number` pertenece a un casillero existente | `{ "error": "número de casillero ya registrado" }` | 409 Conflict     |
| Fallo inesperado en la base de datos   | `{ "error": "Error interno" }`                  | 500 Server Error |

## Plan de Implementación

1. Agregar tipos `CreateLockerRequest` y `LockerDTO` en `@alentapp/shared`.
2. Definir la entidad `Locker` en la capa de dominio con sus restricciones.
3. Definir el puerto `LockerRepository` con al menos `findByNumber` y `create`.
4. Implementar `CreateLockerUseCase` en la capa de aplicación.
5. Implementar `PostgresLockerRepository` con Prisma, manejando el error `P2002`.
6. Implementar `LockerController` y registrar la ruta en Fastify.
7. Escribir tests unitarios para el caso de uso (repositorio mockeado).
8. Escribir tests de integración para el endpoint.