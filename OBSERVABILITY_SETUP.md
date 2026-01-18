# Observability Stack Setup

This project includes a complete observability stack with Grafana, Prometheus, Loki, and Tempo for monitoring, logging, and tracing.

## Services

### Grafana (Port 3001)
- **URL**: http://localhost:3001
- **Default credentials**: admin / admin
- **Purpose**: Visualization and dashboards for all your metrics, logs, and traces

### Prometheus (Port 9090)
- **URL**: http://localhost:9090
- **Purpose**: Metrics collection and storage
- **Scrapes**: Self, Grafana, Loki, Tempo (configurable for your app)

### Loki (Port 3100)
- **URL**: http://localhost:3100
- **Purpose**: Log aggregation system
- **Integration**: Automatically configured in Grafana

### Tempo (Port 3200)
- **URL**: http://localhost:3200
- **Purpose**: Distributed tracing backend
- **OTLP Ports**: 
  - 4317 (gRPC)
  - 4318 (HTTP)

### Promtail
- **Purpose**: Ships logs to Loki
- **Monitors**: Docker containers and system logs

## Quick Start

1. **Start the stack**:
   ```bash
   docker-compose up -d
   ```

2. **Access Grafana**:
   - Open http://localhost:3001
   - Login with admin/admin
   - Change password on first login

3. **Verify datasources**:
   - Go to Configuration → Data Sources
   - You should see Prometheus, Loki, and Tempo pre-configured

4. **View logs**:
   - Go to Explore → Select Loki
   - Query: `{container="liprobakin-app"}`

5. **View metrics**:
   - Go to Explore → Select Prometheus
   - Query: `up` (to see all targets)

6. **View traces**:
   - Go to Explore → Select Tempo
   - Search for traces

## Configuration Files

- `grafana/provisioning/datasources/datasources.yml` - Auto-provision datasources
- `prometheus/prometheus.yml` - Prometheus scrape configuration
- `loki/local-config.yaml` - Loki configuration
- `tempo/tempo.yaml` - Tempo configuration
- `promtail/config.yml` - Promtail log shipping config

## Adding Metrics to Your Next.js App

To expose metrics from your application:

1. Install the Prometheus client:
   ```bash
   npm install prom-client
   ```

2. Create a metrics endpoint at `src/app/api/metrics/route.ts`:
   ```typescript
   import { NextResponse } from 'next/server';
   import { register, collectDefaultMetrics } from 'prom-client';

   collectDefaultMetrics();

   export async function GET() {
     const metrics = await register.metrics();
     return new NextResponse(metrics, {
       headers: {
         'Content-Type': register.contentType,
       },
     });
   }
   ```

3. Uncomment the liprobakin job in `prometheus/prometheus.yml`

## Adding Tracing to Your Next.js App

For distributed tracing with Tempo:

1. Install OpenTelemetry:
   ```bash
   npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
   ```

2. Create `instrumentation.ts` in your project root:
   ```typescript
   export async function register() {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       const { NodeSDK } = await import('@opentelemetry/sdk-node');
       const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
       const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

       const sdk = new NodeSDK({
         traceExporter: new OTLPTraceExporter({
           url: 'http://tempo:4318/v1/traces',
         }),
         instrumentations: [getNodeAutoInstrumentations()],
       });

       sdk.start();
     }
   }
   ```

## Stopping the Stack

```bash
docker-compose down
```

To remove volumes (deletes all data):
```bash
docker-compose down -v
```

## Useful Grafana Dashboards

After logging in, you can import community dashboards:
- Docker monitoring: Dashboard ID 893
- Loki logs: Dashboard ID 13639
- Prometheus stats: Dashboard ID 3662

Go to Dashboards → Import → Enter dashboard ID

## Troubleshooting

1. **Can't access Grafana**: Ensure port 3001 is not in use
2. **No logs in Loki**: Check Promtail container logs: `docker-compose logs promtail`
3. **No metrics in Prometheus**: Check targets at http://localhost:9090/targets
4. **Datasources not auto-provisioned**: Restart Grafana container

## Default Ports

- Application: 3000
- Grafana: 3001
- Loki: 3100
- Tempo: 3200
- Tempo OTLP gRPC: 4317
- Tempo OTLP HTTP: 4318
- Prometheus: 9090
- Promtail: 9080
