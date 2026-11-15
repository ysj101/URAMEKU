import type { JourneyGapConfig } from '@journeygap/web';

import journeys from './journeys.json';
export { journeys };

export function telemetryConfig(
  enabled: string | undefined,
  endpoint: string | undefined,
): JourneyGapConfig | null {
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
      !url.pathname.endsWith('/v1/traces')
    )
      return null;
  } catch {
    return null;
  }
  return {
    schemaVersion: 1,
    enabled: true,
    serviceName: 'urameku',
    otlpTracesEndpoint: endpoint,
    consent: { mode: 'opt-in', ui: 'external' },
    routes: [
      { id: 'tutorial', pattern: '/tutorial' },
      { id: 'case01', pattern: '/play/case-06' },
    ],
    journeys,
  };
}

export const config = telemetryConfig(
  import.meta.env.VITE_JOURNEYGAP_ENABLED,
  import.meta.env.VITE_JOURNEYGAP_ENDPOINT,
);
