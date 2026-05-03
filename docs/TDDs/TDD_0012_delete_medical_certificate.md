---
id: 0012
autor: Agustina Pilar Egüen
fecha: 2026-05-02
titulo: Eliminación de Certificados Médicos
---

# TDD-0012: Eliminación de Certificados Médicos

## Contexto de Negocio (PRD)

### Objetivo

Permitir a los administrativos eliminar permanentemente un certificado médico del sistema cuando fue cargado por error —por ejemplo, asignado al socio equivocado o con datos completamente incorrectos que hacen inútil su corrección. Esta operación es destructiva e irreversible, por lo que requiere una confirmación explícita del operador.

### User Persona

- **Nombre**: Alberto (Tesorero/Administrativo).
- **Necesidad**: Borrar un certificado duplicado o cargado por error desde la tabla de gestión del socio. Necesita una advertencia visual antes de proceder para evitar eliminar un registro válido por accidente.

### Criterios de Aceptación

- El sistema debe pedir una confirmación explícita (advertencia visual) antes de proceder con el borrado.
- El sistema debe validar que el certificado exista antes de intentar eliminarlo.
- El sistema debe realizar un borrado físico del registro en la base de datos (hard delete).
- Si el certificado eliminado era el activo (`is_validated: true`), el sistema no recalcula ni reactiva ningún certificado anterior de forma automática; el socio queda sin certificado activo hasta que se registre uno nuevo.
- Si el borrado es exitoso, la vista del socio debe actualizarse automáticamente.

---

## Diseño Técnico (RFC)

### Contrato de API (`@alentapp/shared`)

Al tratarse de una operación destructiva que solo requiere el identificador, no se envía cuerpo en la petición HTTP.

- **Endpoint**: `DELETE /api/v1/medical-certificates/:id`
- **Request Body**: `None`
- **Response**: `204 No Content` en caso de éxito.

### Componentes de Arquitectura Hexagonal

1. **Puerto**: `MedicalCertificateRepository` — Método adicional requerido:
   - `findById(id: string): Promise<MedicalCertificate | null>` (compartido con TDD-0011)
   - `delete(id: string): Promise<void>`
2. **Caso de Uso**: `DeleteMedicalCertificateUseCase` — Verifica la existencia del certificado mediante `findById` y, si existe, delega la eliminación al repositorio.
3. **Adaptador de Salida**: `PostgresMedicalCertificateRepository` — Eliminación física usando el método `delete` de Prisma filtrado por `id`.
4. **Adaptador de Entrada**: `MedicalCertificateController` — Ruta HTTP que extrae el `id` de la URL, delega al caso de uso y devuelve `204 No Content` ante éxito.

---

## Casos de Borde y Errores

| Escenario                              | Resultado Esperado                                          | Código HTTP               |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| Certificado inexistente                | Mensaje: "El certificado médico no existe"                  | 404 Not Found             |
| Error de conexión a DB                 | Mensaje: "Error interno, reintente más tarde"               | 500 Internal Server Error |
| Eliminación exitosa (cert. inactivo)   | Respuesta vacía                                             | 204 No Content            |
| Eliminación exitosa (cert. activo)     | Respuesta vacía; socio queda sin certificado activo         | 204 No Content            |

---

## Plan de Implementación

1. Ampliar la interfaz `MedicalCertificateRepository` con el método `delete`.
2. Implementar `DeleteMedicalCertificateUseCase`: verificar existencia vía `findById` y delegar la eliminación.
3. Implementar el método `delete` en `PostgresMedicalCertificateRepository` usando Prisma.
4. Implementar el endpoint `DELETE /api/v1/medical-certificates/:id` en el controlador y registrarlo en `app.ts`.
5. Añadir el método `delete` al servicio de Frontend.
6. Enlazar el botón de eliminación en la vista del socio, agregando una confirmación visual `window.confirm` antes de ejecutar.
7. Escribir tests unitarios para el caso de uso: certificado inexistente, eliminación exitosa, y manejo de errores.
8. Escribir tests de integración para el endpoint.

