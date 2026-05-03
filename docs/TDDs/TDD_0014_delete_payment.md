---
autor: Justina Smith
fecha: 2026-05-02
titulo: Baja lógica de Payment (Cancelación)
---

# TDD-0014: Baja lógica de Payment (Cancelación)

## Contexto de Negocio (PRD)

### Objetivo

Cuando un pago fue registrado por error —período equivocado, monto incorrecto— el tesorero necesita anularlo. El sistema no permite el borrado físico de registros financieros: la "baja" es un cambio de estado a `Canceled`, preservando el historial completo para auditoría contable.

### User Persona

- **Nombre**: Tesorero del club
- **Necesidad**: Anular cuotas cargadas incorrectamente sin perder el rastro del error. Si los registros desaparecen, la reconciliación contable se vuelve imposible. Necesita que el sistema lo proteja de borrar algo que debería quedar archivado.

### Criterios de Aceptación

- Al dar de baja un pago, su campo `status` pasa a `Canceled`. El registro permanece en la base de datos.
- El sistema debe verificar que el pago exista antes de intentar la cancelación.
- Solo pueden cancelarse pagos en estado `Pending`. Un pago en estado `Paid` no puede cancelarse.
- Si el pago ya estaba en estado `Canceled`, el sistema debe rechazar la operación.
- La respuesta debe incluir el pago con el estado final `Canceled` para confirmar la operación.

> **Nota de diseño**: se eligió soft delete en lugar de eliminación física para preservar la trazabilidad contable. Si en el futuro se requiere auditar movimientos, ese historial seguirá disponible.

## Diseño Técnico (RFC)

### Modelo de Datos

No se agregan campos nuevos al modelo. Se opera sobre el campo `status` ya definido en `Payment`:

| Campo    | Tipo   | Descripción                                        |
|----------|--------|----------------------------------------------------|
| `id`     | UUID   | Identifica el pago a cancelar                      |
| `status` | String | Pasa de `Pending` a `Canceled` al ejecutar la baja |

El resto de los campos (`amount`, `month`, `year`, `due_date`, `payment_date`, `member_id`) no se modifican durante este flujo.

### Contrato de API (`@alentapp/shared`)

**`DELETE /api/v1/payments/:id`**

Request: sin body.

Response `200 OK`:
```ts
{
  id: string;
  member_id: string;
  amount: number;
  month: number;
  year: number;
  due_date: string;
  status: "Canceled";     // siempre Canceled en una respuesta exitosa
  payment_date: null;
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: La entidad `Payment` incorpora la regla de que solo puede cancelarse un pago en estado `Pending`. Esta validación se hace antes de cualquier escritura.

- **Application**: `CancelPaymentUseCase` recibe el `id`, busca el pago, verifica que exista y que su estado sea `Pending`, y le pide al repositorio que actualice `status` a `Canceled`.

- **Infrastructure**: `PostgresPaymentRepository` implementa el método `cancel(id)` que hace un `update` con Prisma sobre el campo `status`. `PaymentController` expone el endpoint `DELETE`, extrae el `id` de los params y delega al caso de uso.

## Casos de Borde y Errores

| Escenario                              | Resultado Esperado                                    | Código HTTP               |
|----------------------------------------|-------------------------------------------------------|---------------------------|
| El ID no corresponde a ningún pago     | Error: pago no encontrado                             | 404 Not Found             |
| El pago ya tiene `status: Canceled`    | Error: el pago ya se encuentra cancelado              | 409 Conflict              |
| El pago tiene `status: Paid`           | Error: no se puede cancelar un pago ya efectuado      | 422 Unprocessable Entity  |
| Fallo inesperado en la base de datos   | Error interno                                         | 500 Server Error          |

## Plan de Implementación

1. Verificar que el campo `status` y el valor `Canceled` estén definidos en el modelo Prisma de `Payment`.
2. Agregar al puerto `PaymentRepository` el método `cancel(id: string)`.
3. Implementar `CancelPaymentUseCase` con las validaciones de existencia y estado.
4. Implementar el método `cancel` en `PostgresPaymentRepository`.
5. Exponer el endpoint `DELETE /api/v1/payments/:id` en `PaymentController` y registrarlo en Fastify.
6. Escribir tests unitarios: cancelación exitosa, pago no encontrado, pago ya cancelado, pago en estado `Paid`.
7. Escribir tests de integración para el endpoint.
