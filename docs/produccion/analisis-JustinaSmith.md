# Análisis de Infraestructura Docker y Opentelemetry - Alentapp

## Fase 1: Preparación para Producción

**Autor:** Justina Smith
**Fecha:** 06/06/2026
**Scope:** Revisión de configuración Docker orientada a buenas prácticas de producción e investigación sobre OpenTelemetry

---

## Descripción General

Se analizaron los tres archivos que componen la infraestructura de contenedores del monorepo **Alentapp**:
- `docker-compose.yml` — Orquestación de servicios
- `packages/api/Dockerfile` — Imagen del servidor de API (Node.js)
- `packages/web/Dockerfile` — Imagen del cliente Frontend (React/Vite)

El análisis identifica **5 problemas críticos** en relación a las buenas prácticas de producción.

---

## 1.1 Análisis de Infraestructura Docker Actual

### Problemas Identificados

| # | Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
| :--- | :--- | :--- | :---: | :--- |
| 1 | **Credenciales de base de datos expuestas en texto plano.** | `docker-compose.yml` (Líneas 5-8 y 30) | **Alto** | Reemplazar los valores de variables como `POSTGRES_USER`, `POSTGRES_PASSWORD` y `DATABASE_URL` por referencias dinámicas a variables de entorno de host (`${POSTGRES_PASSWORD}`) y gestionar los secretos mediante un archivo `.env` excluido del repositorio en `.gitignore`. |
| 2 | **Los contenedores ejecutan procesos como usuario `root`.** | `packages/api/Dockerfile` (Líneas 1-23) y `packages/web/Dockerfile` (Líneas 1-16) | **Alto** | Ninguno de los Dockerfile define un usuario sin privilegios. Se debe añadir la instrucción `USER node` en las etapas de ejecución para evitar riesgos de escalada de privilegios si el contenedor es comprometido. |
| 3 | **Ausencia de Multi-stage Builds y uso de servidor de desarrollo en producción.** | `packages/web/Dockerfile` (Líneas 1-16) y `packages/api/Dockerfile` (Líneas 1-23) | **Alto** | Implementar *Multi-stage builds*. Para el frontend, compilar los recursos estáticos (`npm run build`) y servirlos a través de un servidor ligero como Nginx (`nginx:alpine`). Para la API, separar la etapa de construcción para compilar TypeScript y ejecutar la imagen final únicamente con dependencias de producción (`npm prune --production`). |
| 4 | **Falta de límites en el uso de recursos del sistema.** | `docker-compose.yml` (Para todos los servicios: `db`, `api` y `web`) | **Medio** | No se configuran límites de CPU o memoria en los contenedores. Se deben establecer restricciones explícitas mediante `deploy.resources.limits.memory` y `deploy.resources.limits.cpus` en Docker Compose para evitar saturación de memoria del host. |
| 5 | **Uso ineficiente de la caché de capas en la construcción de imágenes.** | `packages/web/Dockerfile` (Líneas 5-11) y `packages/api/Dockerfile` (Líneas 5-17) | **Medio** | Se copia el código fuente completo con `COPY . .` antes de compilar y sin separar adecuadamente la copia de archivos de dependencias de los workspaces. Esto invalida la caché de `npm install` ante cualquier cambio en el código fuente. Se debe copiar primero solo los archivos `package.json` esenciales, instalar dependencias y luego copiar el resto del código. |

---

## 1.2 Investigación sobre OpenTelemetry

### ¿Qué es OpenTelemetry y en qué se diferencia de Prometheus?
* **OpenTelemetry (OTel):** Es un estándar de la CNCF que provee un conjunto unificado de APIs, SDKs y herramientas (como el OTel Collector) diseñado para instrumentar, recopilar y exportar datos de telemetría de forma agnóstica respecto del backend de almacenamiento. No incluye almacenamiento ni visualización.
* **Prometheus:** Es una base de datos de series temporales (TSDB) con un motor de consultas (PromQL) y de alertas, enfocada exclusivamente en métricas recopiladas mediante un modelo de recolección de tipo *pull*.
* **Diferencias:** OTel es un framework unificado para la generación y envío de múltiples señales (trazas, métricas, logs) mediante *push*, mientras que Prometheus es un backend específico para el almacenamiento y consulta de métricas recolectadas por *pull*.

### ¿Cuáles son los "3 pilares" de la observabilidad y cuál aborda específicamente OpenTelemetry?
Los tres pilares de la observabilidad son:
1. **Métricas (Metrics):** Valores numéricos acumulados útiles para medir la salud general y rendimiento del sistema.
2. **Trazas (Traces):** El recorrido de una solicitud individual a través de la infraestructura y servicios distribuidos.
3. **Registros (Logs):** Eventos discretos e históricos legibles con contexto detallado de ejecución.

* **Abordaje de OpenTelemetry:** OpenTelemetry aborda **los tres pilares** de forma integrada, permitiendo correlacionar métricas, trazas y logs bajo un contexto unificado.

### Explicación de las métricas RED (Rate, Errors, Duration) y su utilidad práctica
Propuesto por Tom Wilkie, el método RED monitorea servicios orientados a peticiones:
* **Rate (Tasa):** Número de solicitudes por segundo.
* **Errors (Errores):** Cantidad de solicitudes fallidas por segundo.
* **Duration (Duración):** Tiempo de procesamiento de las solicitudes (medido en percentiles).

* **Utilidad práctica:** Ofrece una visión directa de la salud percibida por el usuario y el rendimiento de la API, ideal para establecer indicadores de nivel de servicio (SLIs/SLOs) y simplificar alertas en arquitecturas de microservicios.

### ¿Qué es el protocolo OTLP y qué ventajas ofrece frente a exportar directamente a Prometheus?
El protocolo **OTLP (OpenTelemetry Protocol)** es el formato nativo binario de OTel para el transporte de telemetría por gRPC o HTTP.
* **Ventajas:**
  * **Eficiencia:** Usa serialización compacta (Protobuf) de alto rendimiento frente a formatos planos.
  * **Unificación:** Transmite trazas, métricas y logs sobre el mismo canal de red.
  * **Desacoplamiento:** La aplicación envía telemetría a un colector centralizado y este se encarga de rutearla, lo que permite cambiar el backend de almacenamiento final (Prometheus, Grafana Cloud, Datadog) sin re-instrumentar el código.

### ¿Cómo se establece la relación técnica entre OpenTelemetry y Grafana?
La arquitectura sigue estas etapas técnicas:
1. **Instrumentación:** Los SDKs de OTel recopilan telemetría en la aplicación.
2. **Colector (OTel Collector):** Recibe datos vía OTLP y los exporta a los backends de almacenamiento correspondientes.
3. **Backends de Grafana:** Las métricas van a **Grafana Mimir** (o Prometheus), las trazas a **Grafana Tempo**, y los logs a **Grafana Loki**.
4. **Visualización:** Grafana actúa como la interfaz unificada de usuario conectándose a estos orígenes de datos, facilitando la correlación de trazas, métricas y logs mediante referencias cruzadas (como `trace_id`).
