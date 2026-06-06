import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// FastifyInstrumentation NO está incluida en el bundle de auto-instrumentations-node.
// Los paquetes de instrumentación externos se instancian directamente y se pasan
// en el array 'instrumentations', no como clave en el objeto de getNodeAutoInstrumentations.
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
// 'Meter' es una interfaz de la API pública de OpenTelemetry, no del SDK de implementación.
// @opentelemetry/sdk-metrics exporta las clases concretas (MeterProvider, MetricReader, etc.)
// mientras que @opentelemetry/api exporta los tipos e interfaces que usa el código de aplicación.
import { metrics, Meter } from '@opentelemetry/api';

// Configurar Prometheus Exporter
const prometheusExporter = new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics',
});

// Crear SDK con auto-instrumentaciones
const sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
        // getNodeAutoInstrumentations solo acepta claves de instrumentaciones
        // que están incluidas dentro del propio paquete auto-instrumentations-node.
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {},
        }),
        // FastifyInstrumentation se instancia por separado porque es un paquete
        // independiente no incluido en auto-instrumentations-node.
        new FastifyInstrumentation(),
    ],
});

// Iniciar SDK
sdk.start();

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

// Corrección 3: manejo del ciclo de vida del SDK en entornos Docker/producción.
// Cuando el proceso recibe SIGTERM o SIGINT (por ejemplo, al ejecutar 'docker stop'),
// se invoca sdk.shutdown() para hacer flush de las métricas pendientes antes de salir.
// Sin esto, las últimas métricas registradas antes de un shutdown se perderían.
export async function gracefulShutdown(): Promise<void> {
    await sdk.shutdown();
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.on(signal, async () => {
        await gracefulShutdown();
        process.exit(0);
    });
});

export { sdk, meter, prometheusExporter };
