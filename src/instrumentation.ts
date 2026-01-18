import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'liprobakin',
    // In production, traces will be sent to Vercel's collector
    // For local development, you can configure OTLP endpoint
  });
}
