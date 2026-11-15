import type { JourneyGapGrafanaConfig } from 'journeygap-grafana';

import journeys from './journeys.json';
export { journeys };

export function telemetryConfig(
  enabled: string | undefined,
  endpoint: string | undefined,
): JourneyGapGrafanaConfig | null {
  if (enabled !== 'true' || !endpoint) return null;
  // Full validation is performed by the real SDK. Reject credentials and unsafe URLs before loading it.
  try {
    const url = new URL(endpoint);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/\/collect\/[A-Za-z0-9_-]{1,256}$/.test(url.pathname)
    )
      return null;
  } catch {
    return null;
  }
  return {
    schemaVersion: 1,
    enabled: true,
    serviceName: 'urameku',
    collectorUrl: endpoint,
    // The reusable SDK stays opt-in; this app applies its default-on/opt-out policy.
    consent: { mode: 'opt-in', ui: 'external' },
    routes: [
      { id: 'tutorial', pattern: '/tutorial' },
      { id: 'case01', pattern: '/play/case-01' },
    ],
    journeys,
  };
}

export const config = telemetryConfig(
  import.meta.env.VITE_JOURNEYGAP_ENABLED,
  import.meta.env.VITE_JOURNEYGAP_COLLECTOR_URL,
);
