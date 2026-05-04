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
| `member_id`           | UUID     | Clave foránea que referencia al socio alcanzado por la medida disciplinaria |

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
    }
}
```

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `DisciplineRepository` — Métodos requeridos:
    - `create(data: Discipline): Promise<Discipline>`
2. **Puerto relacionado**: `MemberRepository` — Método requerido:
    - `findById(id: string): Promise<Member | null>`
3. **Servicio de Dominio**: `DisciplineValidator` — Centraliza la validación de campos obligatorios y coherencia de fechas (`end_date > start_date`).
4. **Caso de Uso**: `CreateDisciplineUseCase` — Orquesta la validación de existencia del socio, valida los datos de la disciplina y delega la persistencia al repositorio.
5. **Adaptador de Salida**: `PostgresDisciplineRepository` — Implementa el puerto usando Prisma y persiste la nueva disciplina.
6. **Adaptador de Entrada**: `DisciplineController` — Ruta HTTP que parsea el body, delega al caso de uso y devuelve `201 Created` con el recurso creado.

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
| Error de conexión a DB            | Mensaje: "Error interno, reintente más tarde"                      | 500 Internal Server Error |
| Alta exitosa                      | Retorna la disciplina creada                                       | 201 Created               |

---

## Plan de Implementación

1. Añadir el modelo `Discipline` en `schema.prisma`, correr la migración y definir los DTOs en `@alentapp/shared`.
2. Declarar la interfaz `DisciplineRepository` en el Dominio e implementar `PostgresDisciplineRepository`.
3. Implementar `DisciplineValidator` para validar campos obligatorios, booleanos y coherencia de fechas.
4. Implementar `CreateDisciplineUseCase`: validar existencia del socio, validar datos de entrada y persistir la disciplina.
5. Registrar la ruta `POST /api/v1/disciplines` en el controlador y en `app.ts`.
6. Añadir el método en el servicio de Frontend y conectar el formulario en la vista correspondiente.
7. Escribir tests unitarios para el caso de uso: socio inexistente, fechas inválidas, campos requeridos y alta exitosa.
8. Escribir tests de integración para el endpoint.
