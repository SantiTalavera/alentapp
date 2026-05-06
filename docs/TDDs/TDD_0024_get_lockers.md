---
id: 0024
estado: Propuesto
autor: Joaquin Montes
fecha: 2026-05-06
titulo: Listado y Consulta de Casilleros
---

# TDD-0024: Listado y Consulta de Casilleros

## Contexto de Negocio (PRD)

### Objetivo

Proveer al administrativo una herramienta para visualizar el inventario de casilleros del club. Permite conocer rápidamente cuántos casilleros hay disponibles (`Available`), cuáles están ocupados (`Occupied`) y cuáles fuera de servicio por mantenimiento (`Maintenance`), con soporte de filtrado por estado para facilitar la asignación a nuevos socios.

### User Persona

- **Nombre**: Administración del Club
- **Necesidad**: Consultar la disponibilidad de casilleros en tiempo real para informar a un socio que desea alquilar uno, o listar los casilleros en mantenimiento para coordinar reparaciones.

### Criterios de Aceptación

- El sistema debe retornar todos los casilleros activos (`is_active: true`).
- El sistema debe soportar filtrado **opcional** por `status` mediante un query parameter en la URL.
- Si no existen casilleros (o ninguno coincide con el filtro), el sistema debe retornar un array vacío en la propiedad `data`, no un error.
- El sistema debe soportar la consulta de un casillero **individual** por su `id`.
- Si se solicita un casillero por `id` y no existe o está inactivo, el sistema debe retornar `404 Not Found`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se reutiliza el modelo `Locker` definido en TDD-0004. Las consultas aplican los siguientes criterios:
- **Filtro de actividad**: Solo se retornan registros donde `is_active: true`.
- **Filtro opcional**: Si se provee `status` (`Available`, `Occupied`, `Maintenance`), se filtra por ese valor exacto.
- **Orden**: Por defecto, los resultados se ordenan numéricamente por el campo `number` de forma ascendente.

### Contrato de API (`@alentapp/shared`)

**Endpoint 1 — Listado general (con filtro opcional):**

- **Método y Ruta**: `GET /api/v1/lockers`
- **Query Parameters**:
  - `status` *(string, opcional)*: Filtra por estado operativo.
- **Response exitosa** (`200 OK`):
```ts
{
  "data": [
    {
      "id": string,
      "number": number,
      "location": string,
      "status": "Available" | "Occupied" | "Maintenance",
      "is_active": boolean
    }
  ]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/lockers/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del casillero.
- **Response exitosa** (`200 OK`):
```ts
{
  "data": {
    "id": string,
    "number": number,
    "location": string,
    "status": "Available" | "Occupied" | "Maintenance",
    "is_active": boolean
  }
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `LockerRepository` debe incluir los métodos `findAll(filters?)` y `findById(id)`.
- **Application**: 
    - `GetLockersUseCase`: Orquesta la búsqueda filtrada y el ordenamiento.
    - `GetLockerByIdUseCase`: Busca un casillero específico y valida su existencia/actividad.
- **Infrastructure**: `PostgresLockerRepository` implementa las consultas Prisma aplicando `where: { is_active: true }` y el filtro opcional de `status`.
- **Delivery**: `LockerController` expone los métodos `getAll` y `getById`, inyectando los casos de uso correspondientes.

---

## Casos de Borde y Errores

| Escenario | Resultado Esperado (JSON) | Código HTTP |
| :--- | :--- | :--- |
| No existen casilleros registrados | `{ "data": [] }` | 200 OK |
| Filtro de `status` sin resultados | `{ "data": [] }` | 200 OK |
| `status` inválido en query param | `{ "error": "Estado de casillero no válido" }` | 400 Bad Request |
| `id` inexistente o inactivo | `{ "error": "casillero no encontrado" }` | 404 Not Found |
| `id` con formato no UUID | `{ "error": "formato de id inválido" }` | 400 Bad Request |
| Error de conexión a DB | `{ "error": "Error interno" }` | 500 Server Error |

## Plan de Implementación

1. Asegurar que los métodos `findAll` y `findById` estén en el puerto `LockerRepository`.
2. Implementar `GetLockersUseCase` y `GetLockerByIdUseCase`.
3. Implementar la lógica de base de datos en `PostgresLockerRepository`.
4. Agregar los endpoints al `LockerController` y registrarlos en Fastify.
5. Crear la vista de "Gestión de Casilleros" en el frontend para mostrar la lista.
6. Escribir tests de integración para ambos endpoints.
