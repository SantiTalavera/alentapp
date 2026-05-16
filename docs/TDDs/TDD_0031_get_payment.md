---
id: 0031
estado: Propuesto
autor: Justina Smith
fecha: 2026-05-16
titulo: Listado y consulta de Pagos
---

# TDD-0031: Listado y consulta de Pagos

## Contexto de Negocio (PRD)

### Objetivo

Proveer al área de tesorería y administración una herramienta para consultar el historial de pagos y cuotas generadas, tanto pendientes como pagadas o canceladas. Permite visualizar el estado de cuenta general o buscar los pagos de un socio específico.

### User Persona

- **Nombre**: Tesorero del club
- **Necesidad**: Auditar los ingresos del mes, revisar qué socios tienen cuotas pendientes, o consultar el detalle de un pago específico ante el reclamo de un socio.

### Criterios de Aceptación

- El sistema debe retornar todos los pagos registrados.
- El sistema debe soportar filtrado **opcional** por `memberId`, `status`, `month` y `year` mediante query parameters.
- Si no existen pagos que coincidan con la búsqueda, el sistema debe retornar un array vacío en la propiedad `data`, no un error.
- El sistema debe soportar la consulta de un pago **individual** por su `id`.
- Si se solicita un pago por `id` y no existe, el sistema debe retornar `404 Not Found`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se reutiliza el modelo `Payment` definido en TDD-0013. 

Las consultas aplican los siguientes filtros opcionales:
- `memberId`: filtra por el socio (`member_id`).
- `status`: filtra por el estado del pago (`Pending`, `Paid`, `Canceled`).
- `month`: filtra por mes (1-12).
- `year`: filtra por año.

Ordenamiento:
Por defecto, los pagos deberían ordenarse por `year` y `month` de forma descendente (más recientes primero).

### Contrato de API (`@alentapp/shared`)

**Endpoint 1 — Listado general (con filtros opcionales):**

- **Método y Ruta**: `GET /api/v1/payments`
- **Query Parameters**:
  - `memberId` *(string, UUID, opcional)*: Filtra los pagos de un socio.
  - `status` *(string, opcional)*: Filtra por estado (`Pending`, `Paid`, `Canceled`).
  - `month` *(number, opcional)*: Filtra por mes.
  - `year` *(number, opcional)*: Filtra por año.
- **Response exitosa** (`200 OK`):

```ts
{
  data: [
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
  ]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/payments/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del pago.
- **Response exitosa** (`200 OK`):

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

- **Domain**: El puerto `PaymentRepository` debe incluir los métodos `findAll(filters?)` y `findById(id)`.
- **Application**: 
    - `GetPaymentsUseCase`: Orquesta la búsqueda filtrada y el ordenamiento.
    - `GetPaymentByIdUseCase`: Busca un pago específico y valida su existencia.
- **Infrastructure**: `PostgresPaymentRepository` implementa las consultas Prisma aplicando los filtros opcionales proporcionados.
- **Delivery**: `PaymentController` expone los métodos `getAll` y `getById`, extrae los parámetros de la URL e invoca los casos de uso correspondientes.

---

## Casos de Borde y Errores

| Escenario | Resultado Esperado (JSON) | Código HTTP |
| :--- | :--- | :--- |
| No existen pagos registrados | `{ "data": [] }` | 200 OK |
| Filtros sin resultados | `{ "data": [] }` | 200 OK |
| `status` inválido en query param | `{ "error": "Estado de pago no válido" }` | 400 Bad Request |
| `memberId` con formato no UUID | `{ "error": "Formato de id de socio inválido" }` | 400 Bad Request |
| `month` fuera de rango (1-12) | `{ "error": "Mes inválido" }` | 400 Bad Request |
| `id` inexistente | `{ "error": "Pago no encontrado" }` | 404 Not Found |
| `id` con formato no UUID | `{ "error": "Formato de id inválido" }` | 400 Bad Request |
| Error de conexión a DB | `{ "error": "Error interno" }` | 500 Server Error |

## Plan de Implementación

1. Asegurar que los métodos `findAll` y `findById` estén definidos en el puerto `PaymentRepository`.
2. Implementar `GetPaymentsUseCase` y `GetPaymentByIdUseCase`.
3. Implementar la lógica de consultas dinámicas en `PostgresPaymentRepository` usando Prisma.
4. Agregar los endpoints `GET /api/v1/payments` y `GET /api/v1/payments/:id` al `PaymentController` y registrarlos en Fastify.
5. Crear o actualizar la vista de "Gestión de Pagos" en el frontend para soportar los filtros y la visualización del listado.
6. Escribir tests unitarios para los casos de uso.
7. Escribir tests de integración para ambos endpoints validando los diferentes filtros.
