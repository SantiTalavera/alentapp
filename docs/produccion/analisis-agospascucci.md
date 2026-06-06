# Análisis de Infraestructura Docker y OpenTelemetry — Alentapp

## Fase 1: Preparación para Producción

**Autor:** Agostina Pascucci  
**Fecha:** 06/06/2026  
**Scope:** Revisión de configuración Docker orientada a buenas prácticas de producción e Investigación sobre OpenTelemetry

---

## Descripción General

Se analizaron los tres archivos que componen la infraestructura de contenedores del monorepo **Alentapp**:

- `docker-compose.yml` — Orquestación de servicios
- `packages/api/Dockerfile` — Imagen del servidor Fastify (Node.js)
- `packages/web/Dockerfile` — Imagen del cliente React/Vite

El análisis identifica **5 problemas críticos** en relación a las buenas prácticas de producción, organizados por impacto.

---

## 1.1 Analisis de Infraestructura Docker Actual

### Problemas Identificados

| # | Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
|---|----------|----------------|---------|-------------------|
| 1 | **Credenciales de base de datos expuestas en texto plano.** Las variables `POSTGRES_USER`, `POSTGRES_PASSWORD` y `DATABASE_URL` están hardcodeadas con valores triviales (`password123`) directamente en el archivo de composición, que suele estar bajo control de versiones. Cualquier persona con acceso al repositorio puede leer las credenciales y acceder a la base de datos. | `docker-compose.yml` líneas 6-8 y 30 | **Alto** | Reemplazar los valores por referencias a variables de entorno del host (`${POSTGRES_PASSWORD}`) y gestionar los secretos mediante un archivo `.env` excluido del repositorio con `.gitignore`, o utilizar Docker Secrets / un gestor de secretos como Vault en producción. |
| 2 | **Los contenedores ejecutan procesos como usuario `root`.** Ninguno de los dos `Dockerfile` define una instrucción `USER`, lo que significa que el proceso Node.js se ejecuta con privilegios de superusuario dentro del contenedor. Si una vulnerabilidad en la aplicación o en una dependencia permite la ejecución de código arbitrario, el atacante obtiene control total sobre el sistema de archivos del contenedor y potencialmente del host. | `packages/api/Dockerfile` (ausente entre líneas 1-23) y `packages/web/Dockerfile` (ausente entre líneas 1-16) | **Alto** | Crear un usuario sin privilegios antes de ejecutar la aplicación. La imagen `node:20-alpine` ya incluye el usuario `node`. Basta con agregar antes del `CMD`: `RUN chown -R node:node /app` y `USER node`. |
| 3 | **Ausencia de build multi-stage: imágenes sobredimensionadas que incluyen herramientas de desarrollo.** Ambos `Dockerfile` utilizan una única etapa de construcción basada en `node:20-alpine`. En producción, la imagen resultante contiene el código fuente completo, las `devDependencies` (tsx, vite, eslint, etc.) y las herramientas de compilación, lo que incrementa innecesariamente el tamaño de la imagen, amplía la superficie de ataque y aumenta los tiempos de descarga y despliegue. | `packages/api/Dockerfile` línea 1 y `packages/web/Dockerfile` línea 1 | **Alto** | Adoptar un patrón **multi-stage build**: una etapa `builder` instala dependencias y compila el proyecto (`tsc` / `vite build`), y una etapa final copia únicamente los artefactos compilados (`dist/`) junto con las `dependencies` de producción (`npm ci --omit=dev`). Para el frontend, la etapa final puede usar `nginx:alpine` para servir el bundle estático. |
| 4 | **El volumen bind-mount `- .:/app` monta el código fuente del host en producción.** Tanto el servicio `api` como el servicio `web` montan el directorio raíz del proyecto (`.`) dentro del contenedor en `/app`. Este patrón es propio del entorno de desarrollo (hot-reload), pero en producción rompe la inmutabilidad de la imagen, introduce riesgos de inconsistencia entre entornos y expone todos los archivos del directorio de trabajo —incluidos `.env`, claves y configuraciones locales— al contenedor. | `docker-compose.yml` líneas 25 y 52 | **Alto** | Eliminar los bind-mounts en el perfil de producción. El código debe estar embebido en la imagen en el momento del `docker build`. Separar la configuración en dos archivos: `docker-compose.yml` (base, sin volúmenes de desarrollo) y `docker-compose.override.yml` (agrega los bind-mounts solo para desarrollo local). |
| 5 | **Ausencia de límites de recursos (CPU y memoria) en todos los servicios.** Ningún servicio del `docker-compose.yml` define sección `deploy.resources.limits`. En producción, un pico de tráfico o una fuga de memoria puede hacer que un contenedor consuma todos los recursos del host, provocando la caída del sistema operativo o del resto de los servicios. | `docker-compose.yml` — sección `services` completa (líneas 1-64, ausente en los tres servicios) | **Medio** | Agregar límites de memoria y CPU bajo la clave `deploy.resources` de cada servicio. Ejemplo para `api`: `deploy: resources: limits: cpus: '0.5' memory: 512M`. Para entornos con un solo nodo Docker (sin Swarm), se puede usar la clave de nivel superior `mem_limit` y `cpus` para mayor compatibilidad con `docker compose` v2. |

---

## 1.2. Investigación sobre OpenTelemetry

**1. ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?**
OpenTelemetry (OTel) es un *framework* de observabilidad agnóstico (compuesto por APIs, SDKs y herramientas) diseñado para generar, recolectar y exportar datos telemétricos (métricas, logs y trazas) de manera estandarizada.
La principal diferencia radica en su propósito: **OpenTelemetry es el "mensajero"**, se encarga de instrumentar el código y transportar los datos, pero no los almacena ni los visualiza. Por otro lado, **Prometheus es un motor de almacenamiento y consulta** (una base de datos de series temporales con su propio lenguaje, PromQL), que actúa como el "destino" donde OpenTelemetry envía las métricas para que sean persistidas y analizadas.

**2. ¿Cuáles son los "3 pilares" de la observabilidad? ¿Cuál de ellos aborda OpenTelemetry?**
Los tres pilares fundamentales de la observabilidad de sistemas son:

* **Métricas:** Agregaciones numéricas de datos sobre un período de tiempo (ej. uso de CPU, cantidad de requests).
* **Trazas (Traces):** El recorrido detallado de una petición a través de múltiples microservicios.
* **Logs:** Registros inmutables y con marca de tiempo de eventos discretos que ocurrieron en el sistema.
**OpenTelemetry aborda los tres pilares**. Su gran ventaja es que unifica la recolección de métricas, trazas y logs bajo un mismo estándar, eliminando la necesidad de instalar múltiples agentes distintos en la aplicación.

**3. Explica el concepto de métricas RED (Rate, Errors, Duration). ¿Para qué sirve cada una de ellas en un entorno productivo?**
El método RED es un patrón arquitectónico enfocado en medir la experiencia del usuario y el estado de los servicios (especialmente en microservicios y APIs HTTP):

* **Rate (Tasa):** Mide la cantidad de solicitudes por segundo (throughput). *Sirve para* entender la carga de tráfico actual que está soportando el servicio y planificar escalabilidad.
* **Errors (Errores):** Mide la cantidad o el porcentaje de peticiones que fallan (ej. códigos HTTP 5xx). *Sirve para* monitorear la disponibilidad y confiabilidad del sistema, siendo el principal disparador de alertas críticas.
* **Duration (Duración):** Mide el tiempo que tarda el servicio en responder a una petición (latencia, usualmente evaluada en percentiles p95 o p99). *Sirve para* evaluar el rendimiento y garantizar que el sistema no solo funcione, sino que sea rápido y brinde una buena experiencia.

**4. ¿Qué es el OTLP (OpenTelemetry Protocol)? ¿Qué ventaja tiene frente a exportar métricas directamente a Prometheus?**
OTLP es el protocolo de red nativo de OpenTelemetry, diseñado específicamente para codificar y transmitir métricas, trazas y logs de manera eficiente mediante gRPC o HTTP/JSON.
**Ventajas frente a la exportación directa a Prometheus:**

* **Desacoplamiento (Vendor-agnostic):** Si exportas en formato Prometheus, tu código queda acoplado a esa herramienta. Con OTLP, envías los datos a un *OpenTelemetry Collector*, el cual puede traducir y enviar esos mismos datos a Prometheus, Datadog, New Relic o Jaeger de forma simultánea, sin tocar una sola línea del código de la aplicación.
* **Unificación:** El exportador de Prometheus solo maneja métricas. OTLP permite enviar métricas, logs y trazas a través del mismo canal y protocolo.

**5. ¿Cómo se relaciona OpenTelemetry con Grafana?**
Funcionan como un ecosistema complementario: **OpenTelemetry produce los datos y Grafana los visualiza**.
OpenTelemetry instrumenta la aplicación de Node.js/Fastify y exporta la telemetría a un backend de almacenamiento (como Prometheus para las métricas o Tempo para las trazas). Grafana se conecta a estos backends como "Data Sources" para consultar los datos (usando PromQL, por ejemplo) y construir los *dashboards* interactivos. Además, el ecosistema de Grafana (a través de Grafana Alloy/Agent) tiene soporte nativo para recibir datos directamente en protocolo OTLP, logrando una integración fluida y estandarizada.

---

## Resumen

Los problemas detectados se concentran en tres ejes principales:

1. **Seguridad** — Exposición de credenciales y ejecución como root (problemas 1 y 2) representan los riesgos más inmediatos y deben resolverse antes de cualquier despliegue en un entorno accesible desde Internet.
2. **Arquitectura de imagen** — La ausencia de builds multi-stage (problema 3) y el uso de bind-mounts (problema 4) son antipatrones de desarrollo que no deben trasladarse a producción; impactan en el tamaño, la seguridad y la reproducibilidad del despliegue.
3. **Resiliencia operativa** — La falta de límites de recursos (problema 5) puede comprometer la estabilidad del host completo ante cargas inesperadas.

Resolver estos cinco puntos es el prerequisito mínimo para considerar la infraestructura apta para un ambiente productivo.
