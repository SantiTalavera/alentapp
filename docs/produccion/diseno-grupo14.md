# Diseño de Infraestructura para Producción — Alentapp

## Grupo 14 | Ingeniería de Software

**Fecha:** 06/06/2026 
**Fase:** 2 — Especificar y Diseñar  
**Alcance:** Infraestructura Docker orientada a entornos productivos

---

## 2.1. Diseño de la Infraestructura Docker

Esta sección especifica el diseño de los tres artefactos de infraestructura que componen el entorno de producción de Alentapp. El objetivo es establecer las decisiones de arquitectura, las responsabilidades de cada archivo y los requisitos no funcionales que cada uno debe satisfacer.
---

### 2.1.1. `packages/api/Dockerfile.prod`

#### Propósito

Este Dockerfile tiene como objetivo producir una **imagen Docker mínima, segura e inmutable** del servidor backend de Alentapp (Fastify sobre Node.js). Es necesario porque el `Dockerfile` de desarrollo actual copia el código fuente completo, instala todas las dependencias (incluyendo devDependencies como `tsx`, `vitest` y `prisma`) y ejecuta el servidor mediante `tsx watch`, un proceso pensado para hot-reload y no para producción.

La imagen de producción, en contraste, debe contener exclusivamente el código JavaScript ya compilado y las dependencias de runtime (`fastify`, `@prisma/client`, `@fastify/cors`), ejecutarse bajo un usuario sin privilegios y exponer un healthcheck que permita a los orquestadores verificar su disponibilidad.

> **Nota sobre el script de build de la API:** A diferencia del paquete `web`, el `packages/api/package.json` actual **no define un script `build`**; solo dispone de `dev` (que ejecuta `tsx watch src/app.ts`). Para hacer posible el build multi-stage, la etapa `build` del Dockerfile deberá invocar al compilador TypeScript directamente (`npx tsc --project tsconfig.json`) para generar el JavaScript en el directorio `dist/`. Esto implica que, en la fase de implementación, se deberá agregar un `tsconfig.json` adecuado en `packages/api/` con `outDir: "./dist"` y, opcionalmente, un script `"build": "tsc"` en el `package.json`.

---

#### Estructura

El Dockerfile de producción de la API se organiza en **3 etapas** (_multi-stage build_):

| # | Nombre de Etapa | Imagen Base | Responsabilidad |
|---|-----------------|-------------|-----------------|
| 1 | `deps` | `node:22-alpine` | Instalar **únicamente** las dependencias de producción (`npm ci --omit=dev`) a partir de los `package.json` del workspace. Esta etapa aprovecha el caché de capas de Docker: si los archivos `package*.json` no cambian entre builds, Docker reutiliza esta capa sin reinstalar paquetes. |
| 2 | `build` | `node:22-alpine` | Copiar el código fuente TypeScript completo y compilarlo a JavaScript mediante `npx tsc`, generando el artefacto final en el directorio `dist/`. Esta etapa también ejecuta `npx prisma generate` para generar el cliente Prisma sin necesidad de la CLI en runtime. |
| 3 | `runtime` | `node:22-alpine` | Imagen final de producción. Copia desde `deps` los `node_modules` de producción y desde `build` únicamente el directorio `dist/`. **No contiene código TypeScript, devDependencies ni herramientas de compilación.** Ejecuta el proceso bajo el usuario `node` (no-root). |

**Capas clave de la etapa `runtime`:**

| Instrucción | Justificación |
|-------------|---------------|
| `COPY --from=deps /app/node_modules ./node_modules` | Trae solo las dependencias de producción, sin `tsx`, `vitest`, `prisma` CLI, etc. |
| `COPY --from=build /app/dist ./dist` | Trae únicamente el JS compilado; el código TS fuente queda excluido de la imagen final. |
| `RUN chown -R node:node /app` | Asigna la propiedad de los archivos al usuario `node` antes del cambio de contexto. |
| `USER node` | Cambia el contexto de ejecución a un usuario sin privilegios de root. |
| `HEALTHCHECK` | Verifica que el proceso responde en `http://localhost:3000/health` (endpoint a definir en la implementación). |
| `CMD ["node", "dist/app.js"]` | Arranca la aplicación compilada directamente con Node.js, sin intermediarios. |

**Requisito de `.dockerignore`:** Se debe crear un archivo `.dockerignore` en `packages/api/` que excluya al menos: `node_modules/`, `dist/`, `*.test.ts`, `coverage/`, `.env*` y `Dockerfile*`. Esto evita que el contexto de build transfiera archivos innecesarios al daemon de Docker.

---

#### Requisitos No Funcionales

| Atributo | Métrica Objetivo | Justificación |
|----------|-----------------|---------------|
| **Tamaño de imagen final** | ≤ 200 MB | La imagen `node:22-alpine` base ocupa ~60 MB. Con `node_modules` de producción (≈80 MB) y el `dist/` compilado (< 5 MB), el objetivo es mantener la imagen por debajo de 200 MB. Una imagen sobredimensionada aumenta los tiempos de pull y la superficie de ataque. |
| **Tiempo de startup del contenedor** | ≤ 5 segundos | Medido desde `docker run` hasta que el healthcheck responde 200 OK. Fastify tiene tiempos de arranque muy bajos; superar este umbral indicaría un problema de inicialización (ej. conexión a DB bloqueante). |
| **Ejecución sin privilegios root** | 100% (obligatorio) | El proceso `node` debe correr con UID/GID del usuario `node` (1000/1000 en la imagen oficial). Verificable con `docker exec <cid> id`. |
| **Dependencias en imagen final** | 0 devDependencies | Verificable con `docker exec <cid> npm ls --omit=dev`. Ningún paquete de `devDependencies` (tsx, vitest, prisma CLI, etc.) debe estar presente. |
| **Tiempo de build** | ≤ 3 minutos (con caché) | Cuando los `package*.json` no cambian, la etapa `deps` debe ser servida desde caché, reduciendo el tiempo de rebuild a menos de 60 segundos. |

---

### 2.1.2. `packages/web/Dockerfile.prod`

#### Propósito

Este Dockerfile tiene como objetivo producir una **imagen ultra-liviana** para servir el frontend de Alentapp (React + Vite + ChakraUI) como archivos estáticos a través de **nginx**. Es necesario porque el entorno de desarrollo sirve la aplicación mediante el servidor de desarrollo de Vite (`vite dev`), que incluye HMR, source maps, y está diseñado para un único usuario. En producción, el bundle debe estar compilado, minificado y servido por un servidor HTTP de alto rendimiento como nginx, capaz de manejar concurrencia real, compresión gzip y headers de caché.

El script de build real del proyecto, definido en `packages/web/package.json`, es:

```
"build": "tsc -b && vite build"
```

Este comando realiza dos pasos secuenciales: primero compila y verifica los tipos con TypeScript (`tsc -b`), y luego Vite toma el código TypeScript transpilado y produce el bundle optimizado en `dist/`, incluyendo tree-shaking, minificación de JS/CSS y hashing de assets para cache-busting.

---

#### Estructura

El Dockerfile de producción del frontend se organiza en **3 etapas** (_multi-stage build_):

| # | Nombre de Etapa | Imagen Base | Responsabilidad |
|---|-----------------|-------------|-----------------|
| 1 | `deps` | `node:22-alpine` | Copiar los `package*.json` e instalar **todas** las dependencias del workspace web (incluyendo devDependencies, ya que `vite`, `typescript` y `@vitejs/plugin-react` son necesarios para compilar). Aprovecha el caché de capas de Docker. |
| 2 | `build` | `node:22-alpine` | Copiar el código fuente y ejecutar `npm run build -w packages/web`, que internamente corre `tsc -b && vite build`. El resultado es el directorio `dist/` con los artefactos estáticos listos para producción. |
| 3 | `runtime` | `nginx:stable-alpine` | Imagen final de producción. Copia **únicamente** el directorio `dist/` desde la etapa `build` hacia la carpeta de servido de nginx (`/usr/share/nginx/html`). **No contiene Node.js, npm, código fuente TypeScript ni ninguna devDependency.** |

**Reducción de tamaño esperada:** La imagen de desarrollo con `node:22-alpine` y todas las dependencias del workspace web ocupa aproximadamente 600-800 MB. La imagen de producción con `nginx:stable-alpine` (≈10 MB base) más los estáticos compilados del frontend debería ubicarse por debajo de **30 MB**.

**Capas clave de la etapa `runtime`:**

| Instrucción / Configuración | Justificación |
|-----------------------------|---------------|
| `COPY --from=build /app/packages/web/dist /usr/share/nginx/html` | Solo los artefactos estáticos. Cero código fuente o tooling en la imagen final. |
| Configuración nginx: `gzip on` | Comprime HTML, CSS, JS y JSON antes de enviarlos al cliente, reduciendo el payload entre un 60-80%. Es fundamental para el rendimiento en redes lentas. |
| Configuración nginx: `expires` y `Cache-Control` | Assets con hash en el nombre (generados por Vite) se sirven con `Cache-Control: max-age=31536000, immutable`. El `index.html` se sirve con `no-cache` para garantizar que el cliente siempre reciba la versión más reciente. |
| Configuración nginx: Security headers | Se añaden headers como `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Content-Security-Policy` para mitigar ataques XSS, clickjacking y sniffing de MIME types. |
| `HEALTHCHECK` | Verifica que nginx responde en `http://localhost:80` con un código HTTP 2xx mediante `wget -q --spider`. |
| Archivo de configuración nginx personalizado | Se monta un `nginx.conf` propio que reemplaza el default, incluye `try_files $uri /index.html` para soportar el routing de React Router, y activa todas las configuraciones anteriores. |

---

#### Requisitos No Funcionales

| Atributo | Métrica Objetivo | Justificación |
|----------|-----------------|---------------|
| **Tamaño de imagen final** | ≤ 30 MB | `nginx:stable-alpine` pesa ~10 MB. Los assets del frontend (JS + CSS + imágenes) de una SPA de tamaño medio ocupan entre 5-15 MB. Superar los 30 MB indicaría que se están incluyendo archivos innecesarios. |
| **Tiempo de startup del contenedor** | ≤ 2 segundos | nginx inicia en milisegundos. El healthcheck debería responder exitosamente casi de inmediato tras `docker run`. |
| **Tiempo de build (sin caché)** | ≤ 4 minutos | El paso `tsc -b && vite build` es el cuello de botella. Con el workspace de Alentapp, no debería superar los 3-4 minutos en un entorno de CI estándar. |
| **Tiempo de build (con caché de `deps`)** | ≤ 90 segundos | Si `package*.json` no cambia, la etapa `deps` se sirve desde caché y solo se re-ejecuta el `build`. |
| **Compresión gzip activada** | Obligatorio (verificable) | Verificable con `curl -H "Accept-Encoding: gzip" -I http://localhost` — el header de respuesta debe incluir `Content-Encoding: gzip` para archivos JS y CSS. |
| **Ausencia de Node.js en imagen final** | 100% (obligatorio) | Verificable con `docker exec <cid> which node` — debe retornar vacío o error. |

---

### 2.1.3. `docker-compose.prod.yml`

#### Propósito

Este archivo de composición orquesta los tres servicios del sistema (base de datos PostgreSQL, API Fastify y frontend nginx) en el entorno de producción. Es necesario porque el `docker-compose.yml` de desarrollo fue diseñado para conveniencia del desarrollador: monta el código fuente como volumen, no define límites de recursos, expone credenciales en texto plano y activa watchers de archivos (`CHOKIDAR_USEPOLLING`). Ninguno de estos patrones es admisible en producción.

`docker-compose.prod.yml` reemplaza completamente esa configuración, aplicando principios de seguridad por defecto, aislamiento de red, resiliencia operativa y trazabilidad de logs.

---

#### Estructura

El archivo se divide en las siguientes secciones lógicas:

##### Sección 1: Gestión de Secretos y Variables de Entorno

| Decisión de diseño | Detalle |
|-------------------|---------|
| **Archivo `.env` externo** | Todas las variables sensibles (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, etc.) se leen desde un archivo `.env` en el mismo directorio que el compose, mediante la directiva `env_file: .env`. Este archivo **nunca** se commitea al repositorio (está en `.gitignore`). |
| **Cero valores hardcodeados** | El archivo `docker-compose.prod.yml` no contiene ningún valor de credencial literal. Toda referencia es a variables (`${VARIABLE}`). |
| **Archivo `.env.example`** | Se provee un archivo de ejemplo con las claves requeridas pero sin valores, como documentación para el operador. |

##### Sección 2: Servicios

| Servicio | Imagen | Descripción |
|----------|--------|-------------|
| `db` | `postgres:16-alpine` | Base de datos PostgreSQL. Sin cambios en la imagen base, pero con resource limits, healthcheck estricto, red interna y sin exposición de puertos al host. |
| `api` | `build: packages/api/Dockerfile.prod` | Servidor Fastify compilado. Sin bind-mounts, con usuario no-root, con límites de CPU/memoria y healthcheck HTTP. |
| `web` | `build: packages/web/Dockerfile.prod` | Frontend estático servido por nginx. Sin bind-mounts, con healthcheck HTTP y límites de recursos. |

##### Sección 3: Resource Limits

Para cada servicio se definirán límites bajo `deploy.resources`:

| Servicio | CPU Limit | Memory Limit | Memory Reservation |
|----------|-----------|--------------|--------------------|
| `db` | `1.0` | `512M` | `256M` |
| `api` | `0.5` | `512M` | `256M` |
| `web` | `0.25` | `128M` | `64M` |

> **Justificación:** Los valores son conservadores para un despliegue en un servidor de bajo costo (VPS 2 vCPU / 2 GB RAM). PostgreSQL requiere más memoria para el buffer cache; la API Fastify tiene un footprint bajo en Node.js; nginx es extremadamente liviano. Las reservaciones (`reservations`) garantizan que cada servicio cuente con recursos mínimos disponibles.

##### Sección 4: Healthchecks

| Servicio | Comando de verificación | Intervalo | Timeout | Reintentos | Start period |
|----------|------------------------|-----------|---------|------------|--------------|
| `db` | `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` | 10s | 5s | 5 | 30s |
| `api` | `wget -q --spider http://localhost:3000/health` | 30s | 10s | 3 | 40s |
| `web` | `wget -q --spider http://localhost:80` | 30s | 10s | 3 | 10s |

> El `start_period` de la API es más largo (40s) para dar tiempo a que Prisma establezca la conexión con la base de datos antes de que el healthcheck empiece a fallar y el orquestador marque el contenedor como unhealthy.

##### Sección 5: Seguridad

Estas directivas se aplicarán a los servicios `api` y `web` (no aplican a `db`):

| Directiva | Valor | Efecto |
|-----------|-------|--------|
| `read_only: true` | `true` | El sistema de archivos del contenedor es de solo lectura. Un atacante que logre ejecución de código no podrá modificar los binarios ni escribir archivos persistentes. Los directorios que necesiten escritura (ej. `/tmp`, logs de nginx) se montan como `tmpfs`. |
| `cap_drop` | `ALL` | Elimina todas las Linux capabilities del contenedor. El proceso no tiene ningún privilegio del kernel por defecto. |
| `cap_add` | `NET_BIND_SERVICE` | Re-agrega únicamente la capability necesaria para que nginx (en el servicio `web`) pueda escuchar en el puerto 80. |
| `security_opt` | `no-new-privileges:true` | Impide que el proceso o sus hijos puedan escalar privilegios mediante `setuid`/`setgid`. |

##### Sección 6: Logging

Se configura el driver `json-file` con rotación en todos los servicios para evitar que los logs consuman el disco del host indefinidamente:

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| `driver` | `json-file` | Driver nativo de Docker, compatible con `docker logs` y con herramientas de recolección como Promtail/Fluentd. |
| `max-size` | `10m` | Cada archivo de log rota cuando alcanza 10 MB. |
| `max-file` | `3` | Se conservan como máximo 3 archivos rotados por servicio, limitando el espacio máximo a 30 MB por servicio. |

##### Sección 7: Red Interna

| Decisión | Detalle |
|----------|---------|
| **Red personalizada** | Se define una red `alentapp-prod-net` con driver `bridge`. Todos los servicios se conectan a ella. |
| **Sin exposición innecesaria** | El servicio `db` **no expone ningún puerto al host** (`ports` ausente). Solo es accesible desde dentro de la red `alentapp-prod-net` por la `api`. |
| **Exposición mínima** | Solo `web` (puerto `80`) y `api` (puerto `3000`) exponen puertos al host, idealmente detrás de un reverse proxy (nginx externo o Traefik) que centralice el TLS. |

---

#### Requisitos No Funcionales del Compose

| Atributo | Métrica Objetivo | Justificación |
|----------|-----------------|---------------|
| **Tiempo de `docker compose up` (cold start)** | ≤ 90 segundos | Incluye el pull de imágenes (si no están en caché), el inicio de los tres servicios y la superación del healthcheck de `db` (que tiene un `start_period` de 30s). |
| **Cero credenciales en el repositorio** | 100% (verificable con `git grep`) | Auditable con `git grep -r "password" docker-compose.prod.yml` — debe retornar vacío. |
| **Footprint de disco de logs** | ≤ 90 MB totales | 3 servicios × 3 archivos × 10 MB = 90 MB máximo de logs en disco del host. |
| **Aislamiento de red** | La DB no es alcanzable desde el host | Verificable intentando `psql -h localhost -p 5432` desde el host: debe fallar (connection refused) al no estar expuesto el puerto. |
| **Stack operativo tras restart** | Todos los servicios con `restart: unless-stopped` | Garantiza que el stack se recupere automáticamente tras un reinicio del host sin intervención manual. |

---

## Decisiones de Arquitectura Transversales

| Decisión | Alternativa Descartada | Motivo de la Elección |
|----------|------------------------|----------------------|
| `node:22-alpine` como base para etapas de build | `node:22` (Debian) | La variante Alpine reduce el tamaño base de ~1 GB a ~60 MB, acelerando pulls y reduciendo superficie de ataque. La compatibilidad con `glibc` no es un problema para el stack de Alentapp. |
| `nginx:stable-alpine` para servir el frontend | Servir estáticos desde Node.js | nginx es 10-100x más eficiente que Node.js para servir archivos estáticos, soporta gzip nativo, caché de respuestas y security headers sin dependencias adicionales. |
| `npm ci --omit=dev` en etapa `deps` de API | `npm install` | `npm ci` es reproducible (usa `package-lock.json` exacto), más rápido y adecuado para CI/CD. `--omit=dev` garantiza que ninguna devDependency entre en la imagen final. |
| Secretos via `.env` + `env_file` | Variables de entorno en el `docker-compose.prod.yml` | El archivo `.env` puede ser gestionado por herramientas de secretos (AWS Secrets Manager, Vault) sin modificar el compose. Es el estándar de facto para entornos sin orquestación avanzada (Kubernetes). |
