import { describe, expect, it } from 'vitest';
import { validateRelayConfig } from 'journeygap-grafana/analysis';
import relay from '../../qa/journeygap.analysis.json';
import { telemetryConfig } from './config';

describe('JourneyGap deployment configuration', () => {
  it('defaults off and rejects unsafe endpoints', () => {
    for (const endpoint of [
      undefined,
      'http://example.org/collect/test-app',
      'https://u:p@example.org/collect/test-app',
      'https://example.org/collect/test-app?token=secret',
      'https://example.org/wrong',
    ])
      expect(telemetryConfig('true', endpoint)).toBeNull();
    expect(telemetryConfig(undefined, 'https://example.org/collect/test-app')).toBeNull();
  });
  it('uses identical journey definitions for the browser and analysis', () => {
    const config = telemetryConfig('true', 'http://127.0.0.1:4318/collect/test-app')!;
    expect(config.collectorUrl).toBe('http://127.0.0.1:4318/collect/test-app');
    expect(validateRelayConfig(relay).valid).toBe(true);
    expect(config.journeys).toEqual(relay.services[0]!.journeys);
    expect(config.routes!.map((route) => route.pattern)).toEqual(['/tutorial', '/play/case-01']);
  });
});
