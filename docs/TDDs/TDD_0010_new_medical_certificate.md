---
id: 0010
estado: propuesto
autor: Agustina Pilar Egüen
fecha: 2026-05-02
titulo: Registro de Certificados Médicos
---

# TDD-0010: Registro de Certificados Médicos

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos registrar el certificado médico de aptitud física de un socio, habilitándolo para participar en actividades deportivas del club. Al registrar un nuevo certificado, el sistema debe invalidar automáticamente cualquier certificado activo anterior del mismo socio, garantizando que exista a lo sumo un certificado vigente por persona.

### User Persona

- **Nombre**: Administrativo del club.
- **Necesidad**: Cargar el certificado médico de un socio al inicio de cada temporada o cuando uno nuevo es presentado en ventanilla. Necesita que el proceso sea atómico: no puede quedar el socio sin certificado activo ni con dos certificados activos simultáneamente.

### Criterios de Aceptación

- El sistema debe validar que el socio (`member_id`) exista antes de registrar el certificado.
- El sistema debe validar que `expiry_date` sea estrictamente posterior a `issue_date`.
- Al crear un nuevo certificado, el sistema debe invalidar (`is_validated: false`) todos los certificados previos del socio en la misma transacción de base de datos.
- El nuevo certificado debe quedar guardado con `is_validated: true` por defecto.
- Si el alta es exitosa, el sistema debe retornar el certificado creado con sus datos completos.

---

## Diseño Técnico (RFC)

### Modelo de Datos

Se definirá la entidad `MedicalCertificate` con las siguientes propiedades y restricciones:

- `id`: Identificador único universal (UUID).
- `issue_date`: Fecha de emisión del certificado (Date).
- `expiry_date`: Fecha de vencimiento del certificado (Date). Debe ser estrictamente posterior a `issue_date`.
- `doctor_license`: Cadena de texto con la matrícula del médico emisor.
- `is_validated`: Booleano que indica si el certificado es el activo del socio. Solo puede existir un registro con valor `true` por socio en todo momento.
- `member_id`: Clave foránea (UUID) que referencia al socio titular del certificado.

**Constraint de unicidad**: Se debe crear un índice único parcial sobre `(member_id)` filtrado por `is_validated = true`, garantizando a nivel de base de datos que nunca existan dos certificados activos para el mismo socio, incluso ante transacciones concurrentes.

### Contrato de API (`@alentapp/shared`)

Se añaden los siguientes tipos al paquete compartido `packages/shared/index.ts`. Estos tipos son la fuente de verdad compartida entre el frontend y el backend.

- **Endpoint**: `POST /api/v1/medical-certificates`

```ts
export interface MedicalCertificateDTO {
    id: string;                 // UUID
    member_id: string;          // UUID del socio
    issue_date: string;         // ISO Date String (YYYY-MM-DD)
    expiry_date: string;        // ISO Date String (YYYY-MM-DD)
    doctor_license: string;     // Número de matrícula del médico emisor
    is_validated: boolean;      // Indica si es el certificado activo
}

export interface CreateMedicalCertificateRequest {
    member_id: string;          // UUID del socio
    issue_date: string;         // ISO Date String (YYYY-MM-DD)
    expiry_date: string;        // ISO Date String (YYYY-MM-DD)
    doctor_license: string;     // Número de matrícula del médico emisor
}
```

- **Response exitosa** (`201 Created`):

```ts
{
  data: MedicalCertificateDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `MedicalCertificateRepository` define el contrato de persistencia con los métodos requeridos: `findActiveByMemberId`, `invalidateAllByMemberId` y `create`. Se aplican las reglas de negocio, como validar que el `expiry_date` sea posterior al `issue_date`. El puerto se define completo desde el inicio.

- **Application**: `CreateMedicalCertificateUseCase` orquesta el flujo sin conocer HTTP ni la base de datos: valida la existencia del socio, verifica la coherencia de fechas, invalida certificados previos y crea el nuevo registro, todo de forma atómica.

- **Infrastructure**: `PostgresMedicalCertificateRepository` implementa el puerto usando Prisma; utiliza `prisma.$transaction` para garantizar atomicidad entre el `updateMany` de invalidación y el `create`, mapeando el resultado a `MedicalCertificateDTO`.

- **Delivery**: `MedicalCertificateController` expone `POST /api/v1/medical-certificates`, valida el body tipado como `CreateMedicalCertificateRequest`, delega al caso de uso y devuelve `201 Created` con `{ data: MedicalCertificateDTO }`. La ruta y las dependencias se registran en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                          | Resultado Esperado                                              | Código HTTP               |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------- |
| Socio inexistente                  | Mensaje: "El socio no existe"                                   | 404 Not Found             |
| `expiry_date` <= `issue_date`      | Mensaje: "La fecha de vencimiento debe ser posterior a la de emisión" | 400 Bad Request      |
| `doctor_license` vacío o ausente   | Mensaje: "La matrícula del médico es requerida"                 | 400 Bad Request           |
| Fallo en la transacción de DB      | Mensaje: "Error interno, reintente más tarde" (rollback total)  | 500 Internal Server Error |
| Alta exitosa (sin cert. previo)    | Retorna el certificado con `is_validated: true`                  | 201 Created               |
| Alta exitosa (con cert. previo)    | Invalida el anterior y retorna el nuevo con `is_validated: true` | 201 Created               |

---

## Plan de Implementación

1. Añadir el modelo `MedicalCertificate` en `schema.prisma` con un índice único parcial (`@@unique`) sobre `member_id` filtrado por `is_validated = true`, correr la migración y definir los DTOs en `@alentapp/shared`.
2. Declarar la interfaz `MedicalCertificateRepository` en el Dominio e implementar `PostgresMedicalCertificateRepository`, usando `prisma.$transaction` para la invalidación + creación atómica.
3. Implementar `CreateMedicalCertificateUseCase`: validar existencia del socio, coherencia de fechas y delegar al repositorio.
4. Registrar la ruta `POST /api/v1/medical-certificates` en el controlador y en `app.ts`.
5. Añadir el método en el servicio de Frontend y conectar el formulario en la vista del socio.
