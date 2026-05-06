---
id: 0007
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-02
titulo: Registro de Nuevo Deporte
---

# TDD-0007: Registro de Nuevo Deporte

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo dé de alta un deporte de forma digital, manteniendo actualizado el catálogo de actividades ofrecidas por el club y asegurando la integridad de los datos desde la creación.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Cargar nuevos deportes rápidamente, indicando su descripción, cupo máximo, precio adicional y si requiere certificado médico. No puede permitirse registrar deportes duplicados o con una capacidad inválida.

### Criterios de Aceptación

- El sistema debe permitir registrar un deporte con `name`, `description`, `max_capacity`, `additional_price` y `requires_medical_certificate`.
- El sistema debe validar que el nombre del deporte sea obligatorio y único.
- El sistema debe validar que `max_capacity` sea un número entero mayor a cero.
- El sistema debe validar que `additional_price` sea mayor o igual a cero.
- El sistema debe validar que `requires_medical_certificate` sea un valor booleano.
- El deporte debe quedar guardado con su `id` generado automáticamente.
- El nombre del deporte debe quedar definido al momento del alta y no podrá modificarse posteriormente.
- El deporte se crea con `deleted_at` en `null`, indicando que está activo (no eliminado lógicamente).
- Al finalizar, el sistema debe mostrar un mensaje de éxito y limpiar el formulario.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se definirá la entidad `Sport` con las siguientes propiedades y restricciones, de acuerdo con el DER provisto en la consigna.

Entidad involucrada: `Sport`.

| Campo                          | Tipo     | Nullable | Descripción                                                                                                                                    |
| ------------------------------ | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | UUID     | No       | Clave primaria de la entidad.                                                                                                                  |
| `name`                         | String   | No       | Nombre del deporte. Debe ser único, obligatorio e inmutable luego de la creación.                                                            |
| `description`                  | String   | No       | Descripción del deporte.                                                                                                                       |
| `max_capacity`                 | Int      | No       | Cupo máximo del deporte. Debe ser mayor a cero.                                                                                               |
| `additional_price`             | Float    | No       | Precio adicional del deporte. Debe ser mayor o igual a cero.                                                                                  |
| `requires_medical_certificate` | Boolean  | No       | Indica si el deporte requiere certificado médico.                                                                                                |
| `deleted_at`                   | DateTime | Sí       | Marca de baja lógica. `null` indica que el deporte está activo; si tiene valor, indica que fue eliminado lógicamente (soft delete).              |

La entidad `Sport` se relaciona con `Enrollment`, ya que una inscripción referencia al deporte mediante `sport_id`.

### Contrato de API (`@alentapp/shared`)

Se añaden los siguientes tipos al paquete compartido `packages/shared/index.ts`. Estos tipos son la fuente de verdad compartida entre el frontend y el backend.

- **Endpoint**: `POST /api/v1/sports`

```ts
export interface SportDTO {
  id: string;                               //UUID
  name: string;                             //Nombre único del deporte
  description: string;                      //Descripción del deporte
  max_capacity: number;                     //Cupo máximo, debe ser > 0
  additional_price: number;                 //Precio adicional debe ser >= 0
  requires_medical_certificate: boolean;    //Indica si requiere certificado médico
  deleted_at: string | null;                //ISO DateTime String. null = activo; con valor = eliminado lógicamente
}

export interface CreateSportRequest {
  name: string;
  description: string;
  max_capacity: number;
  additional_price: number;
  requires_medical_certificate: boolean;
}
```

- **Response exitosa** (`201 Created`):

```ts
{
  data: SportDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `SportRepository` define el contrato de persistencia. El servicio `SportValidator` (o una entidad `Sport`) concentra las reglas de negocio: `name` obligatorio y único (coordinado con el repositorio para la unicidad), `max_capacity` entero mayor a cero, `additional_price` mayor o igual a cero. Al crear un deporte, `deleted_at` se inicializa en `null`. El puerto se define completo desde el inicio para que los casos de uso de alta, modificación, baja y consulta compartan la misma interfaz.

- **Application**: `NewSportUseCase` orquesta el flujo sin conocer HTTP ni la base de datos: aplica validaciones, verifica duplicados por `name` y delega la persistencia al repositorio.

- **Infrastructure**: `PostgresSportRepository` implementa el puerto con Prisma, persiste el alta, mapea el resultado a `SportDTO` y captura errores de unicidad sobre `name`, traduciéndolos a errores de dominio comprensibles.

- **Delivery**: `SportController` expone `POST /api/v1/sports`, valida el body tipado como `CreateSportRequest`, delega al caso de uso y devuelve `201 Created` con `{ data: SportDTO }`. La ruta y las dependencias se registran en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                  | Resultado Esperado                                                         | Código HTTP               |
| ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| Nombre ya registrado                       | Mensaje: "Ya existe un deporte con ese nombre"                             | 409 Conflict              |
| `name` ausente o vacío                     | Mensaje: "El nombre del deporte es obligatorio"                            | 400 Bad Request           |
| `description` ausente o vacía              | Mensaje: "La descripción del deporte es obligatoria"                       | 400 Bad Request           |
| `max_capacity` igual a 0 o negativo        | Mensaje: "La capacidad máxima debe ser mayor a cero"                       | 400 Bad Request           |
| `max_capacity` no entero                   | Mensaje: "La capacidad máxima debe ser un número entero"                   | 400 Bad Request           |
| `additional_price` menor que cero          | Mensaje: "El precio adicional debe ser mayor o igual a cero"               | 400 Bad Request           |
| `additional_price` ausente                 | Mensaje: "El precio adicional es obligatorio"                              | 400 Bad Request           |
| `requires_medical_certificate` no booleano | Mensaje: "El campo requiere certificado médico debe ser verdadero o falso" | 400 Bad Request           |
| Alta exitosa                               | Respuesta con `SportDTO` donde `deleted_at` es `null`                      | 201 Created               |
| Error de conexión a DB                     | Mensaje: "Error interno, reintente más tarde"                              | 500 Internal Server Error |

## Plan de Implementación

1. Agregar `SportDTO` y `CreateSportRequest` al paquete `@alentapp/shared` (`packages/shared/index.ts`).
2. Modificar el esquema de persistencia (`schema.prisma`): agregar el modelo `Sport`, incluyendo `deleted_at` como campo nullable para soportar baja lógica.
3. Ejecutar la migración de base de datos con el nombre `create_sports_table`.
4. Crear el puerto `SportRepository.ts` en `src/domain/` con los métodos necesarios para el ciclo de vida de `Sport`: `create`, `findById`, `findByName`, `findAll`, `update` y `softDelete`.
5. Crear el servicio de dominio `SportValidator.ts` en `src/domain/services/`, encapsulando las reglas: `name` obligatorio y único, `max_capacity` > 0, `additional_price` >= 0.
6. Implementar `NewSportUseCase.ts` en `src/application/`.
7. Implementar `PostgresSportRepository.ts` en `src/infrastructure/`, con método `create` y mapeo a `SportDTO`.
8. Crear `SportController.ts` en `src/delivery/` con el método `create` y mapeo de errores.
9. Registrar las dependencias y la ruta `POST /api/v1/sports` en `src/app.ts`.
10. Agregar el método `create` al servicio frontend.
11. Crear o actualizar la vista de deportes con el formulario de alta.
12. Escribir tests unitarios para el caso de uso.
13. Escribir tests de integración para el endpoint `POST /api/v1/sports`.
