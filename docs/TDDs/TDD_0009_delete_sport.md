---
id: 0009
autor: Nicolás Pérez
fecha: 2026-05-02
titulo: Baja de Deporte Existente
---

# TDD-0009: Baja de Deporte Existente

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo dé de baja un deporte del sistema cuando este deja de ofrecerse en el club, manteniendo actualizado el catálogo de actividades disponibles y evitando que los socios puedan inscribirse a deportes que ya no forman parte de la oferta.

Como `Sport` se encuentra relacionado con `Enrollment`, la baja debe contemplar la integridad referencial. En esta implementación se adopta y se toma como decisión una eliminación física del deporte y de las inscripciones asociadas, para evitar que queden registros de inscripción apuntando a un deporte inexistente.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Eliminar deportes que ya no se ofrecen, de forma segura y con confirmación previa. Necesita que el catálogo quede actualizado y que no queden inscripciones asociadas a un deporte eliminado.

### Criterios de Aceptación

- El sistema debe pedir una confirmación explícita antes de proceder con la baja.
- El sistema debe validar que el deporte exista antes de intentar eliminarlo.
- Si el deporte tiene inscripciones asociadas, el sistema debe eliminar también dichas inscripciones.
- El sistema debe realizar la eliminación dentro de una operación transaccional para preservar la integridad de los datos.
- Si la eliminación es exitosa, el sistema debe retornar una respuesta vacía con estado `204 No Content`.
- Al finalizar correctamente, el deporte eliminado no debe aparecer en el catálogo ni estar disponible para nuevas inscripciones.

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre las entidades `Sport` y `Enrollment`, de acuerdo con el DER provisto en la consigna.

Entidad principal: `Sport`.

| Campo                          | Tipo    | Descripción                                       |
| ------------------------------ | ------- | ------------------------------------------------- |
| `id`                           | UUID    | Identificador del deporte a eliminar.             |
| `name`                         | String  | Nombre del deporte.                               |
| `description`                  | String  | Descripción del deporte.                          |
| `max_capacity`                 | Int     | Cupo máximo del deporte.                          |
| `additional_price`             | Float   | Precio adicional del deporte.                     |
| `requires_medical_certificate` | Boolean | Indica si el deporte requiere certificado médico. |

Entidad relacionada: `Enrollment`.

| Campo             | Tipo     | Descripción                                   |
| ----------------- | -------- | --------------------------------------------- |
| `id`              | UUID     | Identificador de la inscripción.              |
| `member_id`       | UUID     | Socio inscripto.                              |
| `sport_id`        | UUID     | Deporte asociado a la inscripción.            |
| `enrollment_date` | DateTime | Fecha de inscripción.                         |
| `is_active`       | Boolean  | Indica si la inscripción se encuentra activa. |

La entidad `Enrollment` referencia a `Sport` mediante `sport_id`. Por este motivo, antes de eliminar un deporte se deben eliminar sus inscripciones asociadas o realizar ambas operaciones dentro de una misma transacción.

> **Nota de diseño**: se adopta eliminación física con borrado de inscripciones asociadas. Esta decisión evita referencias huérfanas y mantiene el modelo alineado con el DER actual, sin agregar un campo de baja lógica en `Sport`.

### Contrato de API (@alentapp/shared)

Al tratarse de una operación destructiva que solo requiere conocer el identificador del deporte, no se envía cuerpo en la petición HTTP.

- Endpoint: `DELETE /api/v1/sports/:id`
- Request Body: `None`
- Response: `204 No Content` en caso de éxito.

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `SportRepository` (Interfaz en el Dominio con métodos `findById(id)` y `delete(id)`). Permite verificar la existencia del deporte y delegar la eliminación sin depender directamente de Prisma.
2. **Puerto relacionado**: `EnrollmentRepository` (Interfaz en el Dominio con método `deleteBySportId(sportId)`). Permite eliminar las inscripciones asociadas al deporte antes de eliminar el registro principal.
3. **Caso de Uso**: `DeleteSportUseCase` (Orquesta la operación). Recibe el `id`, verifica que el deporte exista, elimina las inscripciones asociadas y luego elimina el deporte dentro de una transacción.
4. **Adaptador de Salida**: `PostgresSportRepository` y `PostgresEnrollmentRepository` (Implementaciones reales en BD usando Prisma). Ejecutan las operaciones de eliminación sobre las tablas correspondientes.
5. **Adaptador de Entrada**: `SportController` (Ruta HTTP `DELETE /api/v1/deportes/:id`). Extrae el `id` de la URL, invoca el caso de uso y devuelve `204 No Content` si la operación finaliza correctamente.

## Casos de Borde y Errores

| Escenario                                 | Resultado Esperado                                 | Código HTTP               |
| ----------------------------------------- | -------------------------------------------------  | ------------------------- |
| ID no corresponde a ningún deporte        | Mensaje: "Deporte no encontrado"                   | 404 Not Found             |
| ID con formato inválido                   | Mensaje: "Identificador de deporte inválido"       | 400 Bad Request           |
| Deporte sin inscripciones asociadas       | Se elimina únicamente el deporte                   | 204 No Content            |
| Deporte con inscripciones asociadas       | Se eliminan las inscripciones y luego el deporte   | 204 No Content            |
| Error al eliminar inscripciones asociadas | Se cancela la operación y no se elimina el deporte | 500 Internal Server Error |
| Error de conexión a DB                    | Mensaje: "Error interno, reintente más tarde"      | 500 Internal Server Error |

## Plan de Implementación

1. Agregar al puerto `SportRepository` los métodos `findById(id)` y `delete(id)`.
2. Agregar al puerto `EnrollmentRepository` el método `deleteBySportId(sportId)`.
3. Implementar `DeleteSportUseCase`, validando existencia del deporte antes de eliminar.
4. Ejecutar la eliminación de inscripciones asociadas y del deporte dentro de una transacción.
5. Implementar los métodos correspondientes en `PostgresSportRepository` y `PostgresEnrollmentRepository` usando Prisma.
6. Implementar el endpoint `DELETE /api/v1/deportes/:id` en `SportController` y registrarlo en Fastify.
7. Añadir el método `delete` al servicio de frontend.
8. Enlazar el botón de eliminación en la vista de deportes, agregando una confirmación visual antes de ejecutar la operación.
9. Escribir tests unitarios para el caso de uso: deporte inexistente, deporte sin inscripciones, deporte con inscripciones y error transaccional.
10. Escribir tests de integración para el endpoint.