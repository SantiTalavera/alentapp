---
id: 0020
autor: Santiago Talavera
fecha: 2026-05-03
titulo: Registro de Disciplina
---

# TDD-0020: Registro de Disciplina

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos registrar una medida disciplinaria asociada a un socio, dejando trazabilidad del motivo, el periodo de vigencia y si la sanción implica una suspensión total de sus actividades dentro del club.

### User Persona

- **Nombre**: Administrativo del Club.
- **Necesidad**: Cargar sanciones o medidas disciplinarias de socios de forma ordenada, evitando registros incompletos o con periodos de vigencia incoherentes.

### Criterios de Aceptación

- El sistema debe validar que el socio (`member_id`) exista antes de registrar la disciplina.
- El campo `reason` es obligatorio y no puede estar vacío.
- El sistema debe validar que `end_date` sea estrictamente posterior a `start_date`.
- El campo `is_total_suspension` es obligatorio y debe ser booleano.
- Si la disciplina creada tiene `is_total_suspension: true` y se encuentra activa (`start_date <= hoy && end_date >= hoy`), el sistema debe cambiar el estado del socio a `Suspendido`.
- Antes de suspender al socio, el sistema debe conservar su estado anterior (`Activo` o `Moroso`) para poder restaurarlo cuando no queden disciplinas totales activas.
- Si el alta es exitosa, el sistema debe retornar la disciplina creada con sus datos completos.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se definirá la entidad `Discipline` con las siguientes propiedades y restricciones, de acuerdo con el DER provisto en la consigna.

Entidad involucrada: `Discipline`.

| Campo                 | Tipo     | Descripción                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------------- |
| `id`                  | UUID     | Clave primaria generada automáticamente                                     |
| `reason`              | String   | Motivo de la medida disciplinaria. Es obligatorio                           |
| `start_date`          | DateTime | Fecha de inicio de la disciplina                                            |
| `end_date`            | DateTime | Fecha de fin de la disciplina. Debe ser posterior a `start_date`            |
| `is_total_suspension` | Boolean  | Indica si la disciplina suspende totalmente al socio                        |
| `previous_member_status` | String \| null | Estado del socio antes de aplicar una suspensión total activa. Se usa para restaurar el estado cuando corresponda |
| `member_id`           | UUID     | Clave foránea que referencia al socio alcanzado por la medida disciplinaria |

Una disciplina se considera activa cuando `start_date <= hoy && end_date >= hoy`. Solo las disciplinas activas con `is_total_suspension: true` impactan sobre el estado del socio. Las disciplinas vencidas quedan registradas como historial, pero no reactivan ni suspenden automáticamente al socio fuera del momento de creación o edición.

Cuando una disciplina total activa suspende al socio, `previous_member_status` debe guardar el estado a restaurar cuando no queden suspensiones totales activas. Si el socio ya estaba `Suspendido` por otra disciplina total activa, la nueva disciplina debe reutilizar el `previous_member_status` ya registrado por esa suspensión vigente, evitando sobrescribir el estado original.

### Contrato de API (`@alentapp/shared`)

- **Endpoint**: `POST /api/v1/disciplines`
- **Request Body** (`CreateDisciplineRequest`):

```ts
{
    member_id: string; // UUID del socio
    reason: string; // Motivo de la disciplina
    start_date: string; // ISO Date String
    end_date: string; // ISO Date String
    is_total_suspension: boolean; // Indica si la suspensión es total
}
```

- **Response** (`201 Created`):

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

- **Domain**: el puerto `DisciplineRepository` define el contrato de persistencia necesario para registrar una nueva disciplina mediante `create` y consultar disciplinas totales activas del socio cuando sea necesario conservar o reutilizar el estado a restaurar. El puerto relacionado `MemberRepository` se utiliza para verificar que el socio indicado por `member_id` exista y para actualizar su estado a `Suspendido` cuando la disciplina total esté activa. El servicio `DisciplineValidator` centraliza las reglas propias de la entidad: campos obligatorios, tipo booleano de `is_total_suspension`, coherencia de fechas (`end_date > start_date`) y cálculo de vigencia (`start_date <= hoy && end_date >= hoy`).

- **Application**: `CreateDisciplineUseCase` orquesta el flujo sin conocer HTTP ni la base de datos: valida la existencia del socio, aplica las reglas de `DisciplineValidator`, construye la disciplina y delega la persistencia al repositorio. Si la disciplina creada es total y está activa, guarda en `previous_member_status` el estado que deberá restaurarse luego y actualiza el socio a `Suspendido` en la misma operación transaccional.

- **Infrastructure**: `PostgresDisciplineRepository` implementa el puerto usando Prisma y persiste la nueva disciplina en la tabla correspondiente, mapeando el resultado al DTO compartido. Cuando corresponde suspender al socio, la creación de la disciplina y la actualización del `Member.status` se ejecutan dentro de una transacción para evitar estados intermedios inconsistentes.

- **Delivery**: `DisciplineController` expone `POST /api/v1/disciplines`, valida el body tipado como `CreateDisciplineRequest`, delega al caso de uso y devuelve `201 Created` con `{ data: DisciplineDTO }`. La ruta y las dependencias se registran en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                         | Resultado Esperado                                                 | Código HTTP               |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Socio inexistente                 | Mensaje: "El socio no existe"                                      | 404 Not Found             |
| `reason` vacío o ausente          | Mensaje: "El motivo de la disciplina es requerido"                 | 400 Bad Request           |
| `start_date` ausente              | Mensaje: "La fecha de inicio es requerida"                         | 400 Bad Request           |
| `end_date` ausente                | Mensaje: "La fecha de fin es requerida"                            | 400 Bad Request           |
| `end_date` <= `start_date`        | Mensaje: "La fecha de fin debe ser posterior a la fecha de inicio" | 400 Bad Request           |
| `is_total_suspension` no booleano | Mensaje: "El campo suspensión total debe ser verdadero o falso"    | 400 Bad Request           |
| Alta de disciplina total activa   | Guarda el estado anterior del socio y cambia `status` a `Suspendido` | 201 Created               |
| Alta de disciplina total activa con otra suspensión total vigente | Reutiliza el `previous_member_status` existente y mantiene al socio `Suspendido` | 201 Created |
| Alta de disciplina total vencida o futura | Registra la disciplina sin cambiar el estado actual del socio | 201 Created               |
| Error de conexión a DB            | Mensaje: "Error interno, reintente más tarde"                      | 500 Internal Server Error |
| Alta exitosa                      | Retorna la disciplina creada                                       | 201 Created               |

---

## Plan de Implementación

1. Añadir el modelo `Discipline` en `schema.prisma`, incluyendo `previous_member_status` como campo nullable, correr la migración y definir los DTOs en `@alentapp/shared`.
2. Declarar la interfaz `DisciplineRepository` en el Dominio e implementar `PostgresDisciplineRepository`, incluyendo la consulta de disciplinas totales activas por socio.
3. Implementar `DisciplineValidator` para validar campos obligatorios, booleanos y coherencia de fechas.
4. Implementar `CreateDisciplineUseCase`: validar existencia del socio, validar datos de entrada, calcular si la disciplina total está activa, guardar el estado anterior del socio y suspenderlo cuando corresponda.
5. Registrar la ruta `POST /api/v1/disciplines` en el controlador y en `app.ts`.
6. Añadir el método en el servicio de Frontend y conectar el formulario en la vista correspondiente.
7. Escribir tests unitarios para el caso de uso: socio inexistente, fechas inválidas, campos requeridos, alta exitosa, suspensión por disciplina total activa y no suspensión por disciplina vencida o futura.
8. Escribir tests de integración para el endpoint.
