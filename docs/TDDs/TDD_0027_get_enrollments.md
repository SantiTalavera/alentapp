---
id: 0027
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-06
titulo: Listado y consulta de Inscripciones
---

# TDD-0027: Listado y consulta de Inscripciones

## Contexto de Negocio (PRD)

### Objetivo

Permitir que el administrativo consulte las inscripciones registradas en el sistema y pueda acceder al detalle de una inscripción específica. El listado debe excluir inscripciones eliminadas lógicamente, pero debe conservar la posibilidad de visualizar inscripciones vigentes e históricas.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Consultar rápidamente qué socios están o estuvieron inscriptos a determinados deportes, pudiendo filtrar por socio, deporte o vigencia de la inscripción.

### Criterios de Aceptación

- El sistema debe retornar todas las inscripciones no eliminadas lógicamente (`deleted_at` en `null`), excluyendo por defecto las que tengan `deleted_at` informado.
- El listado debe incluir tanto inscripciones vigentes (`is_active = true`) como históricas/no vigentes (`is_active = false`).
- Si no existen inscripciones que coincidan con la consulta, debe retornar un array vacío.
- El sistema debe permitir filtrar opcionalmente por `memberId`, `sportId` e `isActive`.
- El sistema debe permitir consultar una inscripción por su `id`.
- Si la inscripción consultada no existe o fue eliminada lógicamente, debe retornar `404 Not Found`.
- Cada elemento de la respuesta debe usar el contrato `EnrollmentDTO`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia en este TDD. Se reutiliza la entidad `Enrollment` definida en el TDD-0024 de alta de inscripción.

La consulta de listado (`findAll`) aplica el siguiente criterio obligatorio:

- Solo se retornan inscripciones donde `deleted_at IS NULL`.

Además, puede aplicar filtros opcionales:

- `memberId`: filtra por `member_id`.
- `sportId`: filtra por `sport_id`.
- `isActive` *(boolean, opcional)*: Filtra por vigencia de la inscripción. Valores aceptados en query string: `"true"` o `"false"`.

La consulta por ID (`findById`) también aplica el filtro `deleted_at IS NULL`, de modo que una inscripción eliminada lógicamente se considera no disponible para consulta operativa.

### Regla de negocio sobre filtros

`Enrollment` representa la relación entre socios y deportes, por lo que el listado debe permitir consultas operativas frecuentes:

- inscripciones de un socio específico;
- inscriptos a un deporte específico;
- inscripciones vigentes o históricas.

Por ese motivo, se incorporan filtros opcionales por `memberId`, `sportId` e `isActive`. Estos filtros no alteran la regla base: por defecto siempre se excluyen las inscripciones eliminadas lógicamente (`deleted_at IS NULL`).

### Contrato de API (`@alentapp/shared`)

Se reutiliza `EnrollmentDTO`, definido en el TDD-0024 de alta de inscripción. No se añaden tipos nuevos al paquete compartido.

**Endpoint 1 — Listado general con filtros opcionales:**

- **Método y Ruta**: `GET /api/v1/enrollments`
- **Query Parameters**:
  - `memberId` *(string, UUID, opcional)*: Filtra las inscripciones del socio especificado.
  - `sportId` *(string, UUID, opcional)*: Filtra las inscripciones del deporte especificado.
  - `isActive` *(boolean, opcional)*: Filtra por vigencia de la inscripción.

- **Response exitosa** (`200 OK`):

```ts
{
  data: EnrollmentDTO[]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/enrollments/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único de la inscripción.
- **Response exitosa** (`200 OK`):

```ts
{
  data: EnrollmentDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `EnrollmentRepository` expone los métodos `findAll(filters?)` y `findById(id)`. No se agregan reglas de negocio nuevas, pero ambas consultas deben respetar que las inscripciones con `deleted_at` informado no forman parte de las consultas operativas.

- **Application**: `GetEnrollmentsUseCase` obtiene el listado de inscripciones no eliminadas, aplicando filtros opcionales. `GetEnrollmentByIdUseCase` obtiene una inscripción por `id` y lanza un error de dominio si no existe o si fue eliminada lógicamente.

- **Infrastructure**: `PostgresEnrollmentRepository` implementa `findAll` y `findById` usando Prisma. `findAll` aplica siempre `WHERE deleted_at IS NULL` y agrega filtros condicionales por `member_id`, `sport_id` e `is_active`. `findById` aplica `WHERE id = :id AND deleted_at IS NULL`.

- **Delivery**: `EnrollmentController` expone `GET /api/v1/enrollments` y `GET /api/v1/enrollments/:id`, extrae parámetros de ruta y query params cuando corresponde, invoca los casos de uso y mapea errores a códigos HTTP.

---

## Casos de Borde y Errores

| Escenario                                                   | Resultado Esperado                               | Código HTTP               |
| ----------------------------------------------------------- | ------------------------------------------------ | ------------------------- |
| No existen inscripciones no eliminadas                      | Retorna `{ data: [] }`                           | 200 OK                    |
| Existen inscripciones eliminadas lógicamente                | No se incluyen en el listado operativo           | 200 OK                    |
| Listado con inscripciones vigentes e históricas             | Retorna `{ data: EnrollmentDTO[] }`              | 200 OK                    |
| Filtro `memberId` sin coincidencias                         | Retorna `{ data: [] }`                           | 200 OK                    |
| Filtro `sportId` sin coincidencias                          | Retorna `{ data: [] }`                           | 200 OK                    |
| Filtro `isActive` sin coincidencias                         | Retorna `{ data: [] }`                           | 200 OK                    |
| `memberId` con formato inválido                             | Mensaje: "Identificador de socio inválido"       | 400 Bad Request           |
| `sportId` con formato inválido                              | Mensaje: "Identificador de deporte inválido"     | 400 Bad Request           |
| `isActive` con formato inválido                             | Mensaje: "Filtro de vigencia inválido"           | 400 Bad Request           |
| ID no corresponde a ninguna inscripción activa/no eliminada | Mensaje: "Inscripción no encontrada"             | 404 Not Found             |
| ID con formato inválido                                     | Mensaje: "Identificador de inscripción inválido" | 400 Bad Request           |
| Error de conexión a DB                                      | Mensaje: "Error interno, reintente más tarde"    | 500 Internal Server Error |

## Plan de Implementación

1. Verificar que `EnrollmentDTO` ya esté definido en `@alentapp/shared`.
2. Confirmar que el puerto `EnrollmentRepository` incluya los métodos `findAll(filters?)` y `findById(id)`.
3. Implementar `findAll` en `PostgresEnrollmentRepository`, filtrando inscripciones con `deleted_at IS NULL`.
4. Agregar filtros opcionales en `findAll` para `member_id`, `sport_id` e `is_active`.
5. Implementar `findById` en `PostgresEnrollmentRepository`, filtrando por `id` y `deleted_at IS NULL`.
6. Implementar `GetEnrollmentsUseCase` en `src/application/`.
7. Implementar `GetEnrollmentByIdUseCase` en `src/application/`.
8. Agregar los métodos `getAll` y `getById` al `EnrollmentController`.
9. Registrar las rutas `GET /api/v1/enrollments` y `GET /api/v1/enrollments/:id` en `src/app.ts`.
10. Agregar los métodos `getAll` y `getById` al servicio frontend de inscripciones.
11. Crear o actualizar la vista de inscripciones para mostrar el listado y filtros.
12. Escribir tests unitarios: listado vacío, listado con resultados, filtros por socio/deporte/vigencia, inscripción por ID existente e inscripción inexistente o eliminada.
13. Escribir tests de integración para `GET /api/v1/enrollments` y `GET /api/v1/enrollments/:id`.