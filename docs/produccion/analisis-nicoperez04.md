# Análisis de Infraestructura Docker y OpenTelemetry — Alentapp

## Fase 1: Preparación para Producción

**Autor:** Nicolás Pérez  
**Fecha:** 06/06/2026  
**Scope:** Revisión de configuración Docker orientada a buenas prácticas de producción e investigación sobre OpenTelemetry

---

## Descripción General

Se revisó la infraestructura de contenedores del monorepo **Alentapp**, compuesta por los siguientes artefactos:

- `docker-compose.yml` — Orquestación de los servicios `db`, `api` y `web`
- `packages/api/Dockerfile` — Imagen del backend Fastify (Node.js + Prisma)
- `packages/web/Dockerfile` — Imagen del frontend React/Vite

El stack actual está claramente orientado al **desarrollo local**: bind mounts del repositorio, hot reload, servidores de desarrollo y migraciones interactivas de Prisma. Esas decisiones son razonables para iterar con rapidez en la máquina del desarrollador, pero **no deben confundirse con una configuración apta para producción**, donde se espera inmutabilidad de imagen, builds reproducibles y separación entre arranque de la aplicación y evolución del esquema de datos.

Este documento identifica **cinco problemas** vinculados a esa frontera dev/prod: tres de impacto alto relacionados con el runtime y las migraciones, uno de impacto medio sobre reproducibilidad de dependencias, y uno de impacto medio-alto sobre el contexto de build y la superficie de la imagen.

---

## 1.1 Análisis de Infraestructura Docker Actual

### Problemas Identificados


| #   | Problema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ¿Dónde ocurre?                                                                                        | Impacto        | Solución propuesta                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Ejecución de `prisma migrate dev` durante el startup de la API.** El servicio `api` lanza migraciones con el comando de desarrollo de Prisma cada vez que arranca el contenedor. En un entorno local esto facilita alinear el esquema con el código fuente sin pasos manuales adicionales. En producción, sin embargo, mezcla el ciclo de vida del runtime con la evolución del esquema: el contenedor de aplicación deja de ser un proceso estable y pasa a ejecutar una operación de mantenimiento de base de datos. Con varias réplicas arrancando en paralelo, pueden producirse condiciones de carrera, bloqueos o resultados no deterministas. Además, `migrate dev` puede generar o modificar archivos de migración — comportamiento pensado para el flujo de trabajo del desarrollador, no para un despliegue controlado y auditable.                                                                                                                                        | `docker-compose.yml` línea 36                                                                         | **Alto**       | Separar migraciones del arranque de la API. En producción (o en pipelines de CI/CD) ejecutar `prisma migrate deploy` como paso previo al rollout: job de migración, init container o etapa dedicada del pipeline. El contenedor de la API debe asumir que el esquema ya está aplicado y limitarse a servir tráfico. Para desarrollo local, mantener `migrate dev` solo en el perfil o compose de desarrollo. |
| 2   | **Runtime de desarrollo para la API mediante `tsx watch`.** Tanto el `command` del compose como el `CMD` por defecto del Dockerfile ejecutan la API interpretando TypeScript en caliente con recarga automática. En desarrollo local esto acelera el feedback al modificar código montado por bind mount. Un contenedor productivo, en cambio, debería ejecutar artefactos ya compilados y validados en el build: no interpretar TypeScript en runtime, no mantener watchers activos ni depender de herramientas como `tsx` en la imagen final. Eso reduce consumo de CPU/memoria, elimina variabilidad entre entornos y evita incluir dependencias de desarrollo en el proceso principal.                                                                                                                                                                                                                                                                                             | `docker-compose.yml` línea 38; `packages/api/Dockerfile` línea 22                                     | **Alto**       | Adoptar un **multi-stage build**: etapa `builder` que compila TypeScript (`tsc` o equivalente) y resuelve dependencias; etapa final que copia únicamente el JavaScript resultante (`dist/`) junto con las `dependencies` de producción y ejecuta la aplicación con `node`. Reservar `tsx watch` exclusivamente para el entorno de desarrollo local.                                                          |
| 3   | **Frontend servido mediante Vite dev server.** El servicio `web` y su Dockerfile arrancan `npm run dev`, es decir, el servidor de desarrollo de Vite con `--host 0.0.0.0`. Vite en modo dev está optimizado para hot module replacement, transformación bajo demanda y diagnóstico — no para servir tráfico productivo con eficiencia, caching agresivo ni hardening. En desarrollo local, exponer el puerto 5173 con el dev server es la forma natural de trabajar con React. En producción, el frontend debe ser un conjunto de archivos estáticos generados en el build y servidos por un servidor web dedicado.                                                                                                                                                                                                                                                                                                                                                                    | `docker-compose.yml` línea 58; `packages/web/Dockerfile` línea 16                                     | **Alto**       | En el pipeline de build ejecutar `npm run build` para generar `dist/`. Servir ese directorio con **nginx** (u otro servidor estático): compresión gzip/brotli, headers de caché para assets con hash, headers de seguridad (`Content-Security-Policy`, `X-Frame-Options`, etc.) y, en el despliegue final, TLS terminado en un reverse proxy. Mantener `npm run dev` solo en desarrollo.                     |
| 4   | **Instalación no reproducible de dependencias con `npm install`.** Ambos Dockerfiles instalan paquetes con `npm install` pese a existir un `package-lock.json` en la raíz del monorepo. Para desarrollo local, `npm install` puede ser tolerable cuando se actualizan dependencias con frecuencia.En builds automatizados, npm ci resulta más estricto y reproducible que npm install: nstala exactamente el árbol definido por el lockfile, falla si existe una inconsistencia entre package.json y package-lock.json y evita modificar el archivo de bloqueo durante el build.                                                                                                                                                                                                                                                                                                                                                                                                       | `packages/api/Dockerfile` línea 12; `packages/web/Dockerfile` línea 8; `package-lock.json` en la raíz | **Medio**      | Reemplazar `npm install` por `npm ci` durante la etapa de build, respetando el lockfile versionado. En la imagen de runtime, usar `npm ci --omit=dev` (o copiar solo `node_modules` de producción desde la etapa builder) para excluir herramientas de desarrollo (`vite`, `tsx`, `vitest`, etc.) de la capa final.                                                                                          |
| 5   | `**.dockerignore` insuficiente combinado con `COPY . .`.** Existe un `.dockerignore` en la raíz del monorepo y **sí se aplica** correctamente porque el `build.context` de ambos servicios es `.`. Sin embargo, el archivo solo excluye `node_modules`, `dist`, `.git` y `*.log`. Tras instalar dependencias, ambos Dockerfiles ejecutan COPY . ., copiando dentro de la imagen todo archivo del contexto de build que no haya sido excluido; documentación, tests, reportes de cobertura, configuraciones locales y archivos `.env` / `.env.`* que podrían residir bajo `packages/`. No se verificó que un secreto haya quedado efectivamente embebido en una imagen ya construida; el riesgo es de **inclusión accidental** en builds futuros, contexto de build inflado e invalidación innecesaria de capas. En desarrollo local, el bind mount ya expone el workspace completo al contenedor; en producción, la imagen debería contener únicamente lo indispensable para ejecutar. | `.dockerignore` líneas 1-4; `packages/api/Dockerfile` línea 17; `packages/web/Dockerfile` línea 11    | **Medio-Alto** | Ampliar `.dockerignore` con exclusiones explícitas: `.env`, `.env.`*, `docs/`, `test/`, `coverage/`, `playwright-report*`, `*.md`, artefactos de CI y otros paths no requeridos en runtime. Complementar con `COPY` selectivo de directorios necesarios (`packages/api/src`, esquema Prisma, etc.) en lugar de copiar el monorepo completo.                                                                  |


---

## 1.2 Investigación sobre OpenTelemetry

### ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?

**OpenTelemetry (OTel)** es un estándar abierto de observabilidad que provee APIs, SDKs e instrumentación para **generar, recolectar y exportar** telemetría — métricas, trazas y logs — desde aplicaciones y servicios de infraestructura. OTel no persiste ni visualiza datos por sí mismo: actúa como capa de instrumentación y transporte agnóstica al backend.

**Prometheus**, en cambio, es un sistema de **monitoreo y almacenamiento de series temporales** orientado a métricas. Recolecta datos mediante scraping periódico, los guarda en su base de datos interna y permite consultarlos con PromQL. Es un destino concreto para métricas, no un framework general de instrumentación.

En síntesis: OpenTelemetry **produce y envía** señales de observabilidad; Prometheus **almacena y consulta** métricas. Son complementarios, no equivalentes.

### ¿Cuáles son los tres pilares de la observabilidad? ¿Cuál aborda OpenTelemetry?

Los tres pilares clásicos de la observabilidad son:

1. **Métricas** — Valores numéricos agregados en el tiempo (requests por segundo, uso de memoria, latencia promedio). Permiten detectar tendencias y disparar alertas.
2. **Trazas** — Registro del recorrido de una solicitud a través de componentes distribuidos (API → Prisma → PostgreSQL). Facilitan el diagnóstico de cuellos de botella en flujos complejos.
3. **Logs** — Eventos discretos con timestamp y contexto (errores de validación, fallos de conexión, excepciones no capturadas). Aportan detalle legible para investigación post-mortem.

**OpenTelemetry aborda los tres pilares** bajo un mismo modelo de instrumentación. En lugar de integrar agentes separados para cada tipo de señal, un SDK de OTel puede emitir métricas, trazas y logs correlacionados, reduciendo fragmentación operativa.

### ¿Qué son las métricas RED? ¿Para qué sirve cada una?

El método **RED** propone monitorear servicios orientados a requests HTTP mediante tres dimensiones:

- **Rate (tasa)** — Cantidad de requests por segundo que recibe el servicio. En Alentapp, permitiría observar picos de consultas a endpoints como `/api/v1/members` o caídas abruptas de tráfico que sugieran un problema de enrutamiento.
- **Errors (errores)** — Proporción de requests que terminan en error (HTTP 4xx/5xx). Sirve para medir disponibilidad percibida: un aumento de 500 tras un cambio de esquema Prisma sería una señal temprana de regresión.
- **Duration (duración)** — Tiempo de respuesta, habitualmente en percentiles (p95, p99). Permite evaluar si la API sigue respondiendo dentro de umbrales aceptables aun cuando la tasa de errores sea baja.

RED resume la salud de un servicio request-driven con pocas métricas de alto valor operativo.

### ¿Qué es OTLP? ¿Qué ventaja tiene frente a exportar directamente a Prometheus?

**OTLP (OpenTelemetry Protocol)** es el protocolo nativo de OpenTelemetry para transmitir telemetría entre aplicaciones, agentes y backends. Soporta transporte por **gRPC** o **HTTP** con payloads Protobuf, unificando métricas, trazas y logs en un mismo canal.

Exportar directamente al formato de Prometheus acopla la aplicación a un backend específico y limita el envío a métricas. Con OTLP, la aplicación envía telemetría a un **OpenTelemetry Collector**, que puede reenviarla en paralelo a Prometheus, Jaeger, Loki, Datadog u otros destinos **sin modificar el código de la aplicación**. Ese desacoplamiento simplifica migraciones de stack de observabilidad y permite enriquecer o filtrar señales en un punto centralizado.

### ¿Cómo se relaciona OpenTelemetry con Grafana?

El flujo práctico de observabilidad para una API como la de Alentapp puede representarse así:

```text
API instrumentada con OpenTelemetry
→ endpoint o collector
→ Prometheus
→ datasource de Grafana
→ dashboard RED
```

OpenTelemetry instrumenta el código de Fastify y exporta métricas (y eventualmente trazas). Esas señales llegan a **Prometheus**, que actúa como almacén de series temporales. **Grafana** se conecta a Prometheus como *data source*, ejecuta consultas PromQL y construye dashboards — por ejemplo, paneles RED con tasa de requests, ratio de errores y latencia p95 por endpoint.

En la integración práctica de esta actividad, la API utiliza un `**PrometheusExporter`** que expone un endpoint `**/metrics**` en un puerto dedicado (por ejemplo, 9464), desde donde Prometheus realiza scraping. Aunque OTLP sea el camino preferido a largo plazo por su flexibilidad, el exportador directo a Prometheus es un paso intermedio válido para instrumentar rápidamente y alimentar un dashboard RED en Grafana.

---

## Resumen

La infraestructura Docker de Alentapp que hay hoy cumple un rol claro de **entorno de desarrollo local mas que nada**: bind mounts, polling de archivos, servidores con hot reload y migraciones Prisma interactivas son decisiones coherentes con esa finalidad. Los cinco problemas documentados surgen al evaluar qué ocurriría si ese mismo stack se desplegara sin cambios en producción.

Los tres hallazgos de **impacto alto** (migraciones con `migrate dev`, API con `tsx watch` y frontend con Vite dev server) comparten un patrón: **el contenedor productivo no debería ejecutar herramientas ni flujos de desarrollo**. El impacto **medio** de `npm install` versus `npm ci` afecta la reproducibilidad y auditabilidad de los builds. El impacto **medio-alto** del `.dockerignore` limitado, combinado con `COPY . .`, expone riesgo de arrastrar archivos innecesarios o sensibles hacia la imagen.

Abordar estos puntos — sin eliminar las comodidades del entorno dev, sino separándolas explícitamente de un perfil productivo — es un paso necesario probablemente antes de considerar el despliegue en un ambiente accesible y sometido a carga real.