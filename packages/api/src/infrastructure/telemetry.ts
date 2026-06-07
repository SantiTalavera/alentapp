import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// Se usan solo las instrumentaciones necesarias para Alentapp:
// HttpInstrumentation cubre las peticiones HTTP entrantes/salientes.
// FastifyInstrumentation agrega spans específicos del framework.
// Reemplaza getNodeAutoInstrumentations (meta-paquete de ~400MB que incluye
// instrumentaciones para AWS, Redis, MongoDB, MySQL, gRPC, etc. no utilizadas).
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { metrics, Meter } from '@opentelemetry/api';

// Configurar Prometheus Exporter
const prometheusExporter = new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics',
});

// Crear SDK con las instrumentaciones específicas necesarias
const sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
        new HttpInstrumentation(),
        new FastifyInstrumentation(),
    ],
});

// Rastrear si el SDK fue efectivamente iniciado.
// Solo se inicia fuera del entorno de test: en tests (NODE_ENV=test) el
// PrometheusExporter intentaría ocupar el puerto 9464 en cada worker de
// Vitest, causando EADDRINUSE en suites paralelas.
// También se puede deshabilitar explícitamente con OTEL_ENABLED=false.
let telemetryStarted = false;

if (process.env.NODE_ENV !== 'test' && process.env.OTEL_ENABLED !== 'false') {
    sdk.start();
    telemetryStarted = true;
}

// Corrección 2: 'meter' se crea a nivel de módulo y se exporta para ser reutilizado
// por cualquier parte de la aplicación que necesite registrar métricas.
// La función 'createREDMetrics' recibe este mismo meter como parámetro para evitar
// dependencias implícitas de módulo y facilitar el testeo unitario.
const meter = metrics.getMeter('alentapp-api');

export function createREDMetrics(meter: Meter) {
    const requestCounter = meter.createCounter('http.requests.total', {
        description: 'Total de requests HTTP',
    });
    const errorCounter = meter.createCounter('http.requests.errors', {
        description: 'Total de errores HTTP',
    });
    const requestDuration = meter.createHistogram('http.request.duration', {
        description: 'Duración de requests',
        unit: 'ms',
    });

    // Gauge: memoria del proceso en uso (heapUsed).
    // Se usa createObservableGauge porque la memoria es un valor puntual que varía
    // continuamente — no se "acumula" como un counter. El callback es invocado
    // automáticamente por el SDK cada vez que Prometheus hace un scrape al endpoint
    // /metrics, sin necesidad de llamarlo manualmente en los controladores.
    const memoryGauge = meter.createObservableGauge('process.memory.usage', {
        description: 'Memoria heap del proceso Node.js en uso (heapUsed)',
        unit: 'bytes',
    });
    memoryGauge.addCallback((observableResult) => {
        observableResult.observe(process.memoryUsage().heapUsed);
    });

    // UpDownCounter: requests HTTP concurrentes activas en un momento dado.
    // A diferencia de un Counter (que solo sube), un UpDownCounter puede
    // incrementarse (+1 al inicio de la petición) y decrementarse (-1 al finalizar),
    // lo que permite medir cuántas requests están siendo procesadas simultáneamente.
    const activeRequestsCounter = meter.createUpDownCounter('http.requests.active', {
        description: 'Cantidad de requests HTTP siendo procesadas en este momento',
    });

    return { requestCounter, errorCounter, requestDuration, activeRequestsCounter };
}

// Caché de métricas RED a nivel de módulo.
// Dado que 'meter' es global, recrear instrumentos con el mismo nombre en
// llamadas sucesivas a buildApp() (habitual en tests de integración) puede
// acumular callbacks del ObservableGauge o generar warnings del SDK.
// getREDMetrics() garantiza que los instrumentos se crean una sola vez.
let redMetrics: ReturnType<typeof createREDMetrics> | undefined;

export function getREDMetrics(): ReturnType<typeof createREDMetrics> {
    if (!redMetrics) {
        redMetrics = createREDMetrics(meter);
    }
    return redMetrics;
}

// Cierra el SDK de OpenTelemetry de forma ordenada.
// El objetivo principal es detener el servidor HTTP del PrometheusExporter
// (puerto 9464) y liberar sus recursos. Si el SDK no fue iniciado
// (entorno de test o OTEL_ENABLED=false), retorna sin hacer nada.
// Los listeners de señales (SIGTERM/SIGINT) se registran exclusivamente
// en app.ts para evitar carreras entre múltiples handlers.
export async function shutdownTelemetry(): Promise<void> {
    if (!telemetryStarted) return;
    await sdk.shutdown();
    telemetryStarted = false;
}

export { sdk, meter, prometheusExporter };
