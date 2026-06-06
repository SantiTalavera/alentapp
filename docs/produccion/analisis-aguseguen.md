# Análisis de Infraestructura Docker y OpenTelemetry — Alentapp

## Fase 1: Preparación para Producción

**Autor:** Agustina Eguen
**Fecha:** 06/06/2026
**Scope:** Revisión de configuración Docker orientada a buenas prácticas de producción e investigación sobre OpenTelemetry

---

## Descripción General

Se analizaron los tres archivos que componen la infraestructura de contenedores del monorepo **Alentapp**:

- `docker-compose.yml` — Orquestación de servicios
- `packages/api/Dockerfile` — Imagen del servidor Fastify (Node.js)
- `packages/web/Dockerfile` — Imagen del cliente React/Vite

El análisis identifica **5 problemas** en relación a las buenas prácticas de producción, organizados por impacto.

---

## 1.1 Análisis de Infraestructura Docker Actual

### Problemas Identificados

| # | Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
|---|----------|----------------|---------|-------------------|
| 1 | **Ausencia de HEALTHCHECK en los Dockerfiles.** Ninguno de los dos Dockerfile define una instrucción `HEALTHCHECK`. Docker no tiene forma de saber si el proceso dentro del contenedor está realmente funcionando o simplemente corriendo sin responder. Un contenedor puede aparecer como "running" aunque la aplicación esté colgada o en estado de error. | `packages/api/Dockerfile` y `packages/web/Dockerfile` — ausente en ambos | **Alto** | Agregar `HEALTHCHECK` en cada Dockerfile. Para la API: `HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -qO- http://localhost:3000/health \|\| exit 1`. Para el frontend con nginx: `HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:80 \|\| exit 1`. |
| 2 | **Ausencia de `.dockerignore` en ambos paquetes.** Sin un archivo `.dockerignore`, el contexto de build que Docker envía al daemon incluye directorios innecesarios como `node_modules`, `.git`, archivos de test y `.env`. Esto incrementa el tamaño de la imagen, ralentiza el build y puede incluir archivos sensibles en la imagen final. | `packages/api/` y `packages/web/` — `.dockerignore` inexistente en ambos | **Medio** | Crear un `.dockerignore` en cada paquete excluyendo: `node_modules`, `dist`, `.git`, `*.md`, `.env`, `.env.*`, `coverage` y archivos de test (`*.test.ts`). |
| 3 | **Sin configuración de logging ni rotación de logs.** Ningún servicio del compose define un driver de logging. Por defecto Docker usa `json-file` sin límite de tamaño, lo que puede llevar a que los logs crezcan indefinidamente hasta llenar el disco del host en producción. | `docker-compose.yml` — sección `services` completa, ausente en los tres servicios | **Medio** | Agregar configuración de logging explícita en cada servicio con rotación: `logging: driver: json-file options: max-size: "10m" max-file: "3"`. |
| 4 | **Uso de la red bridge por defecto en lugar de una red interna personalizada.** El compose no define ninguna red explícita. Docker asigna automáticamente la red `bridge` por defecto, que es compartida entre todos los proyectos Docker del host. Esto expone los contenedores a comunicaciones no deseadas con otros proyectos corriendo en la misma máquina. | `docker-compose.yml` — ausencia de sección `networks` | **Medio** | Definir una red interna dedicada al proyecto: `networks: alentapp-network: driver: bridge` y asignarla a cada servicio con `networks: - alentapp-network`. |
| 5 | **Filesystem de los contenedores escribible innecesariamente.** Ningún servicio tiene `read_only: true`. En producción, los contenedores no deberían necesitar escribir en su propio filesystem. Un filesystem escribible amplía la superficie de ataque: si un atacante gana ejecución de código, puede modificar binarios o scripts dentro del contenedor. | `docker-compose.yml` — servicios `api` y `web` | **Bajo** | Agregar `read_only: true` en los servicios `api` y `web`. Para los directorios donde sí se necesita escritura (logs temporales, caché de nginx) usar `tmpfs`: en api `tmpfs: - /tmp`, en web `tmpfs: - /var/cache/nginx - /var/run - /var/log/nginx`. |

---

## 1.2 Investigación sobre OpenTelemetry

**1. ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?**
OpenTelemetry es un framework de observabilidad de código abierto que provee APIs, SDKs y herramientas para instrumentar aplicaciones y recolectar datos de telemetría (métricas, trazas y logs) de forma estandarizada y agnóstica al backend. No almacena ni visualiza datos por sí mismo.
Prometheus en cambio es una base de datos de series temporales con su propio lenguaje de consultas (PromQL), orientada exclusivamente a métricas. La diferencia clave es que OpenTelemetry es el agente que genera y transporta los datos, mientras que Prometheus es el destino que los almacena y consulta.

**2. ¿Cuáles son los "3 pilares" de la observabilidad? ¿Cuál aborda OpenTelemetry?**
Los tres pilares son métricas (valores numéricos sobre el estado del sistema), trazas (el recorrido de una request a través de los servicios) y logs (eventos puntuales con contexto). OpenTelemetry aborda los tres de forma unificada bajo un mismo estándar, lo que elimina la necesidad de instalar múltiples agentes distintos.

**3. Explica el concepto de métricas RED. ¿Para qué sirve cada una?**
El método RED propone monitorear tres dimensiones de cualquier servicio orientado a requests:
- **Rate (Tasa):** cuántas requests por segundo recibe el servicio. Sirve para medir el volumen de tráfico y planificar escalabilidad.
- **Errors (Errores):** qué porcentaje de esas requests falla. Sirve para detectar problemas de disponibilidad y disparar alertas.
- **Duration (Duración):** cuánto tarda cada request en responderse, medida en percentiles (p95, p99). Sirve para evaluar la performance percibida por el usuario.

**4. ¿Qué es OTLP? ¿Qué ventaja tiene frente a exportar directamente a Prometheus?**
OTLP (OpenTelemetry Protocol) es el protocolo nativo de OTel para transmitir telemetría via gRPC o HTTP. La ventaja principal frente a exportar directo a Prometheus es el desacoplamiento: con OTLP la aplicación envía datos a un colector central que puede rutearlos a cualquier backend (Prometheus, Datadog, Grafana Cloud) sin modificar el código. Además OTLP transporta métricas, trazas y logs en un mismo canal, mientras que el exportador de Prometheus solo maneja métricas.

**5. ¿Cómo se relaciona OpenTelemetry con Grafana?**
OpenTelemetry instrumenta la aplicación y exporta las métricas a Prometheus. Grafana se conecta a Prometheus como fuente de datos y construye dashboards con esas métricas usando PromQL. La relación es complementaria: OTel produce y transporta los datos, Prometheus los almacena, y Grafana los visualiza.