---
autor: Justina Smith
fecha: 2026-05-02
titulo: Modificación de Payment
---

# TDD-0015: Modificación de Payment

## Contexto de Negocio (PRD)

### Objetivo

Una vez creada una cuota, el tesorero puede necesitar corregir su monto o fecha de vencimiento, o bien registrar el cobro efectivo marcándola como pagada. Esta funcionalidad gestiona ambas operaciones bajo reglas estrictas: un pago ya efectuado es inmutable, y el mismo pago no puede cobrarse dos veces.

### User Persona

- **Nombre**: Tesorero del club
- **Necesidad**: Registrar el cobro de una cuota pendiente y poder corregir datos antes de que sea pagada. Su mayor preocupación es cobrar accidentalmente una cuota que ya estaba pagada, duplicando un ingreso que no existió.

### Criterios de Aceptación

- Se debe poder modificar `amount` y `due_date` de un pago existente, siempre que su estado sea `Pending`.
- Se debe poder marcar un pago como `Paid`. Al hacerlo, el sistema debe registrar automáticamente la `payment_date` con el timestamp del momento exacto del cobro.
- Un pago en estado `Paid` no puede volver a marcarse como pagado.
- Un pago en estado `Paid` no puede tener sus datos financieros modificados.
- El campo `member_id` es inmutable: no se puede reasignar el pago a otro socio.
- Si la edición es correcta, se devuelve el pago con todos sus datos actualizados.

> **Nota de diseño**: la `payment_date` no se acepta en el body del request. El sistema la asigna internamente al detectar la transición a `Paid`, garantizando la integridad del registro de cobro.

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Payment` ya existente. Los campos modificables en este caso de uso son:

| Campo          | Tipo     | Descripción                                                             |
|----------------|----------|-------------------------------------------------------------------------|
| `amount`       | Float    | Monto de la cuota. Solo modificable en estado `Pending`                 |
| `due_date`     | DateTime | Fecha de vencimiento. Solo modificable en estado `Pending`              |
| `status`       | String   | Estado del pago. Transiciones válidas descriptas a continuación         |
| `payment_date` | DateTime | Asignada automáticamente por el sistema al transicionar a `Paid`        |

Transiciones de estado válidas:

| Estado actual | → `Paid` | → `Canceled` |
|---------------|----------|--------------|
| `Pending`     | ✅        | ✅            |
| `Paid`        | ❌        | ❌            |
| `Canceled`    | ❌        | ❌            |

### Contrato de API (`@alentapp/shared`)

**`PATCH /api/v1/payments/:id`**

Request:
```ts
{
  amount?: number;    // solo válido si status es Pending
  due_date?: string;  // ISO 8601, solo válido si status es Pending
  status?: "Paid" | "Canceled";
}
```

Response `200 OK`:
```ts
{
  id: string;
  member_id: string;
  amount: number;
  month: number;
  year: number;
  due_date: string;
  status: "Pending" | "Paid" | "Canceled";
  payment_date: string | null;
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: La entidad `Payment` concentra las reglas de cuándo puede ser modificada: los campos financieros solo son editables en estado `Pending`, y las transiciones de estado siguen la tabla definida en este documento.

- **Application**: `UpdatePaymentUseCase` orquesta la operación: verifica que el pago exista, valida que el estado actual permita la transición, bloquea la edición de campos financieros si el pago está en `Paid`, asigna `payment_date` automáticamente al transicionar a `Paid`, y delega la escritura al repositorio.

- **Infrastructure**: `PostgresPaymentRepository` implementa `findById` y `update` usando Prisma. `PaymentController` recibe el request `PATCH`, extrae el `id` de los params y el body tipado, y llama al caso de uso.

## Casos de Borde y Errores

| Escenario                                           | Resultado Esperado                                         | Código HTTP               |
|-----------------------------------------------------|------------------------------------------------------------|---------------------------|
| ID no corresponde a ningún pago                     | Error: pago no encontrado                                  | 404 Not Found             |
| Pago en estado `Paid`, se intenta pagar de nuevo    | Error: el pago ya fue registrado como pagado               | 409 Conflict              |
| Modificar `amount` de un pago en estado `Paid`      | Error: el pago no puede modificarse en su estado actual    | 422 Unprocessable Entity  |
| Transición inválida (`Paid` → `Canceled`)           | Error: transición de estado no permitida                   | 422 Unprocessable Entity  |
| `amount` es cero o negativo                         | Error: debe ser mayor a cero                               | 400 Bad Request           |
| Cliente envía `payment_date` en el body             | El campo es ignorado; `payment_date` la asigna el sistema  | 200 OK                    |
| Fallo inesperado en la base de datos                | Error interno                                              | 500 Server Error          |

## Plan de Implementación

1. Agregar tipo `UpdatePaymentRequest` en `@alentapp/shared`.
2. Incorporar el método `canBeModified()` a la entidad `Payment` en el dominio.
3. Ampliar el puerto `PaymentRepository` con los métodos `findById` y `update`.
4. Implementar `UpdatePaymentUseCase` con todas las validaciones encadenadas.
5. Implementar los métodos `findById` y `update` en `PostgresPaymentRepository`.
6. Implementar el endpoint `PATCH /api/v1/payments/:id` en el controlador y registrarlo en Fastify.
7. Escribir tests unitarios para cada rama del caso de uso (pago no encontrado, re-pago, modificación de pago cerrado, éxito).
8. Escribir tests de integración para el endpoint.
