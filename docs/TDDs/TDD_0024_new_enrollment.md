---
id: 0024
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-05
titulo: Registro de Nueva Inscripción
---

# TDD-0024: Registro de Nueva Inscripción

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo registre la inscripción de un socio a un deporte, asegurando que se respeten las reglas de negocio como cupo máximo, estado del socio y disponibilidad del deporte.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Inscribir socios a deportes disponibles, garantizando que el deporte tenga cupo, que el socio esté habilitado y evitando duplicar inscripciones activas.

### Criterios de Aceptación

- El sistema debe permitir registrar una inscripción con `member_id` y `sport_id`.
- El sistema debe validar que `member_id` sea obligatorio.
- El sistema debe validar que `sport_id` sea obligatorio.
- El sistema debe validar que el socio exista.
- El sistema debe validar que el deporte exista.
- El sistema debe validar que el deporte no esté eliminado lógicamente (`deleted_at` en `null`).
- El sistema debe validar que el socio tenga estado de cuenta activo.
- El sistema debe validar que no exista otra inscripción activa para el mismo `member_id` y `sport_id`.
- El sistema debe validar que el cupo máximo del deporte no esté completo considerando solo inscripciones activas. 
- El sistema debe generar automáticamente `enrollment_date` con la fecha actual del servidor.
- El sistema debe inicializar `is_active` en `true`.
- El sistema debe inicializar `deleted_at` en `null`.
- Al finalizar correctamente, la API debe responder con estado `201 Created` y retornar la inscripción creada.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se utilizará la entidad `Enrollment` definida en el DER, con la siguiente estructura:

| Campo             | Tipo     | Nullable | Descripción                                   |
|------------------ |--------- | ---------|---------------------------------------------- |
| `id`              | UUID     | No       | Identificador único de la inscripción         |
| `member_id`       | UUID     | No       | Referencia al socio                           |
| `sport_id`        | UUID     | No       | Referencia al deporte                         |
| `enrollment_date` | DateTime | No       | Fecha de inscripción generada automáticamente |
| `is_active`       | Boolean  | No       | Indica si la inscripción está vigente         |
| `deleted_at`      | DateTime | Sí       | Marca de baja lógica del registro             |

### Reglas de negocio

- Solo cuentan para validaciones de cupo y duplicados las inscripciones con:
  - `is_active = true`
  - `deleted_at = null`
- Para validar el cupo disponible, el sistema debe contar las inscripciones activas y no eliminadas del deporte.
- Si la cantidad de inscripciones activas es mayor o igual a `Sport.max_capacity`, la nueva inscripción debe rechazarse.
- Un deporte eliminado lógicamente no puede recibir nuevas inscripciones.
- Un socio inactivo no puede inscribirse.

---

## Contrato de API (`@alentapp/shared`)

Se definen los siguientes tipos en el paquete compartido:

```ts
export interface EnrollmentDTO {
  id: string;                 // UUID
  member_id: string;          // UUID del socio inscripto
  sport_id: string;           // UUID del deporte asociado
  enrollment_date: string;    // ISO DateTime String. Fecha de inscripción
  is_active: boolean;         // true = inscripción vigente, false = inscripción histórica/no vigente
  deleted_at: string | null;  // ISO DateTime String. null = registro activo; con valor = eliminado lógicamente
}

export interface CreateEnrollmentRequest {
  member_id: string;          // Requerido. UUID del socio
  sport_id: string;           // Requerido. UUID del deporte
}
```

- **Endpoint**: `POST /api/v1/enrollments`

- **Request Body**:

```ts
{
  member_id: string;
  sport_id: string;
}
```

- **Response exitosa** (`201 Created`):

```ts
{
  data: EnrollmentDTO
}
```

---

## Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `EnrollmentRepository` define el contrato de persistencia para la entidad. El servicio `EnrollmentValidator` concentra las reglas de negocio: valida duplicados activos, cupo disponible, existencia y estado del socio, y disponibilidad del deporte. El puerto se define completo desde el inicio para que los casos de uso de alta, modificación, baja y consulta compartan la misma interfaz.

- **Application**: `CreateEnrollmentUseCase` orquesta el flujo sin conocer HTTP ni la base de datos: recibe `member_id` y `sport_id`, verifica que el socio exista y tenga estado de cuenta activo, verifica que el deporte exista y no esté eliminado lógicamente, valida que no exista una inscripción activa duplicada, valida que el cupo no esté completo y delega la persistencia al repositorio.

- **Infrastructure**: `PostgresEnrollmentRepository` implementa el puerto con Prisma. Para este caso de uso expone `create`, `findActiveByMemberAndSport` y `countActiveBySportId`. Además, el caso de uso se apoya en `MemberRepository` y `SportRepository` para consultar los datos necesarios de socio y deporte.

- **Delivery**: `EnrollmentController` expone `POST /api/v1/enrollments`, valida el body tipado como `CreateEnrollmentRequest`, delega al caso de uso y devuelve `201 Created` con `{ data: EnrollmentDTO }`. La ruta y las dependencias se registran en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                    | Resultado Esperado                                       | Código HTTP               |
|----------------------------- | -------------------------------------------------------- |-------------------------- |
| Socio no existe              | Mensaje: "Socio no encontrado"                           | 404 Not Found             |
| `member_id` ausente          | Mensaje: "El socio es obligatorio"                       | 400 Bad Request           |
| `sport_id` ausente           | Mensaje: "El deporte es obligatorio"                     | 400 Bad Request           |
| Deporte no existe            | Mensaje: "Deporte no encontrado"                         | 404 Not Found             |
| Deporte eliminado            | Mensaje: "No se puede inscribir en un deporte eliminado" | 409 Conflict              |
| Socio no activo              | Mensaje: "El socio no está habilitado para inscribirse"  | 409 Conflict              |
| Inscripción duplicada activa | Mensaje: "El socio ya está inscripto en este deporte"    | 409 Conflict              |
| Cupo completo                | Mensaje: "No hay cupo disponible para este deporte"      | 409 Conflict              |
| IDs inválidos                | Mensaje: "Identificador inválido"                        | 400 Bad Request           |
| Error de DB                  | Mensaje: "Error interno, reintente más tarde"            | 500 Internal Server Error |

---

## Plan de Implementación

1. Agregar `EnrollmentDTO` y `CreateEnrollmentRequest` al paquete `@alentapp/shared` (`packages/shared/index.ts`).
2. Modificar el esquema de persistencia (`schema.prisma`): agregar el modelo `Enrollment`, incluyendo `deleted_at` como campo nullable, y definir las relaciones con `Member` y `Sport`.
3. Ejecutar la migración de base de datos con el nombre `create_enrollments_table`.
4. Crear el puerto `EnrollmentRepository.ts` en `src/domain/` con los métodos necesarios para el ciclo de vida de la inscripción: `create`, `findById`, `findAll`, `findActiveByMemberAndSport`, `countActiveBySportId`, `update` y `softDelete`.
5. Crear el servicio de dominio `EnrollmentValidator.ts` en `src/domain/services/`, inyectando `EnrollmentRepository`, `MemberRepository` y `SportRepository`.
6. Implementar `CreateEnrollmentUseCase.ts` en `src/application/`.
7. Implementar `PostgresEnrollmentRepository.ts` en `src/infrastructure/`, con método `create` y mapeo a `EnrollmentDTO`.
8. Implementar las consultas auxiliares `findActiveByMemberAndSport` y `countActiveBySportId` en `PostgresEnrollmentRepository`.
9. Crear `EnrollmentController.ts` en `src/delivery/` con el método `create` y mapeo de errores.
10. Registrar las dependencias y la ruta `POST /api/v1/enrollments` en `src/app.ts`.
11. Agregar el método `create` al servicio frontend.
12. Crear o actualizar la vista de inscripciones con el formulario de alta.
13. Escribir tests unitarios para el caso de uso: socio inexistente, deporte inexistente, deporte eliminado, socio no activo, inscripción duplicada, cupo completo y creación exitosa.
14. Escribir tests de integración para el endpoint `POST /api/v1/enrollments`.