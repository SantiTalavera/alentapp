---
id: 0023
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-05
titulo: Listado y consulta de Deportes
---

# TDD-0023: Listado y consulta de Deportes

## Contexto de Negocio (PRD)

### Objetivo

Permitir que el administrativo consulte el catálogo de deportes activos del club y pueda acceder al detalle de un deporte específico. El listado debe excluir deportes dados de baja lógicamente para evitar que se muestren actividades que ya no forman parte de la oferta vigente.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Ver rápidamente qué deportes están disponibles, su cupo máximo, precio adicional y si requieren certificado médico. Necesita que los deportes eliminados lógicamente no aparezcan en el catálogo activo.

### Criterios de Aceptación

- El sistema debe retornar todos los deportes activos (`deleted_at` en `null`).
- El sistema debe excluir por defecto los deportes eliminados lógicamente.
- Si no existen deportes activos, debe retornar un array vacío.
- El sistema debe permitir consultar un deporte activo por su `id`.
- Si el deporte consultado no existe o fue eliminado lógicamente, debe retornar `404 Not Found`.
- Cada elemento de la respuesta debe usar el contrato `SportDTO`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia en este TDD. Se reutiliza la entidad `Sport` definida en el TDD-0007 de alta.

La consulta de listado (`findAll`) aplica el siguiente criterio:

- Solo se retornan deportes donde `deleted_at IS NULL`.

La consulta por ID (`findById`) también aplica el filtro `deleted_at IS NULL`, de modo que un deporte eliminado lógicamente se considera no disponible para consulta operativa.

### Contrato de API (`@alentapp/shared`)

Se reutiliza `SportDTO`, definido en el TDD-0007 de alta de deporte. No se añaden tipos nuevos al paquete compartido.

**Endpoint 1 — Listado general:**

- **Método y Ruta**: `GET /api/v1/sports`
- **Response exitosa** (`200 OK`):

```ts
{
  data: SportDTO[]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/sports/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del deporte.
- **Response exitosa** (`200 OK`):

```ts
{
  data: SportDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `SportRepository` expone los métodos `findAll()` y `findById(id)`. No se agregan reglas de negocio nuevas, pero ambas consultas deben respetar que los deportes con `deleted_at` informado no forman parte del catálogo activo.

- **Application**: `GetSportsUseCase` obtiene el listado de deportes activos. `GetSportByIdUseCase` obtiene un deporte por `id` y lanza un error de dominio si no existe o si fue eliminado lógicamente.

- **Infrastructure**: `PostgresSportRepository` implementa `findAll` y `findById` usando Prisma. `findAll` aplica `WHERE deleted_at IS NULL`; `findById` aplica `WHERE id = :id AND deleted_at IS NULL`.

- **Delivery**: `SportController` expone `GET /api/v1/sports` y `GET /api/v1/sports/:id`, extrae parámetros cuando corresponde, invoca los casos de uso y mapea errores a códigos HTTP.

---

## Casos de Borde y Errores

| Escenario                                 | Resultado Esperado                            | Código HTTP               |
| ----------------------------------------- | --------------------------------------------- | ------------------------- |
| No existen deportes activos               | Retorna `{ data: [] }`                        | 200 OK                    |
| Existen deportes eliminados lógicamente   | No se incluyen en el listado activo           | 200 OK                    |
| Listado con deportes activos              | Retorna `{ data: SportDTO[] }`                | 200 OK                    |
| ID no corresponde a ningún deporte activo | Mensaje: "Deporte no encontrado"              | 404 Not Found             |
| ID con formato inválido                   | Mensaje: "Identificador de deporte inválido"  | 400 Bad Request           |
| Error de conexión a DB                    | Mensaje: "Error interno, reintente más tarde" | 500 Internal Server Error |

## Plan de Implementación

1. Verificar que `SportDTO` ya esté definido en `@alentapp/shared`.
2. Confirmar que el puerto `SportRepository` incluya los métodos `findAll()` y `findById(id)`.
3. Implementar `findAll` en `PostgresSportRepository`, filtrando deportes con `deleted_at IS NULL`.
4. Implementar `findById` en `PostgresSportRepository`, filtrando por `id` y `deleted_at IS NULL`.
5. Implementar `GetSportsUseCase` en `src/application/`.
6. Implementar `GetSportByIdUseCase` en `src/application/`.
7. Agregar los métodos `getAll` y `getById` al `SportController`.
8. Registrar las rutas `GET /api/v1/sports` y `GET /api/v1/sports/:id` en `src/app.ts`.
9. Agregar los métodos `getAll` y `getById` al servicio frontend de deportes.
10. Crear o actualizar la vista de deportes para mostrar el catálogo activo.
11. Escribir tests unitarios: listado vacío, listado con resultados, deporte por ID existente y deporte inexistente o eliminado.
12. Escribir tests de integración para `GET /api/v1/sports` y `GET /api/v1/sports/:id`.