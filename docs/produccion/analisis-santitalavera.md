# Análisis individual de infraestructura Docker - santi-talavera

Este análisis se realiza sobre la infraestructura Docker actual del proyecto AlentApp, considerando los archivos `docker-compose.yml`, `packages/api/Dockerfile`, `packages/web/Dockerfile` y `.dockerignore`.

Para no repetir los hallazgos ya documentados por otros integrantes, este informe evita volver sobre los puntos ya cubiertos: credenciales hardcodeadas, ejecución como root, ausencia de multi-stage builds, falta de límites de CPU/memoria, `HEALTHCHECK`, logging, redes, `read_only`, exposición directa de puertos, `restart policy`, uso de `prisma migrate dev`, uso de `tsx watch`, Vite dev server, `npm install` frente a `npm ci` y debilidades generales del `.dockerignore`.

## Problemas y mejoras identificadas

### 1. Imágenes base sin pinning por digest

**Ubicación:** `packages/api/Dockerfile`, `packages/web/Dockerfile`, `docker-compose.yml`

Actualmente las imágenes base se referencian mediante tags mutables:

```dockerfile
FROM node:20-alpine
```

```yaml
image: postgres:16-alpine
```

El problema es que esos tags pueden cambiar con el tiempo aunque el archivo del repositorio no cambie. Dos builds realizados en fechas distintas podrían tomar capas diferentes de Node o PostgreSQL, incorporando cambios de sistema operativo, librerías nativas o parches que no fueron revisados explícitamente por el equipo.

**Impacto:**

- Builds menos reproducibles.
- Dificultad para investigar incidentes, porque la imagen real usada puede no ser exactamente la misma.
- Riesgo de incorporar vulnerabilidades o cambios incompatibles sin pasar por revisión.
- Menor trazabilidad entre código fuente, imagen generada y despliegue.

**Propuesta de solución:**

Usar tags más específicos y, para producción, fijar las imágenes por digest:

```dockerfile
FROM node:20.19.0-alpine3.21@sha256:<digest>
```

```yaml
image: postgres:16.8-alpine3.21@sha256:<digest>
```

Además, conviene acompañarlo con una política de actualización controlada: revisar periódicamente nuevas versiones de Node/PostgreSQL, ejecutar tests, escaneo de vulnerabilidades y recién después actualizar los digests en un PR.

---

### 2. Nombres fijos de contenedores que dificultan escalar o levantar entornos paralelos

**Ubicación:** `docker-compose.yml`

El `docker-compose.yml` define nombres fijos para los contenedores:

```yaml
container_name: alentapp-db
container_name: alentapp-api
container_name: alentapp-web
```

Esto parece cómodo para desarrollo local, pero introduce una limitación operativa: Docker Compose ya genera nombres automáticamente a partir del proyecto, el servicio y la réplica. Al forzar `container_name`, se pierde esa flexibilidad.

**Impacto:**

- No se pueden levantar dos instancias del stack en paralelo en la misma máquina sin conflicto de nombres.
- Dificulta usar `docker compose -p <proyecto>` para entornos aislados.
- Impide escalar servicios con varias réplicas, porque cada réplica necesitaría un nombre único.
- Puede generar choques entre entornos de desarrollo, testing, CI o demos locales.

**Propuesta de solución:**

Eliminar `container_name` y dejar que Compose administre los nombres:

```yaml
services:
  db:
    image: postgres:16-alpine
  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
```

Si se necesita identificar el proyecto, se puede usar el nombre de proyecto de Compose:

```bash
docker compose -p alentapp-dev up
docker compose -p alentapp-test up
```

De esa forma se conserva trazabilidad sin bloquear escenarios paralelos.

---

### 3. Variables de file watching propias de desarrollo filtradas al entorno contenedorizado

**Ubicación:** `docker-compose.yml`

Los servicios `api` y `web` declaran variables orientadas al hot reload:

```yaml
CHOKIDAR_USEPOLLING: "true"
WATCHPACK_POLLING: "true"
```

Estas variables fuerzan mecanismos de polling para detectar cambios de archivos dentro del contenedor. Tiene sentido en desarrollo, especialmente en Windows o con volúmenes montados, pero no debería formar parte de una configuración productiva o de un compose base reutilizable para otros entornos.

**Impacto:**

- Mayor consumo de CPU por polling constante.
- Mayor ruido operativo y menor eficiencia en contenedores.
- Riesgo de que una configuración pensada para desarrollo termine siendo reutilizada como si fuera productiva.
- Dificulta separar claramente los perfiles de ejecución: desarrollo, testing, staging y producción.

**Propuesta de solución:**

Mantener estas variables únicamente en el `docker-compose.yml` actual, tratándolo explícitamente como compose de desarrollo, y no trasladarlas al nuevo `docker-compose.prod.yml` pedido por la consigna.

La separación quedaría así:

- `docker-compose.yml`: entorno de desarrollo local, con hot reload, volúmenes montados y variables de polling.
- `docker-compose.prod.yml`: entorno productivo, sin hot reload, sin polling y ejecutando imágenes ya construidas para producción.

Ejemplo conceptual para producción:

```yaml
# docker-compose.prod.yml
services:
  api:
    environment:
      NODE_ENV: production

  web:
    environment:
      NODE_ENV: production
```

En este compose productivo no deberían aparecer:

```yaml
CHOKIDAR_USEPOLLING: "true"
WATCHPACK_POLLING: "true"
```

Así se respeta la estrategia del trabajo práctico: el compose actual queda como herramienta de desarrollo, mientras que la configuración productiva se documenta y se implementa en un archivo separado.

---

### 4. Manejo débil del ciclo de vida del proceso principal de la API

**Ubicación:** `docker-compose.yml`

El servicio `api` inicia con una cadena ejecutada mediante shell:

```yaml
command: sh -c "npx prisma migrate dev --name init --config packages/api/prisma.config.ts && npx prisma generate --config packages/api/prisma.config.ts && npx tsx watch packages/api/src/app.ts"
```

El problema principal, más allá de qué comandos concretos se ejecutan, es que el proceso principal del contenedor queda envuelto por `sh -c` y encadena varias responsabilidades antes de iniciar la aplicación. En contenedores, el proceso PID 1 tiene un rol importante: recibe señales de parada, debe propagar correctamente `SIGTERM` y debe permitir apagados limpios.

**Impacto:**

- Riesgo de apagados no controlados si la señal no llega correctamente al proceso Node.
- Posibles conexiones abiertas o requests interrumpidas de forma brusca.
- Mayor dificultad para distinguir fallas de inicialización, generación, migración o runtime.
- Menor claridad para instrumentar logs y métricas del proceso real de la API.

**Propuesta de solución:**

Separar responsabilidades y hacer que el contenedor ejecute un único proceso principal. Para producción, la imagen debería iniciar directamente la aplicación compilada:

```yaml
command: ["node", "packages/api/dist/app.js"]
```

También puede agregarse un init mínimo para mejorar el manejo de señales y procesos hijos:

```yaml
services:
  api:
    init: true
    stop_grace_period: 30s
```

Las tareas previas, como generación de cliente o migraciones, deberían ejecutarse en build, CI/CD o jobs separados según corresponda. De esa forma el contenedor de la API queda dedicado a correr la API y responder correctamente al ciclo de vida del orquestador.

---

### 5. Persistencia de PostgreSQL sin estrategia de backup, restauración ni retención

**Ubicación:** `docker-compose.yml`

La base de datos usa un volumen nombrado:

```yaml
volumes:
  - pgdata:/var/lib/postgresql/data
```

Esto permite conservar datos entre reinicios locales, pero no define ninguna política de respaldo, restauración, retención ni prueba de recuperación. En producción, persistir no es lo mismo que proteger los datos.

**Impacto:**

- Pérdida de datos ante eliminación accidental del volumen.
- Dificultad para recuperar el sistema ante corrupción, error humano o incidente.
- No hay evidencia de que el equipo pueda restaurar una copia en un entorno limpio.
- Riesgo operativo alto si el proyecto maneja certificados, usuarios, consultas médicas u otra información sensible.

**Propuesta de solución:**

Definir una estrategia explícita de backup y restore para PostgreSQL. Algunas opciones:

- Backups programados con `pg_dump` o herramientas específicas del proveedor de infraestructura.
- Retención definida por ambiente.
- Cifrado de backups si contienen información sensible.
- Procedimiento documentado de restauración.
- Pruebas periódicas de restore en un entorno aislado.

En Compose podría agregarse un servicio o job auxiliar para backups en ambientes controlados, pero para producción lo ideal es delegarlo a la plataforma de base de datos administrada o al pipeline de operaciones.

Ejemplo conceptual:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
```

El punto central es que el repositorio no debería limitarse a declarar un volumen: también debe quedar claro cómo se resguardan y recuperan los datos.

---

## Investigación sobre OpenTelemetry

### ¿Qué es OpenTelemetry?

OpenTelemetry es un estándar abierto para instrumentar aplicaciones y recolectar datos de observabilidad. Permite generar, capturar y exportar telemetría desde los servicios de un sistema distribuido.

Su objetivo no es reemplazar una herramienta de visualización, sino estandarizar cómo las aplicaciones producen datos observables. Con OpenTelemetry, una aplicación puede emitir trazas, métricas y logs usando APIs y SDKs comunes, y luego enviar esos datos a diferentes backends.

### Diferencia entre OpenTelemetry y Prometheus

Prometheus es principalmente una herramienta de métricas: recolecta series temporales, las almacena y permite consultarlas con PromQL. Su modelo clásico consiste en hacer scraping de endpoints HTTP que exponen métricas.

OpenTelemetry, en cambio, es un estándar e instrumental de observabilidad. Define APIs, SDKs, protocolos y un collector para recibir y exportar telemetría. Puede trabajar junto con Prometheus: por ejemplo, una aplicación instrumentada con OpenTelemetry puede enviar métricas al OpenTelemetry Collector y luego exponerlas o reenviarlas a Prometheus.

En síntesis:

- Prometheus: backend y sistema de consulta orientado a métricas.
- OpenTelemetry: estándar de instrumentación y transporte de telemetría.

### Tres pilares de observabilidad

Los tres pilares clásicos de observabilidad son:

1. **Métricas:** valores numéricos agregados en el tiempo, como latencia, cantidad de requests, uso de CPU o memoria.
2. **Logs:** eventos discretos generados por una aplicación, útiles para entender qué ocurrió en un momento determinado.
3. **Trazas:** recorrido completo de una solicitud a través de varios servicios, útil para sistemas distribuidos.

OpenTelemetry aborda los tres pilares:

- Tiene soporte maduro para trazas.
- Tiene soporte para métricas.
- También contempla logs, aunque históricamente su adopción fue más progresiva que trazas y métricas.

### Métricas RED

Las métricas RED son un enfoque para monitorear servicios orientados a requests. RED significa:

- **Rate:** cantidad de requests por segundo.
- **Errors:** cantidad o proporción de requests fallidas.
- **Duration:** duración o latencia de las requests.

Estas métricas son útiles porque permiten entender rápidamente la salud de una API. En AlentApp, por ejemplo, podrían medirse para endpoints de autenticación, gestión de usuarios, certificados médicos o consultas.

Ejemplo de aplicación:

- Rate: cuántas requests por minuto recibe `POST /auth/login`.
- Errors: cuántas devuelven `401`, `500` u otros códigos de error.
- Duration: cuánto tarda en responder el endpoint.

### ¿Qué es OTLP?

OTLP significa OpenTelemetry Protocol. Es el protocolo estándar que usa OpenTelemetry para transportar telemetría entre aplicaciones, collectors y backends.

Puede funcionar sobre gRPC o HTTP y permite enviar trazas, métricas y logs con un formato común.

### Ventajas de OTLP frente a exportar directo a Prometheus

Exportar directamente a Prometheus puede servir para un caso simple de métricas, pero acopla la aplicación a un backend concreto y deja menos margen para evolucionar la arquitectura de observabilidad.

Usar OTLP tiene varias ventajas:

- Permite enviar distintos tipos de telemetría, no solo métricas.
- Desacopla la aplicación del backend final.
- Permite usar un OpenTelemetry Collector como punto intermedio.
- Facilita transformar, filtrar, enriquecer o redirigir datos sin cambiar el código de la aplicación.
- Permite enviar la misma telemetría a múltiples destinos, como Prometheus, Grafana Tempo, Loki u otros servicios.

Para un proyecto que puede crecer, OTLP da más flexibilidad que instrumentar pensando únicamente en Prometheus.

### Relación entre OpenTelemetry y Grafana

Grafana es una plataforma de visualización y análisis. Permite construir dashboards, explorar métricas, logs y trazas, y configurar alertas.

OpenTelemetry puede generar y transportar la telemetría que luego Grafana muestra. En un flujo típico:

1. La aplicación se instrumenta con OpenTelemetry.
2. La telemetría se envía por OTLP al OpenTelemetry Collector.
3. El collector exporta los datos a backends compatibles.
4. Grafana consulta esos backends y presenta dashboards, alertas y exploración.

Por ejemplo:

- Métricas en Prometheus, visualizadas desde Grafana.
- Trazas en Grafana Tempo.
- Logs en Grafana Loki.

OpenTelemetry aporta la instrumentación y el transporte; Grafana aporta la exploración visual, los paneles y las alertas.

## Conclusión

La infraestructura Docker actual parece estar orientada principalmente a desarrollo local. Los análisis de otros integrantes ya cubren varios puntos críticos relacionados con seguridad básica, separación entre desarrollo y producción, builds y configuración del `.dockerignore`.

Los hallazgos agregados en este informe apuntan a otra dimensión: reproducibilidad de imágenes, operación en entornos paralelos, separación de configuraciones de file watching, manejo correcto del ciclo de vida de procesos y resguardo de datos persistentes. Estos aspectos son importantes para que el proyecto pueda evolucionar desde un entorno local funcional hacia una infraestructura más confiable, trazable y preparada para producción.
