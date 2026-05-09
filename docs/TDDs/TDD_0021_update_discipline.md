---
id: 0021
autor: Santiago Talavera
fecha: 2026-05-03
titulo: Actualización de Disciplina Existente
---

# TDD-0021: Actualización de Disciplina Existente

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos corregir o actualizar una medida disciplinaria ya registrada, modificando datos como el motivo, las fechas de vigencia o el alcance de la suspensión, sin cambiar el socio al que pertenece el registro.

### User Persona

- **Nombre**: Administrativo del Club.
- **Necesidad**: Corregir errores de carga o ajustar el periodo de una disciplina manteniendo la integridad del historial del socio y evitando cambios accidentales de titularidad.

### Criterios de Aceptación

- El sistema debe validar que la disciplina a actualizar exista.
- El sistema debe permitir actualizar uno o varios campos: `reason`, `start_date`, `end_date`, `is_total_suspension`.
- El campo `member_id` es inmutable: si el cliente lo envía en el body, el sistema debe rechazar la petición con un error explícito (`400 Bad Request`).
- Si se modifica alguna de las fechas, el sistema debe revalidar que `end_date` sea estrictamente posterior a `start_date` usando los valores resultantes.
- Si `is_total_suspension` pasa de `false` a `true`, el sistema debe suspender al socio solo si la disciplina resultante está activa (`start_date <= hoy && end_date >= hoy`), guardando el estado anterior para restauración futura.
- Si una disciplina total activa deja de ser total o deja de estar activa por una edición de fechas, el sistema debe restaurar el estado anterior del socio solo si no queda otra disciplina total activa para ese socio.
- Si el body no contiene campos modificables, la operación debe fallar con un error de validación.
- Si la edición es correcta, debe retornar la disciplina completa con los datos actualizados.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Discipline` definida en el alta de disciplina. La operación es una actualización parcial sobre un registro existente.

Entidad involucrada: `Discipline`.

| Campo                 | Tipo     | Editable | Descripción                                          |
| --------------------- | -------- | -------- | ---------------------------------------------------- |
| `id`                  | UUID     | No       | Clave primaria de la entidad                         |
| `member_id`           | UUID     | No       | Socio asociado a la disciplina. No puede modificarse |
| `reason`              | String   | Sí       | Motivo de la medida disciplinaria                    |
| `start_date`          | DateTime | Sí       | Fecha de inicio de la disciplina                     |
| `end_date`            | DateTime | Sí       | Fecha de fin. Debe ser posterior a `start_date`      |
| `is_total_suspension` | Boolean  | Sí       | Indica si la disciplina suspende totalmente al socio |
| `previous_member_status` | String \| null | No | Estado del socio previo a la suspensión total activa. No se modifica desde la API |

Una disciplina resultante se considera activa cuando `start_date <= hoy && end_date >= hoy`. Solo una disciplina activa con `is_total_suspension: true` debe mantener al socio en estado `Suspendido`.

Cuando una actualización convierte la disciplina en una suspensión total activa, `previous_member_status` debe guardar el estado a restaurar cuando no queden suspensiones totales activas. Si ya existe otra disciplina total activa para el socio, se reutiliza el `previous_member_status` de esa suspensión vigente para no perder el estado original.

### Contrato de API (`@alentapp/shared`)

Se trata de una actualización parcial a nivel de negocio. Todos los campos permitidos son opcionales.

- **Endpoint**: `PATCH /api/v1/disciplines/:id`
- **Request Body** (`UpdateDisciplineRequest`):

```ts
{
    reason?: string;
    start_date?: string;            // ISO Date String
    end_date?: string;              // ISO Date String
    is_total_suspension?: boolean;
}
```

- **Response** (`200 OK`):

```ts
{
    data: {
        id: string;
        member_id: string;
        reason: string;
        start_date: string;
        end_date: string;
        is_total_suspension: boolean;
        previous_member_status: "Activo" | "Moroso" | null;
    }
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `DisciplineRepository` incluye `findById` para recuperar el estado actual de la disciplina, `update` para persistir solo los campos permitidos y una consulta de disciplinas totales activas del mismo socio para decidir si el socio debe seguir suspendido. El puerto relacionado `MemberRepository` se usa para actualizar el estado del socio cuando la disciplina resultante activa o deja de activar una suspensión total. El servicio `DisciplineValidator` centraliza la validación de body no vacío, campos modificables, coherencia de fechas (`end_date > start_date`) y cálculo de vigencia (`start_date <= hoy && end_date >= hoy`) usando los valores resultantes de combinar el estado actual con el request parcial.

- **Application**: `UpdateDisciplineUseCase` orquesta el flujo de modificación: recupera el registro existente, rechaza la petición si se intenta modificar `member_id`, aplica los campos entrantes sobre los valores actuales, valida la disciplina resultante y delega la persistencia al repositorio. Si la edición convierte la disciplina en una suspensión total activa, guarda el estado anterior y actualiza el socio a `Suspendido`; si deja de ser una suspensión total activa, verifica si existen otras suspensiones totales activas antes de restaurar el estado previo.

- **Infrastructure**: `PostgresDisciplineRepository` implementa la actualización usando Prisma sobre el campo `id`, persistiendo únicamente los campos admitidos por el caso de uso y mapeando el resultado a `DisciplineDTO`. Las actualizaciones que impacten el estado del socio se ejecutan junto con la modificación de la disciplina dentro de una transacción.

- **Delivery**: `DisciplineController` expone `PATCH /api/v1/disciplines/:id`, extrae el `id` de la URL, valida el body tipado como `UpdateDisciplineRequest`, delega al caso de uso y mapea las excepciones de dominio a los códigos HTTP correspondientes.

---

## Casos de Borde y Errores

| Escenario                             | Resultado Esperado                                                 | Código HTTP               |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Disciplina inexistente                | Mensaje: "La disciplina no existe"                                 | 404 Not Found             |
| Body vacío                            | Mensaje: "Se debe enviar al menos un campo para actualizar"        | 400 Bad Request           |
| Intento de modificar `member_id`      | Mensaje: "El socio de la disciplina no puede modificarse"          | 400 Bad Request           |
| `reason` vacío                        | Mensaje: "El motivo de la disciplina es requerido"                 | 400 Bad Request           |
| `end_date` <= `start_date` resultante | Mensaje: "La fecha de fin debe ser posterior a la fecha de inicio" | 400 Bad Request           |
| `is_total_suspension` no booleano     | Mensaje: "El campo suspensión total debe ser verdadero o falso"    | 400 Bad Request           |
| `is_total_suspension` pasa de `false` a `true` y la disciplina resultante está activa | Guarda estado anterior y cambia el socio a `Suspendido` | 200 OK |
| `is_total_suspension` pasa de `false` a `true` y ya existe otra suspensión total activa | Reutiliza el `previous_member_status` existente y mantiene al socio `Suspendido` | 200 OK |
| `is_total_suspension` pasa de `true` a `false` sin otras disciplinas totales activas | Restaura el estado anterior del socio (`Activo` o `Moroso`) | 200 OK |
| Disciplina total activa pasa a vencida o futura sin otras disciplinas totales activas | Restaura el estado anterior del socio (`Activo` o `Moroso`) | 200 OK |
| Se desactiva una disciplina total pero queda otra disciplina total activa | El socio permanece `Suspendido` | 200 OK |
| Error de conexión a DB                | Mensaje: "Error interno, reintente más tarde"                      | 500 Internal Server Error |
| Actualización exitosa                 | Retorna la disciplina completa con los nuevos valores              | 200 OK                    |

---

## Plan de Implementación

1. Crear el tipo `UpdateDisciplineRequest` en `@alentapp/shared`, con los campos opcionales permitidos.
2. Agregar los métodos `findById`, `update` y consulta de disciplinas totales activas al puerto `DisciplineRepository`.
3. Reutilizar `DisciplineValidator` para validar body no vacío, campos modificables, fechas resultantes y vigencia de la disciplina.
4. Implementar `UpdateDisciplineUseCase`, verificando existencia, rechazo de `member_id`, validación de fechas, suspensión del socio cuando la disciplina total resultante esté activa y restauración del estado anterior cuando corresponda.
5. Implementar el método `update` en `PostgresDisciplineRepository` usando Prisma y transacción cuando se actualice también `Member.status`.
6. Implementar el endpoint `PATCH /api/v1/disciplines/:id` en el controlador y registrarlo en `app.ts`.
7. Reutilizar/adaptar el formulario modal en el Frontend para el modo edición.
8. Escribir tests unitarios para el caso de uso: disciplina inexistente, fechas inválidas, body vacío, rechazo de `member_id`, actualización exitosa, suspensión al pasar a total activa, restauración al dejar de ser total activa y permanencia en `Suspendido` cuando exista otra disciplina total activa.
9. Escribir tests de integración para el endpoint.
