---
id: 0010
autor: Agustina Pilar Egüen
fecha: 2026-05-02
titulo: Registro de Certificados Médicos
---

# TDD-0010: Registro de Certificados Médicos

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos registrar el certificado médico de aptitud física de un socio, habilitándolo para participar en actividades deportivas del club. Al registrar un nuevo certificado, el sistema debe invalidar automáticamente cualquier certificado activo anterior del mismo socio, garantizando que exista a lo sumo un certificado vigente por persona.

### User Persona

- **Nombre**: Alberto (Tesorero/Administrativo).
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

- **Endpoint**: `POST /api/v1/medical-certificates`
- **Request Body** (`CreateMedicalCertificateRequest`):

```ts
{
    member_id: string;          // UUID del socio
    issue_date: string;         // ISO Date String (YYYY-MM-DD)
    expiry_date: string;        // ISO Date String (YYYY-MM-DD)
    doctor_license: string;     // Número de matrícula del médico emisor
}
```

- **Response** (`201 Created`):

```ts
{
    id: string;
    member_id: string;
    issue_date: string;
    expiry_date: string;
    doctor_license: string;
    is_validated: boolean;       // Siempre true al momento de creación
}
```

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `MedicalCertificateRepository` — Métodos requeridos:
   - `findActiveByMemberId(memberId: string): Promise<MedicalCertificate[]>`
   - `invalidateAllByMemberId(memberId: string): Promise<void>`
   - `create(data: MedicalCertificate): Promise<MedicalCertificate>`
2. **Caso de Uso**: `CreateMedicalCertificateUseCase` — Orquesta la validación de existencia del socio, la verificación de fechas, la invalidación de certificados previos y la creación del nuevo registro, todo dentro de una transacción atómica.
3. **Adaptador de Salida**: `PostgresMedicalCertificateRepository` — Implementa el puerto usando Prisma; utiliza `prisma.$transaction` para garantizar atomicidad entre el `updateMany` de invalidación y el `create`.
4. **Adaptador de Entrada**: `MedicalCertificateController` — Ruta HTTP que parsea el body, delega al caso de uso y devuelve `201 Created` con el recurso creado.

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
