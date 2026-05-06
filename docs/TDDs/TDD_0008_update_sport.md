---
id: 0008
estado: Propuesto
autor: Nicolás Pérez
fecha: 2026-05-02
titulo: Modificación de Deporte Existente
---

# TDD-0008: Modificación de Deporte Existente

## Contexto de Negocio (PRD)

### Objetivo

Una vez creado el deporte en el sistema, esta funcionalidad permite que un administrativo modifique sus datos editables ya registrados, manteniendo actualizada la información del catálogo deportivo sin comprometer las reglas de negocio definidas para la entidad.

La modificación de un deporte debe permitir actualizar sus datos operativos, pero no debe permitir cambiar su nombre, ya que el atributo `name` es inmutable después de la creación.

### User Persona

- Nombre: Administrativo del Club.
- Necesidad: Actualizar la descripción, el cupo máximo, el precio adicional o el requerimiento de certificado médico de un deporte cuando cambian las condiciones operativas del club. No puede permitirse modificar accidentalmente o intencionalmente el nombre de un deporte ya registrado ni definir una capacidad inválida.

### Criterios de Aceptación

- El sistema debe permitir modificar `description`, `max_capacity`, `additional_price` y `requires_medical_certificate`.
- El sistema no debe permitir modificar el campo `name`.
- El sistema debe validar que `max_capacity`, si se informa, sea un número entero mayor a cero.
- El sistema debe validar que `additional_price`, si se informa, sea mayor o igual a cero.
- Si el deporte no existe, debe fallar con un error claro.
- Si el body no contiene campos modificables, la operación debe fallar con un error de validación.
- El sistema debe validar que el deporte esté activo (`deleted_at` en `null`) antes de permitir su modificación.
- Al completarse correctamente la operación, el sistema debe guardar el deporte con todos sus datos actualizados.

## Diseño Técnico (RFC)

### Modelo de Datos

Se trabaja sobre la entidad `Sport` definida en el alta de deporte. La operación es una actualización parcial sobre un deporte existente.

Entidad involucrada: `Sport`.

| Campo                          | Tipo     | Editable | Descripción                                                                 |
| ------------------------------ | -------- | -------- | --------------------------------------------------------------------------- |
| `id`                           | UUID     | No       | Clave primaria de la entidad.                                             |
| `name`                         | String   | No       | Nombre del deporte. Es único e inmutable luego de la creación.            |
| `description`                  | String   | Sí       | Descripción del deporte.                                                    |
| `max_capacity`                 | Int      | Sí       | Cupo máximo del deporte. Debe ser mayor a cero.                             |
| `additional_price`             | Float    | Sí       | Precio adicional del deporte. Debe ser mayor o igual a cero.                |
| `requires_medical_certificate` | Boolean  | Sí       | Indica si el deporte requiere certificado médico.                           |
| `deleted_at`                   | DateTime | No       | Marca de baja lógica. Si tiene valor, el deporte está eliminado lógicamente. |

No se permite modificar deportes eliminados lógicamente.

La restricción principal de esta operación es que **no puede actualizarse `name`**. Cualquier intento de modificarlo debe ser rechazado con un error explícito.

### Contrato de API (@alentapp/shared)

Se utilizará el paquete compartido para definir el cuerpo de la petición. Todos los campos permitidos son opcionales porque se trata de una actualización parcial.
Se reutiliza `SportDTO`, definido en el TDD de alta de deporte, como contrato de respuesta común para la entidad.

- Endpoint: `PATCH /api/v1/sports/:id`
- Request Body (UpdateSportRequest):

```ts
export interface UpdateSportRequest {
  description?: string;
  max_capacity?: number;
  additional_price?: number;
  requires_medical_certificate?: boolean;
}
```

- Response Body (SportDTO dentro de `{ data }`): `200: OK`:

```ts
{
  data: SportDTO
}
```

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `SportRepository` (Interfaz en el Dominio con métodos `findById(id)` y `update(id, data)`). Permite que el caso de uso trabaje contra una abstracción y no dependa directamente de Prisma.
2. **Servicio de Dominio / Entidad**: `Sport` o `SportValidator` (Encargado de aplicar las reglas de negocio propias de la entidad). En esta operación debe garantizar que `name` no pueda modificarse después de la creación, que `max_capacity` sea mayor a cero , que `additional_price` no sea negativo y que no se modifiquen deportes eliminados lógicamente.
3. **Caso de Uso**: `UpdateSportUseCase` (Orquesta la operación). Recibe el `id` y el body del request, verifica que el deporte exista y que esté activo (`deleted_at` en `null`), valida los campos enviados, rechaza cualquier intento de modificar `name` y llama al repositorio para persistir los cambios.
4. **Adaptador de Salida**: `PostgresSportRepository` (Implementación real en BD usando Prisma). Ejecuta la actualización sobre la tabla `Sport` y expone los métodos definidos por el puerto.
5. **Adaptador de Entrada**: `SportController` (Ruta HTTP `PATCH /api/v1/sports/:id`). Extrae el `id` de la URL, valida el body tipado como `UpdateSportRequest`, invoca el caso de uso y mapea excepciones a códigos HTTP.

## Casos de Borde y Errores

| Escenario                                  | Resultado Esperado                                                         | Código HTTP               |
| ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| ID no corresponde a ningún deporte         | Mensaje: "Deporte no encontrado"                                           | 404 Not Found             |
| Deporte eliminado lógicamente              | Mensaje: "No se puede modificar un deporte eliminado"                     | 409 Conflict              |
| Body vacío                                 | Mensaje: "Se requiere al menos un campo para actualizar"                   | 400 Bad Request           |
| Se intenta modificar `name`                | Mensaje: "El nombre del deporte no puede modificarse"                      | 400 Bad Request           |
| `max_capacity` igual a 0 o negativo        | Mensaje: "La capacidad máxima debe ser mayor a cero"                       | 400 Bad Request           |
| `max_capacity` no entero                   | Mensaje: "La capacidad máxima debe ser un número entero"                   | 400 Bad Request           |
| `additional_price` negativo                | Mensaje: "El precio adicional no puede ser negativo"                       | 400 Bad Request           |
| `requires_medical_certificate` no booleano | Mensaje: "El campo requiere certificado médico debe ser verdadero o falso" | 400 Bad Request           |
| Error de conexión a DB                     | Mensaje: "Error interno, reintente más tarde"                              | 500 Internal Server Error |



## Plan de Implementación
1. Crear el tipo `UpdateSportRequest` en `@alentapp/shared`, incluyendo únicamente los campos editables: `description`, `max_capacity`, `additional_price` y `requires_medical_certificate`.
2. Agregar el método `update(id, data)` al puerto `SportRepository` y asegurar que exista un método `findById(id)` para validar la existencia del deporte y su estado de baja lógica.
3. Implementar las validaciones de dominio para impedir la modificación de `name`, validar que `max_capacity` sea mayor a cero, que `additional_price` sea mayor o igual a cero y que no se modifiquen deportes eliminados lógicamente.
4. Implementar `UpdateSportUseCase`, verificando existencia del deporte, que esté activo (`deleted_at` en `null`), body no vacío, campos permitidos y reglas de negocio antes de persistir.
5. Implementar el método `update` en `PostgresSportRepository` usando Prisma.
6. Implementar el endpoint `PATCH /api/v1/sports/:id` en `SportController` y registrarlo en Fastify.
7. Crear o reutilizar el formulario/modal de edición en React, deshabilitando o excluyendo el campo `name`.
8. Escribir tests unitarios para el caso de uso: deporte inexistente, deporte eliminado, intento de modificar `name`, `max_capacity` inválido, `additional_price` inválido, body vacío y actualización exitosa.
9. Escribir tests de integración para el endpoint.
