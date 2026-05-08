---
id: 0029
estado: propuesto
autor: Agustina Pilar Egüen
fecha: 2026-05-06
titulo: Listado y consulta de Certificados Médicos
---

# TDD-0029: Listado y consulta de Certificados Médicos

## Contexto de Negocio (PRD)

### Objetivo

Permitir que el administrativo consulte el historial de certificados médicos de un socio específico o acceda al detalle de un certificado en particular. 

### User Persona

- **Nombre**: Administrativo del club.
- **Necesidad**: Ver rápidamente qué certificados ha presentado un socio, cuál es el certificado activo y sus fechas de vigencia.

### Criterios de Aceptación

- El sistema debe permitir consultar todos los certificados médicos de un socio a través de su `member_id`.
- El sistema debe permitir consultar un certificado médico específico por su `id`.
- Si el certificado o socio consultado no existe, debe retornar `404 Not Found`.
- Cada elemento de la respuesta debe usar el contrato `MedicalCertificateDTO`.

---

## Diseño Técnico (RFC)

### Modelo de Datos

No se realizan cambios al esquema de persistencia en este TDD. Se reutiliza la entidad `MedicalCertificate` definida en el TDD-0010 de alta.

### Contrato de API (`@alentapp/shared`)

Se reutiliza `MedicalCertificateDTO`, definido en el TDD-0010 de alta. No se añaden tipos nuevos al paquete compartido.

**Endpoint 1 — Listado de certificados por socio:**

- **Método y Ruta**: `GET /api/v1/members/:memberId/medical-certificates`
- **Path Parameters**:
  - `memberId` *(string, UUID, requerido)*: Identificador único del socio.
- **Response exitosa** (`200 OK`):

```ts
{
  data: MedicalCertificateDTO[]
}
```

**Endpoint 2 — Consulta individual por ID:**

- **Método y Ruta**: `GET /api/v1/medical-certificates/:id`
- **Path Parameters**:
  - `id` *(string, UUID, requerido)*: Identificador único del certificado.
- **Response exitosa** (`200 OK`):

```ts
{
  data: MedicalCertificateDTO
}
```

### Componentes de Arquitectura Hexagonal

- **Domain**: el puerto `MedicalCertificateRepository` expone los métodos `findByMemberId` y `findById`.

- **Application**: `GetMedicalCertificatesByMemberUseCase` obtiene el historial de certificados de un socio. `GetMedicalCertificateByIdUseCase` obtiene un certificado por `id` y lanza un error de dominio si no existe.

- **Infrastructure**: `PostgresMedicalCertificateRepository` implementa `findByMemberId` y `findById` usando Prisma, mapeando los registros a `MedicalCertificateDTO`.

- **Delivery**: `MedicalCertificateController` expone `GET /api/v1/members/:memberId/medical-certificates` y `GET /api/v1/medical-certificates/:id`, extrae los parámetros de la URL, invoca los casos de uso y devuelve `200 OK` con `{ data: ... }`. La ruta se registra en `app.ts`.

---

## Casos de Borde y Errores

| Escenario                                 | Resultado Esperado                            | Código HTTP               |
| ----------------------------------------- | --------------------------------------------- | ------------------------- |
| Socio no tiene certificados registrados   | Retorna `{ data: [] }`                        | 200 OK                    |
| ID no corresponde a ningún certificado    | Mensaje: "Certificado no encontrado"          | 404 Not Found             |
| ID con formato inválido                   | Mensaje: "Identificador inválido"             | 400 Bad Request           |
| Error de conexión a DB                    | Mensaje: "Error interno, reintente más tarde" | 500 Internal Server Error |

## Plan de Implementación

1. Verificar que `MedicalCertificateDTO` ya esté definido en `@alentapp/shared`.
2. Confirmar que el `MedicalCertificateRepository` incluya el método `findById(id)` y ampliar el puerto con `findByMemberId(memberId)`.
3. Implementar `findByMemberId` y `findById` en `PostgresMedicalCertificateRepository`.
4. Implementar los casos de uso en `src/application/`.
5. Agregar los métodos al `MedicalCertificateController`.
6. Registrar las rutas en `src/app.ts`.
7. Agregar los métodos al servicio frontend.
8. Escribir tests unitarios y de integración.
