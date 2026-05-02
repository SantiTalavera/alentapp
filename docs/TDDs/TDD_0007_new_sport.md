---
id: 0007
autor: Nicolás Perez
fecha: 2026-05-02
titulo: Registro de Nuevo Deporte
---

# TDD-0007: Registro de Nuevo Deporte

## Contexto de Negocio (PRD)

### Objetivo

Permitir que un administrativo dé de alta un deporte de forma digital, manteniendo actualizado el catálogo de actividades ofrecidas por el club y asegurando la integridad de los datos desde la creación.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Cargar nuevos deportes rápidamente, indicando su descripción, cupo máximo y datos administrativos asociados. No puede permitirse registrar deportes duplicados o con una capacidad inválida.

### Criterios de Aceptación

- El sistema debe permitir registrar un deporte con `name`, `description`, `max_capacity`, `additional_price` y `requires_medical_certificate`.
- El sistema debe validar que el nombre del deporte sea obligatorio y único.
- El sistema debe validar que `max_capacity` sea un número entero mayor a cero.
- El sistema debe validar que `additional_price`, si se informa, no sea negativo.
- El deporte debe quedar guardado con su `id` generado automáticamente.
- El nombre del deporte debe quedar definido al momento del alta y no podrá modificarse posteriormente.
- Al finalizar, el sistema debe mostrar un mensaje de éxito y limpiar el formulario.

## Diseño Técnico (RFC)

### Modelo de Datos

Se definirá la entidad `Sport` con las siguientes propiedades y restricciones, de acuerdo con el DER provisto en la consigna.

Entidad involucrada: `Sport`.

| Campo                          | Tipo    | Nullable | Descripción                                                                       |
| ------------------------------ | ------- | -------- | --------------------------------------------------------------------------------- |
| `id`                           | UUID    | No       | Clave primaria de la entidad.                                                     |
| `name`                         | String  | No       | Nombre del deporte. Debe ser único, obligatorio e inmutable luego de la creación. |
| `description`                  | String  | No       | Descripción del deporte.                                                          |
| `max_capacity`                 | Int     | No       | Cupo máximo del deporte. Debe ser mayor a cero.                                   |
| `additional_price`             | Float   | No       | Precio adicional del deporte. Debe ser mayor o igual a cero.                      |
| `requires_medical_certificate` | Boolean | No       | Indica si el deporte requiere certificado médico.                                 |

La entidad `Sport` se relaciona con `Enrollment`, ya que una inscripción referencia al deporte mediante `sport_id`.

### Contrato de API (@alentapp/shared)

Definiremos los tipos en el paquete compartido para asegurar sincronización:

- Endpoint: `POST /api/v1/sports`
- Request Body (CreateSportRequest):

```ts
{
    name: string; //requerido
    description: string; //requerido
    max_capacity: number; //requerido, > a 0
    additional_price: number; //requerido
    requires_medical_certificate: boolean; //requerido
}
```

- Response Body (SportDTO dentro de `{ data }`) `201: Created`:

```ts
{
    data: {
        id: string;
        name: string;
        description: string;
        max_capacity: number;
        additional_price: number;
        requires_medical_certificate: boolean;
    }
}
```

### Componentes de Arquitectura Hexagonal

1. Puerto: `SportRepository` (Interface en el Dominio, con operaciones para crear deportes y consultar por nombre).
2. Caso de Uso: `NewSportUseCase` (Lógica que verifica si el nombre ya existe y que `max_capacity` sea mayor a cero antes de llamar al repositorio).
3. Adaptador de Salida: `PostgresSportRepository` (Implementación real en BD usando Prisma. Captura errores de unicidad sobre `name` y los traduce a un error de dominio comprensible).
4. Adaptador de Entrada: `SportController` (Ruta HTTP `POST /api/v1/deportes`).

## Casos de Borde y Errores

| Escenario                                  | Resultado Esperado                                                         | Código HTTP               |
| ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| Nombre ya registrado                       | Mensaje: "Ya existe un deporte con ese nombre"                             | 409 Conflict              |
| Nombre ausente o vacío                     | Mensaje: "El nombre del deporte es obligatorio"                            | 400 Bad Request           |
| `max_capacity` igual a 0 o negativo        | Mensaje: "La capacidad máxima debe ser mayor a cero"                       | 400 Bad Request           |
| `max_capacity` no entero                   | Mensaje: "La capacidad máxima debe ser un número entero"                   | 400 Bad Request           |
| `additional_price` negativo                | Mensaje: "El precio adicional no puede ser negativo"                       | 400 Bad Request           |
| `requires_medical_certificate` no booleano | Mensaje: "El campo requiere certificado médico debe ser verdadero o falso" | 400 Bad Request           |
| Error de conexión a DB                     | Mensaje: "Error interno, reintente más tarde"                              | 500 Internal Server Error |

## Plan de Implementación

1. Definir esquema de persistencia para `Sport` y correr migración.
2. Crear tipos en shared y puerto `SportRepository` en el Dominio.
3. Implementar el repositorio, las validaciones de negocio, el caso de uso y el controlador.
4. Crear formulario en React y conectar con el endpoint del backend.