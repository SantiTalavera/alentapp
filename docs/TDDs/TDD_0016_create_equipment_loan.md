---
id: 0016
estado: Propuesto
autor: Agostina Pascucci
fecha: 2026-05-02
titulo: Registro de Préstamo de Equipamiento
---

# TDD-0016: Registro de Préstamo de Equipamiento

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo registre digitalmente el préstamo de un ítem de equipamiento a un socio, dejando un historial trazable y auditable de cada operación. Reemplaza el registro manual en planillas de papel y previene la entrega a socios con cuentas irregulares, centralizando la información en el sistema.

### User Persona

- **Nombre**: Administración del Club
- **Necesidad**: Cuando un socio retira un elemento del club, necesita registrarlo rápidamente indicando a quién se le prestó, qué ítem es y cuándo debe devolverlo. No puede prestar equipamiento a alguien que tiene deudas pendientes o cuyo estado de cuenta lo inhabilita.

### Criterios de Aceptación

- El sistema debe validar que el socio (`member_id`) exista en la base de datos.
- El sistema debe validar que el socio tenga un `status` de `Activo`; no se puede prestar a socios `Morosos` o `Suspendidos`.
- El `loan_date` debe ser autogenerado con la fecha y hora actuales del servidor (`now()`); el cliente no puede enviarlo.
- El `status` del préstamo debe inicializarse como `Loaned` por defecto; el cliente no puede enviarlo.
- El `item_name` es un campo de texto libre obligatorio; no puede estar vacío ni ausente.
- La `due_date` (fecha estimada de devolución) es opcional en la petición, pero si se envía, debe ser una fecha futura en formato ISO 8601 válido.
- Al registrar el préstamo, el sistema debe retornar el objeto completo del préstamo creado (`EquipmentLoanDTO`) con estado HTTP `201 Created`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se define la entidad `EquipmentLoan` en el esquema de persistencia. Establece una relación de muchos-a-uno con la entidad `Member` existente.

**Entidad: `EquipmentLoan`** → tabla `equipment_loans`

| Atributo     | Tipo Lógico              | Restricciones                                                        |
| ------------ | ------------------------ | -------------------------------------------------------------------- |
| `id`         | UUID                     | Clave primaria. Generado automáticamente.                            |
| `item_name`  | Cadena de texto          | Requerido. No puede ser nulo ni vacío.                               |
| `status`     | Enumeración `LoanStatus` | Requerido. Valor por defecto: `Loaned`. No enviado por el cliente.   |
| `loan_date`  | Timestamp con zona       | Requerido. Autogenerado por la base de datos con `now()`.            |
| `due_date`   | Timestamp con zona       | Opcional (nullable). Fecha estimada de devolución.                   |
| `member_id`  | UUID (FK)                | Requerido. Clave foránea a `members.id`. No puede ser nulo.          |
| `deleted_at` | Timestamp con zona       | Opcional (nullable). `null` indica registro activo; si tiene valor, el registro está eliminado lógicamente. |

**Enumeración: `LoanStatus`**

| Valor      | Significado de Negocio                                   |
| ---------- | -------------------------------------------------------- |
| `Loaned`   | El ítem está actualmente en poder del socio. Estado inicial. |
| `Returned` | El socio devolvió el ítem en buen estado. Estado terminal. |
| `Damaged`  | El ítem fue devuelto o declarado en mal estado. Estado terminal. |

> **Nota de migración**: Se debe agregar la relación inversa `equipmentLoans EquipmentLoan[]` al modelo `Member` y ejecutar la migración correspondiente bajo el nombre `create_equipment_loans_table`.

### Contrato de API (`@alentapp/shared`)

Se añaden los siguientes tipos al paquete compartido `packages/shared/index.ts`. Estos tipos son la fuente de verdad compartida entre el frontend y el backend.

- **Endpoint**: `POST /api/v1/prestamos`
- **Autenticación**: N/A (en el alcance actual del proyecto)
- **Request Body** (`CreateEquipmentLoanRequest`):

```ts
// Tipo de unión para el estado del préstamo
export type LoanStatus = 'Loaned' | 'Returned' | 'Damaged';

// DTO de respuesta: representa un préstamo completo
export interface EquipmentLoanDTO {
  id: string;                  // UUID
  item_name: string;           // Nombre del ítem prestado
  status: LoanStatus;          // Estado actual del préstamo
  loan_date: string;           // ISO DateTime String (UTC)
  due_date: string | null;     // ISO DateTime String (UTC), nullable
  member_id: string;           // UUID del socio asociado
  deleted_at: string | null;   // ISO DateTime String (UTC). null = activo; valor = eliminado lógicamente.
}

// Contrato de entrada para la creación de un préstamo
export interface CreateEquipmentLoanRequest {
  item_name: string;   // Requerido
  due_date?: string;   // Opcional. ISO DateTime String
  member_id: string;   // Requerido. UUID del socio
}
```

- **Response exitosa** (`201 Created`):

```ts
{
  data: EquipmentLoanDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: El puerto `EquipmentLoanRepository` define el contrato de persistencia (métodos `create`, `findById`, `findAll`, `update`, `softDelete`). El servicio `EquipmentLoanValidator` encapsula las reglas de negocio: verifica que el socio exista y tenga estado `Activo`, y que la `due_date` —si se provee— sea futura. El puerto se define completo desde el inicio para que todos los casos de uso (TDD-0016 al TDD-0019) compartan la misma interfaz.

- **Application**: `CreateEquipmentLoanUseCase` orquesta el flujo sin conocer HTTP ni la base de datos: valida al socio, valida la fecha de devolución si aplica, y delega la escritura al repositorio.

- **Infrastructure**: `PostgresEquipmentLoanRepository` implementa el puerto con Prisma. El método `create` deja que la base de datos genere `id`, `status` (default `Loaned`) y `loan_date` (default `now()`), y usa un método privado `mapToDTO` para convertir el resultado al tipo compartido.

- **Delivery**: `EquipmentLoanController` expone `POST /api/v1/prestamos`, extrae y tipifica el body como `CreateEquipmentLoanRequest`, delega al caso de uso y mapea las excepciones de dominio a los códigos HTTP correspondientes (ver tabla de errores). La ruta se registra en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                        | Resultado Esperado                                      | Código HTTP              |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------ |
| `member_id` vacío o ausente                      | Mensaje: "El campo member_id es requerido"              | 400 Bad Request          |
| `member_id` no corresponde a ningún socio        | Mensaje: "El socio no existe"                           | 404 Not Found            |
| Socio con `status` = `Moroso` o `Suspendido`     | Mensaje: "El socio no está en estado Activo"            | 422 Unprocessable Entity |
| `item_name` vacío o ausente                      | Mensaje: "El nombre del ítem es requerido"              | 400 Bad Request          |
| `due_date` con formato no ISO 8601               | Mensaje: "Formato de fecha de devolución inválido"      | 400 Bad Request          |
| `due_date` con fecha en el pasado                | Mensaje: "La fecha de devolución debe ser futura"       | 422 Unprocessable Entity |
| Creación exitosa                                 | `EquipmentLoanDTO` completo con `status: 'Loaned'`      | 201 Created              |
| Error de conexión a base de datos                | Mensaje: "Error interno, reintente más tarde"           | 500 Internal Server Error|

---

## Plan de Implementación

1. Agregar `LoanStatus`, `EquipmentLoanDTO` y `CreateEquipmentLoanRequest` al paquete `@alentapp/shared` (`packages/shared/index.ts`).
2. Modificar el esquema de persistencia (`schema.prisma`): agregar el enum `LoanStatus`, el modelo `EquipmentLoan` y la relación inversa en `Member`.
3. Ejecutar la migración de base de datos con el nombre `create_equipment_loans_table`.
4. Crear el Puerto `EquipmentLoanRepository.ts` en `src/domain/` con todos los métodos del ciclo de vida completo.
5. Crear el Servicio de Dominio `EquipmentLoanValidator.ts` en `src/domain/services/`, inyectando `MemberRepository`.
6. Implementar `CreateEquipmentLoanUseCase.ts` en `src/application/`.
7. Implementar `PostgresEquipmentLoanRepository.ts` en `src/infrastructure/` con el método `create` y el mapeo a DTO.
8. Crear `EquipmentLoanController.ts` en `src/delivery/` con el método `create` y el mapeo de errores.
9. Registrar las dependencias y la ruta `POST /api/v1/prestamos` en `src/app.ts`.
10. Agregar el método `create` al servicio frontend (`packages/web/src/services/loans.ts`).
11. Crear la vista `EquipmentLoans.tsx` en `packages/web/src/views/` con el formulario de alta y registrar la ruta `/prestamos` en el router.
12. Escribir tests unitarios: creación exitosa, socio inexistente, socio moroso/suspendido, `due_date` en el pasado, `item_name` vacío.
13. Escribir tests de integración para el endpoint `POST /api/v1/prestamos`.
