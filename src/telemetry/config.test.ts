import { describe, expect, it } from 'vitest';
import { validateConfig, validateRelayConfig } from '@journeygap/core';
import relay from '../../qa/journeygap.relay.local.json';
import { telemetryConfig } from './config';

describe('JourneyGap deployment configuration', () => {
  it('defaults off and rejects unsafe endpoints', () => {
    for (const endpoint of [
      undefined,
      'http://example.org/v1/traces',
      'https://u:p@example.org/v1/traces',
      'https://example.org/v1/traces?token=secret',
      'https://example.org/wrong',
    ])
      expect(telemetryConfig('true', endpoint)).toBeNull();
    expect(telemetryConfig(undefined, 'https://example.org/v1/traces')).toBeNull();
  });
  it('uses identical valid Web and Relay definitions', () => {
    const config = telemetryConfig('true', 'http://127.0.0.1:4318/v1/traces')!;
    expect(validateConfig(config).valid).toBe(true);
    expect(validateRelayConfig(relay).valid).toBe(true);
    expect(config.journeys).toEqual(relay.services[0]!.journeys);
    expect(config.routes!.map((route) => route.pattern)).toEqual(['/tutorial', '/play/case-01']);
  });
});
