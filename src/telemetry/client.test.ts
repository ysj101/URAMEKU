import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => {
  let consent = false;
  return {
    trackStep: vi.fn(),
    setConsent: vi.fn((value: boolean) => {
      consent = value;
    }),
    getConsent: () => consent,
    init: vi.fn(),
  };
});
vi.mock('journeygap-grafana', () => ({ initJourneyGapGrafana: sdk.init }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_JOURNEYGAP_ENABLED', 'true');
  vi.stubEnv('VITE_JOURNEYGAP_COLLECTOR_URL', 'http://127.0.0.1:4318/collect/test-app');
  localStorage.clear();
  sdk.setConsent(false);
  sdk.trackStep.mockClear();
  sdk.init.mockReset().mockReturnValue(sdk);
});

describe('host consent boundary', () => {
  it('does not send before consent, persists a grant and stops immediately on withdrawal', async () => {
    const client = await import('./client');
    await client.initializeTelemetry();
    expect(client.getTelemetryStatus()).toBe('off');
    expect(client.observeStep('onboarding', 'started')).toBe(false);
    expect(sdk.trackStep).not.toHaveBeenCalled();
    client.setTelemetryConsent(true);
    expect(client.observeStep('onboarding', 'started')).toBe(true);
    expect(localStorage.getItem(client.CONSENT_KEY)).toBe('true');
    client.revokeTelemetry();
    expect(sdk.getConsent()).toBe(false);
    expect(client.observeStep('onboarding', 'started')).toBe(false);
  });
  it('storage failure cannot prevent revocation or a pending initialization from being revoked', async () => {
    const client = await import('./client');
    await client.initializeTelemetry();
    client.setTelemetryConsent(true);
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('denied');
    });
    client.setTelemetryConsent(false);
    expect(sdk.getConsent()).toBe(false);
    expect(client.getTelemetryStatus()).toBe('off');
    storage.mockRestore();
  });
  it('keeps a withdrawal made while the SDK chunk is still loading', async () => {
    localStorage.setItem('urameku-journeygap-consent', 'true');
    const client = await import('./client');
    const loading = client.initializeTelemetry();
    client.revokeTelemetry();
    await loading;
    expect(client.getTelemetryStatus()).toBe('off');
    expect(sdk.getConsent()).toBe(false);
  });
  it('restores only explicit host consent and handles cross-tab revocation', async () => {
    localStorage.setItem('urameku-journeygap-consent', 'true');
    const client = await import('./client');
    await client.initializeTelemetry();
    expect(client.getTelemetryStatus()).toBe('on');
    window.dispatchEvent(
      new StorageEvent('storage', { key: client.CONSENT_KEY, newValue: 'false' }),
    );
    expect(client.getTelemetryStatus()).toBe('off');
    expect(sdk.getConsent()).toBe(false);
  });
  it('SDK failure affects only telemetry', async () => {
    sdk.init.mockImplementation(() => {
      throw Error('SDK unavailable');
    });
    const client = await import('./client');
    await expect(client.initializeTelemetry()).resolves.toBeUndefined();
    expect(client.getTelemetryStatus()).toBe('unavailable');
    expect(client.observeStep('onboarding', 'started')).toBe(false);
  });
});
