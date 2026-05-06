---
id: 0017
estado: Propuesto
autor: Agostina Pascucci
fecha: 2026-05-02
titulo: Listado de Préstamos de Equipamiento
---

# TDD-0017: Listado de Préstamos de Equipamiento

## Contexto de Negocio (PRD)

### Objetivo

Proveer al administrativo una vista consolidada de todos los préstamos de equipamiento registrados en el sistema. Permite identificar rápidamente qué ítems están actualmente prestados (`Loaned`), cuáles fueron devueltos (`Returned`) y cuáles fueron dañados (`Damaged`), con soporte de filtrado por socio para gestionar reclamos individuales.

### User Persona

- **Nombre**: Administración del Club
- **Necesidad**: Al inicio de cada día o ante el reclamo de un socio, necesita consultar el estado de los préstamos. Quiere ver todos los préstamos ordenados por fecha descendente (el más reciente primero), y también poder filtrar solo los préstamos de un socio en particular para verificar su historial.

### Criterios de Aceptación

- El sistema debe retornar todos los préstamos activos (`deleted_at IS NULL`), ordenados por `loan_date` descendente.
- El sistema debe soportar filtrado **opcional** por `memberId` mediante un query parameter en la URL.
- Si no existen préstamos (o ninguno coincide con el filtro), el sistema debe retornar un array vacío, no un error.
- El sistema debe soportar la consulta de un préstamo **individual** por su `id`.
- Si se solicita un préstamo por `id` y no existe (o fue eliminado lógicamente), el sistema debe retornar `404 Not Found`.
- Cada elemento de la lista debe incluir todos los campos del `EquipmentLoanDTO` definido en TDD-0016.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia en este TDD. Se reutilizan íntegramente el modelo `EquipmentLoan`, el enum `LoanStatus` y la relación con `Member` definidos en TDD-0016.

La consulta de listado (`findAll`) aplica los siguientes criterios de base de datos:
- **Orden**: `loan_date DESC` (préstamos más recientes primero).
- **Filtro de eliminación lógica**: Solo se retornan registros donde `deleted_at IS NULL` (registros activos).
- **Filtro opcional**: Si se provee `memberId`, se filtra por `member_id = :memberId`.

La consulta por ID (`findById`) también aplica el filtro `deleted_at IS NULL`, de modo que un registro eliminado lógicamente devuelve `null` y se traduce en `404 Not Found`.

### Contrato de API (`@alentapp/shared`)

Se reutilizan los tipos `EquipmentLoanDTO` y `LoanStatus` definidos en TDD-0016. No se añaden tipos nuevos al paquete compartido.

**Endpoint 1 — Listado general (con filtro opcional):**

- **Método y Ruta**: `GET /api/v1/loans`
- **Query Parameters**:
  - `memberId` *(string, UUID, opcional)*: Filtra los préstamos del socio especificado.
- **Response exitosa** (`200 OK`):

```ts
{
  data: EquipmentLoanDTO[]   // Array vacío [] si no hay resultados
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/loans/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del préstamo.
- **Response exitosa** (`200 OK`):

```ts
{
  data: EquipmentLoanDTO
}
```

### Componentes de Arquitectura Hexagonal

Se amplían los componentes creados en TDD-0016 sin crear nuevos archivos de dominio.

- **Domain**: Los métodos `findAll(filters?)` y `findById(id)` ya están declarados en el puerto `EquipmentLoanRepository` definido en TDD-0016. No se agregan reglas de negocio nuevas: un `memberId` inválido produce lista vacía (comportamiento correcto).

- **Application**: `GetEquipmentLoansUseCase` recibe los filtros opcionales y delega directamente a `findAll`; no aplica validaciones adicionales. `GetEquipmentLoanByIdUseCase` invoca `findById` y lanza error de dominio "El préstamo no existe" si el resultado es `null`.

- **Infrastructure**: En `PostgresEquipmentLoanRepository`, `findAll` aplica siempre `WHERE deleted_at IS NULL`, el filtro `AND member_id = :memberId` condicional y `ORDER BY loan_date DESC`. `findById` aplica `WHERE id = :id AND deleted_at IS NULL` y retorna `null` si no hay resultado activo.

- **Delivery**: `EquipmentLoanController` expone `GET /api/v1/loans` (extrae query param `memberId`) y `GET /api/v1/loans/:id` (extrae path param `id`, mapea `null` a `404`). Ambas rutas se registran en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                               | Resultado Esperado                              | Código HTTP               |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------- |
| No existen préstamos activos                            | Retorna `{ data: [] }` (array vacío)            | 200 OK                    |
| `memberId` en query param sin préstamos coincidentes    | Retorna `{ data: [] }` (array vacío, sin error) | 200 OK                    |
| `memberId` en query param con formato no UUID           | Error: formato de memberId inválido             | 400 Bad Request           |
| `id` de préstamo inexistente o eliminado lógicamente    | Error: el préstamo no existe                    | 404 Not Found             |
| `id` en path param con formato no UUID                  | Error: formato de id de préstamo inválido       | 400 Bad Request           |
| Listado con préstamos activos                           | Array de `EquipmentLoanDTO[]` por fecha desc    | 200 OK                    |
| Fallo inesperado en la base de datos                    | Error interno                                   | 500 Server Error          |

## Plan de Implementación

1. Verificar que `EquipmentLoanDTO` y `LoanStatus` ya estén definidos en `@alentapp/shared` (pre-requisito: TDD-0016 completado).
2. Confirmar que el puerto `EquipmentLoanRepository` en `src/domain/` ya incluya `findAll(filters?)` y `findById(id)`.
3. Implementar los métodos `findAll` y `findById` en `PostgresEquipmentLoanRepository` con el filtro `deleted_at IS NULL`, el orden y el filtrado opcionales correctos.
4. Implementar `GetEquipmentLoansUseCase` en `src/application/`.
5. Implementar `GetEquipmentLoanByIdUseCase` en `src/application/`.
6. Agregar los métodos `getAll` y `getById` al `EquipmentLoanController` con el manejo de errores correspondiente.
7. Registrar las rutas `GET /api/v1/loans` y `GET /api/v1/loans/:id` en `src/app.ts`.
8. Agregar los métodos `getAll` y `getById` al servicio frontend `loans.ts`.
9. Implementar en la vista `EquipmentLoans.tsx` la tabla de listado con el campo de filtro por socio y la llamada al servicio.
10. Escribir tests unitarios: listado vacío, listado con resultados, filtro por memberId, préstamo por id existente, préstamo por id inexistente o eliminado.
11. Escribir tests de integración para `GET /api/v1/loans` y `GET /api/v1/loans/:id`.
