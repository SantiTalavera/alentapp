---
id: 0022
autor: Santiago Talavera
fecha: 2026-05-03
titulo: Eliminación de Disciplina
---

# TDD-0022: Eliminación de Disciplina

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos eliminar una medida disciplinaria cuando fue cargada por error o no corresponde al socio indicado. La operación es destructiva, por lo que requiere confirmación explícita antes de ejecutarse.

### User Persona

- **Nombre**: Administrativo del Club.
- **Necesidad**: Borrar una disciplina incorrecta sin afectar otros registros del socio, teniendo una advertencia previa que reduzca el riesgo de eliminar información válida por accidente.

### Criterios de Aceptación

- El sistema debe pedir una confirmación explícita antes de proceder con el borrado.
- El sistema debe validar que la disciplina exista antes de intentar eliminarla.
- El sistema debe realizar un borrado físico del registro en la base de datos.
- Si la disciplina eliminada era una suspensión total activa, el sistema debe restaurar el estado anterior del socio solo cuando no exista otra disciplina total activa para ese socio.
- Si el borrado es exitoso, la vista del socio debe actualizarse automáticamente.
- La respuesta debe ser vacía con estado `204 No Content`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se agregan campos nuevos al modelo. Se opera sobre la entidad `Discipline` ya existente.

Entidad involucrada: `Discipline`.

| Campo | Tipo | Descripción                         |
| ----- | ---- | ----------------------------------- |
| `id`  | UUID | Identifica la disciplina a eliminar |
| `is_total_suspension` | Boolean | Permite saber si la eliminación puede impactar el estado del socio |
| `previous_member_status` | String \| null | Estado que debe restaurarse si no quedan otras suspensiones totales activas |
| `member_id` | UUID | Socio asociado a la disciplina |

> **Nota de diseño**: se adopta eliminación física porque el DER no define un campo de baja lógica para `Discipline`. Si en el futuro se requiere auditoría completa de sanciones eliminadas, debería evaluarse agregar un mecanismo de soft delete.

### Contrato de API (`@alentapp/shared`)

Al tratarse de una operación destructiva que solo requiere el identificador, no se envía cuerpo en la petición HTTP.

- **Endpoint**: `DELETE /api/v1/disciplines/:id`
- **Request Body**: `None`
- **Response**: `204 No Content` en caso de éxito.

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `DisciplineRepository` incluye `findById` para verificar que la disciplina exista antes de ejecutar una operación destructiva, `delete` para representar el borrado físico definido por este TDD y una consulta de disciplinas totales activas del socio para decidir si corresponde restaurar su estado. No se agrega lógica de baja porque el DER no contempla un campo de eliminación lógica para `Discipline`.

- **Application**: `DeleteDisciplineUseCase` orquesta la baja: recupera la disciplina por `id`, lanza el error de dominio correspondiente si no existe y, si existe, delega la eliminación al repositorio. Si la disciplina eliminada era total y estaba activa, consulta si queda otra disciplina total activa para el mismo socio; si no queda ninguna, restaura `Member.status` usando `previous_member_status`.

- **Infrastructure**: `PostgresDisciplineRepository` implementa la eliminación física usando Prisma filtrado por `id`, respetando la decisión de no mantener un marcador de baja lógica para esta entidad. Cuando la eliminación impacta el estado del socio, el borrado y la restauración de `Member.status` se ejecutan en una transacción.

- **Delivery**: `DisciplineController` expone `DELETE /api/v1/disciplines/:id`, extrae el `id` de la URL, delega al caso de uso y devuelve `204 No Content` ante el borrado exitoso. En la vista, si la disciplina es una suspensión total activa, se debe advertir al usuario que la eliminación puede restaurar el estado del socio.

---

## Casos de Borde y Errores

| Escenario               | Resultado Esperado                              | Código HTTP               |
| ----------------------- | ----------------------------------------------- | ------------------------- |
| Disciplina inexistente  | Mensaje: "La disciplina no existe"              | 404 Not Found             |
| ID con formato inválido | Mensaje: "Identificador de disciplina inválido" | 400 Bad Request           |
| Eliminación de disciplina total activa sin otras suspensiones totales activas | Restaura el estado anterior del socio (`Activo` o `Moroso`) | 204 No Content |
| Eliminación de disciplina total activa con otra suspensión total activa vigente | El socio permanece `Suspendido` | 204 No Content |
| Eliminación de disciplina no total o vencida | No modifica el estado del socio | 204 No Content |
| Error de conexión a DB  | Mensaje: "Error interno, reintente más tarde"   | 500 Internal Server Error |
| Eliminación exitosa     | Respuesta vacía                                 | 204 No Content            |

---

## Plan de Implementación

1. Ampliar la interfaz `DisciplineRepository` con el método `delete` y la consulta de disciplinas totales activas por socio.
2. Implementar `DeleteDisciplineUseCase`: verificar existencia vía `findById`, determinar si la disciplina total está activa, restaurar el estado anterior del socio si no quedan otras suspensiones totales activas y delegar la eliminación.
3. Implementar el método `delete` en `PostgresDisciplineRepository` usando Prisma y transacción cuando corresponda restaurar `Member.status`.
4. Implementar el endpoint `DELETE /api/v1/disciplines/:id` en el controlador y registrarlo en `app.ts`.
5. Añadir el método `delete` al servicio de Frontend.
6. Enlazar el botón de eliminación en la vista del socio, agregando una confirmación visual `window.confirm` antes de ejecutar y una advertencia adicional cuando la disciplina pueda restaurar el estado del socio.
7. Escribir tests unitarios para el caso de uso: disciplina inexistente, eliminación exitosa, restauración del estado anterior, permanencia en `Suspendido` cuando quede otra disciplina total activa y manejo de errores.
8. Escribir tests de integración para el endpoint.
