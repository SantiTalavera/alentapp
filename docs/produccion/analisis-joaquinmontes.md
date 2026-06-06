# Análisis de Infraestructura Docker y OpenTelemetry — Alentapp

## Fase 1: Preparación para Producción

**Autor:** Joaquín Montes  
**Fecha:** 06/06/2026  
**Scope:** Revisión de configuración Docker orientada a buenas prácticas de producción e investigación sobre OpenTelemetry

---

## Descripción General

Se analizaron los tres archivos que componen la infraestructura de contenedores del monorepo **Alentapp**:

- `docker-compose.yml` — Orquestación de servicios
- `packages/api/Dockerfile` — Imagen del servidor Fastify (Node.js)
- `packages/web/Dockerfile` — Imagen del cliente React/Vite

El análisis identifica **5 problemas** en relación a las buenas prácticas de producción, enfocados en exposición de red, arranque entre servicios, resiliencia y endurecimiento de contenedores.

---

## 1.1 Análisis de Infraestructura Docker Actual

### Problemas Identificados

| # | Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
|---|----------|----------------|---------|-------------------|
| 1 | **La base de datos queda accesible desde fuera del stack.** PostgreSQL publica el puerto `5432` del contenedor directamente al host (`5432:5432`). Cualquier proceso en la máquina —o en la red, si el firewall no bloquea— puede intentar conectarse a la DB sin pasar por la API. | `docker-compose.yml` líneas 9-10 | **Alto** | Eliminar el mapeo de puertos en `docker-compose.prod.yml`. La API se comunica con `db:5432` por red interna. Si hace falta acceso administrativo, usar un túnel SSH o exponer el puerto solo en un perfil `debug` explícito. |
| 2 | **El frontend puede arrancar antes de que la API esté lista.** El servicio `web` declara `depends_on: api` sin condición de salud. Docker solo espera a que el contenedor de la API exista, no a que esté escuchando en el puerto 3000. Además, la API no define `healthcheck` en el compose (a diferencia de `db`). El frontend puede levantarse mientras la API todavía corre migraciones o compila con `tsx watch`, generando errores de conexión intermitentes. | `docker-compose.yml` líneas 19-41 (api sin `healthcheck`) y líneas 59-60 (`depends_on` sin `condition`) | **Medio** | Agregar un `healthcheck` HTTP a la API y cambiar la dependencia del frontend a `depends_on: api: condition: service_healthy`. En producción, nginx puede devolver una página de mantenimiento mientras la API no responda. |
| 3 | **Ningún servicio define política de reinicio.** Los tres servicios (`db`, `api`, `web`) carecen de la directiva `restart`. Si un contenedor se cae por un error no capturado, un OOM o un reinicio del daemon de Docker, queda en estado `exited` hasta que alguien lo levante manualmente. | `docker-compose.yml` — servicios `db` (líneas 2-17), `api` (líneas 19-41) y `web` (líneas 43-60), sin clave `restart` | **Medio** | En `docker-compose.prod.yml` agregar `restart: unless-stopped` (o `always` en orquestadores gestionados). Combinar con healthchecks para que Docker reinicie contenedores que fallan de forma repetida. |
| 4 | **Sin endurecimiento de capabilities del kernel Linux.** Los contenedores `api` y `web` corren con el conjunto de capabilities por defecto de Docker, que incluye permisos como `CHOWN`, `DAC_OVERRIDE` y `NET_RAW`. No se aplica `cap_drop: ALL`, `no-new-privileges: true` ni una lista mínima de capabilities necesarias. | `docker-compose.yml` — servicios `api` y `web` (sin sección `cap_drop`, `cap_add` ni `security_opt`) | **Alto** | En producción aplicar `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]` y agregar solo lo indispensable (`NET_BIND_SERVICE` si el proceso escucha en puerto < 1024). Complementar con `read_only: true` y `tmpfs` para directorios que requieran escritura. |
| 5 | **La API se publica directamente en el host sin capa intermedia.** El puerto `3000` de la API se mapea tal cual al host (`3000:3000`). No hay reverse proxy (nginx, Traefik) que centralice TLS, rate limiting, headers de seguridad ni enrutamiento hacia el frontend. El proceso Fastify queda expuesto directamente a la red. | `docker-compose.yml` líneas 33-34 | **Alto** | En producción, exponer solo nginx en el puerto 80/443 y enrutar `/api` hacia el contenedor interno de la API por red privada. La API no debería publicar puertos al host; solo ser accesible dentro de la red Docker del proyecto. |

---

## 1.2 Investigación sobre OpenTelemetry

**1. ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?**
OpenTelemetry (OTel) es un estándar de la CNCF con APIs y SDKs para instrumentar código: contar requests, medir latencias y propagar trazas. No almacena ni visualiza datos por sí solo. Prometheus es una base de datos de series temporales con scraping periódico y consultas PromQL; actúa como destino donde se persisten y consultan las métricas. En resumen: OTel genera y transporta los datos, Prometheus los almacena.

**2. ¿Cuáles son los "3 pilares" de la observabilidad? ¿Cuál aborda OpenTelemetry?**
Los tres pilares son **métricas** (valores numéricos agregados en el tiempo), **trazas** (recorrido de una request a través del sistema) y **logs** (eventos discretos con contexto). OpenTelemetry aborda los tres de forma unificada bajo un mismo SDK. Por ejemplo, en Alentapp podría medir requests/seg a `/api/v1/lockers`, trazar un POST locker hasta la DB y registrar errores de Prisma, todo con la misma instrumentación.

**3. Explica el concepto de métricas RED (Rate, Errors, Duration). ¿Para qué sirve cada una?**
El método RED monitorea servicios orientados a requests HTTP:
- **Rate (Tasa):** requests por segundo. Permite detectar picos de tráfico o caídas súbitas de carga.
- **Errors (Errores):** fracción de requests con status 4xx/5xx. Base para alertas de disponibilidad.
- **Duration (Duración):** tiempo de respuesta en percentiles (p95/p99). Mide el rendimiento percibido por el usuario.

**4. ¿Qué es OTLP (OpenTelemetry Protocol)? ¿Qué ventaja tiene frente a exportar directamente a Prometheus?**
OTLP es el protocolo nativo de OTel (gRPC/HTTP + Protobuf) para transmitir métricas, trazas y logs. Su ventaja frente a exportar directo a Prometheus es el desacoplamiento: la app envía telemetría a un OpenTelemetry Collector vía OTLP y este la reenvía a Prometheus, Jaeger, Loki o Datadog sin modificar el código. Además, OTLP unifica las tres señales en un solo canal, mientras que el exportador de Prometheus solo maneja métricas. En esta actividad se usa el `PrometheusExporter` en el puerto 9464 como paso intermedio práctico.

**5. ¿Cómo se relaciona OpenTelemetry con Grafana?**
OpenTelemetry instrumenta la API y exporta métricas a Prometheus. Grafana se conecta a Prometheus como fuente de datos, ejecuta consultas PromQL y construye dashboards. La relación es complementaria: OTel produce los datos, Prometheus los almacena y Grafana los visualiza. Para Alentapp, el flujo sería OTel → `:9464/metrics` → Prometheus → dashboard RED con requests/seg, tasa de error y latencia p95.
