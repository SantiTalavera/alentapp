# Changelog — Alentapp

Todos los cambios relevantes de este proyecto se documentan en este archivo.

---

## [Sin publicar]

<!-- Listar acá los cambios que están en main pero aún no tienen versión asignada -->

### Added

- `docs/TDDs/TDD_0023` TDD de la Entidad Sport: Listado de deportes (#10)
- `docs/TDDs/TDD_0028` TDD de la Entidad Locker: Listado y Consulta de Casilleros (#12)
- `docs/TDDs/TDD_0024` TDD de la Entidad Enrollment: Registro de una nueva inscripción (#13)
- `docs/TDDs/TDD_0025` TDD de la Entidad Enrollment: Modificación de inscripción (#13)
- `docs/TDDs/TDD_0026` TDD de la Entidad Enrollment: Baja de inscripción (#13)
- `docs/TDDs/TDD_0027` TDD de la Entidad Enrollment: Listado de inscripciones (#13)
- `docs/TDDs/TDD_0029` TDD de la Entidad MedicalCertificate: Listado y Consulta de certificados (#14)
- Alta de disciplinas: modelo Prisma, migración, tipos compartidos, dominio, caso de uso, repositorio Postgres y endpoint `POST /api/v1/disciplines` (#18)

### Changed

- `docs/TDDs/TDD_0007` TDD de la Entidad Sport: Registro de nuevo deporte (#10)
- `docs/TDDs/TDD_0008` TDD de la Entidad Sport: Modificación de nuevo deporte (#10)
- `docs/TDDs/TDD_0009` TDD de la Entidad Sport: Baja de nuevo deporte (#10)
- `docs/TDDs/TDD_0016` TDD de la Entidad EquipmentLoan: Registro de nuevo préstamo (#11)
- `docs/TDDs/TDD_0017` TDD de la Entidad EquipmentLoan: Listado de préstamos (#11)
- `docs/TDDs/TDD_0018` TDD de la Entidad EquipmentLoan: Modificación de préstamo (#11)
- `docs/TDDs/TDD_0019` TDD de la Entidad EquipmentLoan: Baja de préstamo (#11)
- `docs/TDDs/TDD_0004` TDD de la Entidad Locker: Registro de nuevo locker (#12)
- `docs/TDDs/TDD_0005` TDD de la Entidad Locker: Baja de locker (#12)
- `docs/TDDs/TDD_0006` TDD de la Entidad Locker: Modificación de locker (#12)
- `docs/TDDs/TDD_0010` TDD de la Entidad MedicalCertificate: Registro de nuevo certificado (#14)
- `docs/TDDs/TDD_0011` TDD de la Entidad MedicalCertificate: Actualización de certificado (#14)
- `docs/TDDs/TDD_0012` TDD de la Entidad MedicalCertificate: Baja de certificado (#14)
- `packages/web/src/views/Members.tsx` incorpora la acción para registrar disciplinas desde la administración de miembros (#18)

---

## [0.2.0] - YYYY-MM-DD

### Added

-

### Changed

-

## [0.1.0] — 2026-05-03

> _Primera entrega: Actividad 1 TP Integrador — TDDs de las 6 entidades_

### Added

- `.github/pull_request_template.md` con template estándar para PRs (#1)
- `docs/TDDs/TDD_0004` TDD de la Entidad Locker: Registro de nuevo locker (#4)
- `docs/TDDs/TDD_0005` TDD de la Entidad Locker: Baja de locker (#4)
- `docs/TDDs/TDD_0006` TDD de la Entidad Locker: Modificación de locker (#4)
- `docs/TDDs/TDD_0007` TDD de la Entidad Sport: Registro de nuevo deporte (#5)
- `docs/TDDs/TDD_0008` TDD de la Entidad Sport: Modificación de nuevo deporte (#5)
- `docs/TDDs/TDD_0009` TDD de la Entidad Sport: Baja de nuevo deporte (#5)
- `docs/TDDs/TDD_0010` TDD de la Entidad MedicalCertificate: Registro de nuevo certificado (#6)
- `docs/TDDs/TDD_0011` TDD de la Entidad MedicalCertificate: Actualización de certificado (#6)
- `docs/TDDs/TDD_0012` TDD de la Entidad MedicalCertificate: Baja de certificado (#6)
- `docs/TDDs/TDD_0013` TDD de la Entidad Payment: Registro de nuevo payment (#7)
- `docs/TDDs/TDD_0014` TDD de la Entidad Payment: Baja de payment (#7)
- `docs/TDDs/TDD_0015` TDD de la Entidad Payment: Modificación de payment (#7)
- `docs/TDDs/TDD_0016` TDD de la Entidad EquipmentLoan: Registro de nuevo préstamo (#8)
- `docs/TDDs/TDD_0017` TDD de la Entidad EquipmentLoan: Listado de préstamos (#8)
- `docs/TDDs/TDD_0018` TDD de la Entidad EquipmentLoan: Modificación de préstamo (#8)
- `docs/TDDs/TDD_0019` TDD de la Entidad EquipmentLoan: Baja de préstamo (#8)
- `docs/TDDs/TDD_0020` TDD de la Entidad Discipline: Registro de nueva disciplina (#9)
- `docs/TDDs/TDD_0021` TDD de la Entidad Discipline: Modificación de disciplina (#9)
- `docs/TDDs/TDD_0022` TDD de la Entidad Discipline: Baja de disciplina (#9)

---

<!--
GUÍA DE USO:
============

Cada vez que se mergea un PR a main, el autor del PR o el coordinador debe agregar
una línea en la sección [Sin publicar] bajo la categoría correspondiente:

Categorías disponibles:
  Added   → nueva funcionalidad o archivo agregado
  Changed → cambio en funcionalidad existente
  Fixed   → corrección de un bug o error
  Removed → algo que se eliminó
  Security → corrección de vulnerabilidad

Formato de cada entrada:
  - Descripción breve del cambio (#número-de-PR)

Ejemplo:
  - TDD del ABM de Payment con regla de inmutabilidad (#3)

Cuando se hace una entrega o se cierra un sprint, la sección [Sin publicar]
se convierte en una versión con fecha:
  ## [0.2.0] — 2026-05-10
-->
