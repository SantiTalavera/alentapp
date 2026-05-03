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

> **Nota de diseño**: se adopta eliminación física porque el DER no define un campo de baja lógica para `Discipline`. Si en el futuro se requiere auditoría completa de sanciones eliminadas, debería evaluarse agregar un mecanismo de soft delete.

### Contrato de API (`@alentapp/shared`)

Al tratarse de una operación destructiva que solo requiere el identificador, no se envía cuerpo en la petición HTTP.

- **Endpoint**: `DELETE /api/v1/disciplines/:id`
- **Request Body**: `None`
- **Response**: `204 No Content` en caso de éxito.

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `DisciplineRepository` — Métodos requeridos:
    - `findById(id: string): Promise<Discipline | null>`
    - `delete(id: string): Promise<void>`
2. **Caso de Uso**: `DeleteDisciplineUseCase` — Verifica la existencia de la disciplina mediante `findById` y, si existe, delega la eliminación al repositorio.
3. **Adaptador de Salida**: `PostgresDisciplineRepository` — Eliminación física usando el método `delete` de Prisma filtrado por `id`.
4. **Adaptador de Entrada**: `DisciplineController` — Ruta HTTP que extrae el `id` de la URL, delega al caso de uso y devuelve `204 No Content` ante éxito.

---

## Casos de Borde y Errores

| Escenario               | Resultado Esperado                              | Código HTTP               |
| ----------------------- | ----------------------------------------------- | ------------------------- |
| Disciplina inexistente  | Mensaje: "La disciplina no existe"              | 404 Not Found             |
| ID con formato inválido | Mensaje: "Identificador de disciplina inválido" | 400 Bad Request           |
| Error de conexión a DB  | Mensaje: "Error interno, reintente más tarde"   | 500 Internal Server Error |
| Eliminación exitosa     | Respuesta vacía                                 | 204 No Content            |

---

## Plan de Implementación

1. Ampliar la interfaz `DisciplineRepository` con el método `delete`.
2. Implementar `DeleteDisciplineUseCase`: verificar existencia vía `findById` y delegar la eliminación.
3. Implementar el método `delete` en `PostgresDisciplineRepository` usando Prisma.
4. Implementar el endpoint `DELETE /api/v1/disciplines/:id` en el controlador y registrarlo en `app.ts`.
5. Añadir el método `delete` al servicio de Frontend.
6. Enlazar el botón de eliminación en la vista del socio, agregando una confirmación visual `window.confirm` antes de ejecutar.
7. Escribir tests unitarios para el caso de uso: disciplina inexistente, eliminación exitosa y manejo de errores.
8. Escribir tests de integración para el endpoint.
