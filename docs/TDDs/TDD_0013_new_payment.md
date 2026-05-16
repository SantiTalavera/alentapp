---
id: 0013
autor: Justina Smith
fecha: 2026-05-02
titulo: Alta de Payment
---

# TDD-0013: Alta de Payment

## Contexto de Negocio (PRD)

### Objetivo

El club necesita registrar digitalmente las cuotas mensuales de sus socios. Esta funcionalidad cubre el proceso de incorporar un nuevo pago al sistema, asegurando que no existan cuotas duplicadas para el mismo período y que el registro quede en un estado inicial coherente, listo para ser gestionado por el área de tesorería.

### User Persona

- **Nombre**: Tesorero del club
- **Necesidad**: Generar cuotas para sus socios sin riesgo de duplicados. Su punto de dolor más común es registrar dos veces la misma cuota para el mismo socio en el mismo mes, o cargar un monto negativo por un error de tipeo.

### Criterios de Aceptación

- Se debe poder crear un pago indicando el socio, monto, mes, año y fecha de vencimiento.
- El campo `member_id` es obligatorio y debe corresponder a un socio existente en el sistema.
- El campo `amount` es obligatorio y debe ser un número positivo mayor a cero.
- El campo `month` debe ser un entero entre 1 y 12.
- No puede registrarse un pago si ya existe otro para el mismo `member_id`, `month` y `year`.
- Todo pago recién creado debe tener `status: "Pending"` de forma automática, sin que el usuario lo especifique.
- La `payment_date` debe quedar en `null` al momento de la creación.
- Ante datos inválidos o duplicados, el sistema debe devolver un error descriptivo sin persistir nada.

## Diseño Técnico (RFC)

### Modelo de Datos

Entidad involucrada: `Payment`.

| Campo          | Tipo     | Descripción                                                     |
|----------------|----------|-----------------------------------------------------------------|
| `id`           | UUID     | Clave primaria generada automáticamente                         |
| `amount`       | Float    | Monto de la cuota. Debe ser mayor a cero                        |
| `month`        | Int      | Mes de referencia (1–12)                                        |
| `year`         | Int      | Año de referencia (ej: 2026)                                    |
| `due_date`     | DateTime | Fecha límite de pago                                            |
| `status`       | String   | Estado del pago. Se inicializa siempre en `Pending`             |
| `payment_date` | DateTime | Fecha en que se efectuó el pago. `null` hasta ser pagado        |
| `member_id`    | UUID     | FK hacia `Member`. Identifica al socio deudor                   |

Valores válidos para `status`: `Pending`, `Paid`, `Canceled`.

Restricción única compuesta: `(member_id, month, year)`.

### Contrato de API (`@alentapp/shared`)

**`POST /api/v1/payments`**

Request:
```ts
{
  member_id: string;  
  amount: number;     
  month: number;      
  year: number;       
  due_date: string;   
}
```

Response `201 Created`:
```ts
{
  data: {
    id: string;
    member_id: string;
    amount: number;
    month: number;
    year: number;
    due_date: string;
    status: "Pending" | "Paid" | "Canceled";
    payment_date: string | null;
  }
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: Entidad `Payment` con sus campos. El `status` se inicializa siempre en `Pending` y `payment_date` en `null` al momento de su creación, sin que el cliente pueda sobreescribirlos.

- **Application**: `CreatePaymentUseCase` recibe los datos del request, verifica que el socio exista mediante `MemberRepository`, verifica que no exista otro pago para el mismo `(member_id, month, year)` mediante `PaymentRepository`, y delega la persistencia.

- **Infrastructure**: `PostgresPaymentRepository` implementa el puerto de dominio usando Prisma con los métodos `findByPeriod` y `create`. `PaymentController` expone el endpoint, valida el body y llama al caso de uso.

## Casos de Borde y Errores

| Escenario                                    | Resultado Esperado                              | Código HTTP      |
|----------------------------------------------|-------------------------------------------------|------------------|
| Falta algún campo requerido                  | Error: campo requerido                          | 400 Bad Request  |
| `amount` es cero o negativo                  | Error: debe ser mayor a cero                    | 400 Bad Request  |
| `month` fuera del rango 1–12                 | Error: mes inválido                             | 400 Bad Request  |
| `member_id` no corresponde a ningún socio    | Error: socio no encontrado                      | 404 Not Found    |
| Ya existe un pago para ese socio, mes y año  | Error: ya existe un pago para este período      | 409 Conflict     |
| Fallo inesperado en la base de datos         | Error interno                                   | 500 Server Error |

## Plan de Implementación

1. Agregar tipos `CreatePaymentRequest` y `PaymentDTO` en `@alentapp/shared`.
2. Definir la entidad `Payment` en la capa de dominio con sus restricciones iniciales.
3. Definir el puerto `PaymentRepository` con al menos `findByPeriod` y `create`.
4. Implementar `CreatePaymentUseCase` en la capa de aplicación.
5. Implementar `PostgresPaymentRepository` con Prisma, manejando el error `P2002`.
6. Implementar `PaymentController` y registrar la ruta en Fastify.
7. Escribir tests unitarios para el caso de uso (repositorio mockeado).
8. Escribir tests de integración para el endpoint.
