---
id: 0030
estado: Propuesto
autor: Santiago Talavera
fecha: 2026-05-08
titulo: Listado y consulta de Disciplinas
---

# TDD-0030: Listado y consulta de Disciplinas

## Contexto de Negocio (PRD)

### Objetivo

Permitir que el administrativo consulte el historial disciplinario de un socio específico y pueda acceder al detalle de una disciplina en particular. La consulta debe mostrar tanto disciplinas vigentes como históricas, ya que ambas forman parte del registro del socio y ayudan a entender si una sanción total activa está bloqueando sus acciones dentro del club.

### User Persona

- **Nombre**: Administrativo del Club.
- **Necesidad**: Revisar rápidamente las sanciones de un socio, identificar si existe una suspensión total activa y consultar el detalle de una disciplina puntual cuando deba explicar o auditar una medida aplicada.

### Criterios de Aceptación

- El sistema debe permitir consultar todas las disciplinas asociadas a un socio a través de su `member_id`.
- El sistema debe permitir consultar una disciplina específica por su `id`.
- El listado por socio debe incluir disciplinas activas, futuras y vencidas, ya que todas forman parte del historial disciplinario.
- Si el socio existe pero no tiene disciplinas registradas, debe retornar `{ data: [] }`.
- Si el socio consultado no existe, debe retornar `404 Not Found`.
- Si la disciplina consultada por `id` no existe, debe retornar `404 Not Found`.
- Cada elemento de la respuesta debe usar el contrato `DisciplineDTO`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia en este TDD. Se reutiliza la entidad `Discipline` definida en TDD-0020, incluyendo el campo `previous_member_status` agregado para restaurar el estado previo del socio cuando dejan de existir suspensiones totales activas.

La consulta de listado por socio (`findByMemberId`) aplica los siguientes criterios:

- Filtra por `member_id = :memberId`.
- Retorna disciplinas activas, futuras y vencidas.
- Ordena por `start_date DESC` para mostrar primero las disciplinas más recientes.

La consulta por ID (`findById`) retorna una disciplina puntual por su identificador. Como `Discipline` utiliza eliminación física, una disciplina eliminada no existe para la consulta y debe resolverse como `404 Not Found`.

Una disciplina se considera activa cuando `start_date <= hoy && end_date >= hoy`. Este TDD solo consulta información; no modifica el estado del socio ni recalcula suspensiones.

### Contrato de API (`@alentapp/shared`)

Se reutiliza `DisciplineDTO`, definido en TDD-0020. No se añaden tipos nuevos al paquete compartido.

**Endpoint 1 — Listado de disciplinas por socio:**

- **Método y Ruta**: `GET /api/v1/members/:memberId/disciplines`
- **Path Parameters**:
  - `memberId` *(string, UUID, requerido)*: Identificador único del socio.
- **Response exitosa** (`200 OK`):

```ts
{
  data: DisciplineDTO[]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/disciplines/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único de la disciplina.
- **Response exitosa** (`200 OK`):

```ts
{
  data: DisciplineDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `DisciplineRepository` expone `findByMemberId` para obtener el historial disciplinario de un socio y reutiliza `findById` para consultar una disciplina puntual. El puerto relacionado `MemberRepository` se utiliza en el listado por socio para validar que el `member_id` exista y poder diferenciar un socio inexistente de un socio sin disciplinas registradas.

- **Application**: `GetDisciplinesByMemberUseCase` valida la existencia del socio y obtiene sus disciplinas ordenadas por fecha de inicio descendente. `GetDisciplineByIdUseCase` obtiene una disciplina por `id` y lanza un error de dominio si no existe.

- **Infrastructure**: `PostgresDisciplineRepository` implementa `findByMemberId` y `findById` usando Prisma, mapeando los registros a `DisciplineDTO`. `findByMemberId` filtra por `member_id` y aplica el orden definido; `findById` filtra por `id`.

- **Delivery**: `DisciplineController` expone `GET /api/v1/members/:memberId/disciplines` y `GET /api/v1/disciplines/:id`, extrae los parámetros de la URL, invoca los casos de uso y devuelve `200 OK` con `{ data: ... }`. La ruta se registra en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                      | Resultado Esperado                            | Código HTTP               |
| ---------------------------------------------- | --------------------------------------------- | ------------------------- |
| Socio existente sin disciplinas registradas    | Retorna `{ data: [] }`                        | 200 OK                    |
| Socio existente con disciplinas registradas    | Retorna `{ data: DisciplineDTO[] }` ordenado por `start_date DESC` | 200 OK |
| Socio inexistente                              | Mensaje: "El socio no existe"                | 404 Not Found             |
| `memberId` con formato inválido                | Mensaje: "Identificador de socio inválido"    | 400 Bad Request           |
| ID no corresponde a ninguna disciplina         | Mensaje: "Disciplina no encontrada"           | 404 Not Found             |
| ID con formato inválido                        | Mensaje: "Identificador de disciplina inválido" | 400 Bad Request         |
| Error de conexión a DB                         | Mensaje: "Error interno, reintente más tarde" | 500 Internal Server Error |

## Plan de Implementación

1. Verificar que `DisciplineDTO` ya esté definido en `@alentapp/shared`.
2. Confirmar que el puerto `DisciplineRepository` incluya `findById(id)` y ampliarlo con `findByMemberId(memberId)`.
3. Implementar `findByMemberId` y `findById` en `PostgresDisciplineRepository`.
4. Implementar `GetDisciplinesByMemberUseCase`, validando previamente la existencia del socio con `MemberRepository`.
5. Implementar `GetDisciplineByIdUseCase`.
6. Agregar los métodos al `DisciplineController`.
7. Registrar las rutas `GET /api/v1/members/:memberId/disciplines` y `GET /api/v1/disciplines/:id` en `app.ts`.
8. Agregar los métodos al servicio frontend de disciplinas.
9. Mostrar el historial disciplinario en la vista del socio, destacando visualmente las disciplinas totales activas.
10. Escribir tests unitarios: socio inexistente, socio sin disciplinas, listado con resultados, disciplina por ID existente y disciplina inexistente.
11. Escribir tests de integración para ambos endpoints.
