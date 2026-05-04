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
    }
}
```

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `DisciplineRepository` — Métodos requeridos:
    - `findById(id: string): Promise<Discipline | null>`
    - `update(id: string, data: Partial<Discipline>): Promise<Discipline>`
2. **Servicio de Dominio**: `DisciplineValidator` — Centraliza la validación de campos modificables, body no vacío y coherencia de fechas (`end_date > start_date`).
3. **Caso de Uso**: `UpdateDisciplineUseCase` — Recupera el registro existente, rechaza la petición si se envía `member_id`, aplica los campos entrantes sobre los actuales, valida la coherencia de fechas resultante y delega la persistencia al repositorio.
4. **Adaptador de Salida**: `PostgresDisciplineRepository` — Actualización usando el método `update` de Prisma sobre el campo `id`.
5. **Adaptador de Entrada**: `DisciplineController` — Ruta HTTP que extrae el `id` de la URL, parsea el body parcial, delega al caso de uso y mapea las excepciones de dominio a códigos HTTP.

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
| Error de conexión a DB                | Mensaje: "Error interno, reintente más tarde"                      | 500 Internal Server Error |
| Actualización exitosa                 | Retorna la disciplina completa con los nuevos valores              | 200 OK                    |

---

## Plan de Implementación

1. Crear el tipo `UpdateDisciplineRequest` en `@alentapp/shared`, con los campos opcionales permitidos.
2. Agregar los métodos `findById` y `update` al puerto `DisciplineRepository`.
3. Reutilizar `DisciplineValidator` para validar body no vacío, campos modificables y fechas resultantes.
4. Implementar `UpdateDisciplineUseCase`, verificando existencia, rechazo de `member_id`, validación de fechas y persistencia.
5. Implementar el método `update` en `PostgresDisciplineRepository` usando Prisma.
6. Implementar el endpoint `PATCH /api/v1/disciplines/:id` en el controlador y registrarlo en `app.ts`.
7. Reutilizar/adaptar el formulario modal en el Frontend para el modo edición.
8. Escribir tests unitarios para el caso de uso: disciplina inexistente, fechas inválidas, body vacío, rechazo de `member_id` y actualización exitosa.
9. Escribir tests de integración para el endpoint.
