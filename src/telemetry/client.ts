import { useSyncExternalStore } from 'react';
import type { JourneyGapClient } from '@journeygap/web';
import { config } from './config';

export const CONSENT_KEY = 'urameku-journeygap-consent';
type Status = 'disabled' | 'loading' | 'off' | 'on' | 'unavailable';
let status: Status = config ? 'loading' : 'disabled';
let client: JourneyGapClient | undefined;
let initialization: Promise<void> | undefined;
const listeners = new Set<() => void>();
let generation = 0;
let memoryChoice: boolean | undefined;
function notify(next: Status) {
  status = next;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getTelemetryStatus = () => status;
export function useTelemetryStatus() {
  return useSyncExternalStore(subscribe, getTelemetryStatus, getTelemetryStatus);
}
function storedConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function initializeTelemetry(): Promise<void> {
  const settings = config;
  if (!settings) return Promise.resolve();
  initialization ??= import('@journeygap/web')
    .then(({ initJourneyGap }) => {
      client = initJourneyGap(settings);
      setTelemetryConsent(memoryChoice ?? storedConsent(), false);
      window.addEventListener('storage', (event) => {
        if (
          event.key === null ||
          event.key === CONSENT_KEY ||
          event.key === 'journeygap.consent.v1'
        ) {
          // Never propagate a grant from another tab; only a fresh local grant can resume.
          if (event.key === null || event.newValue !== 'true') setTelemetryConsent(false, false);
        }
      });
    })
    .catch(() => {
      notify('unavailable');
    });
  return initialization;
}

export function setTelemetryConsent(allowed: boolean, persist = true) {
  generation++;
  memoryChoice = allowed;
  // Storage failure must never prevent withdrawal in memory.
  if (persist) {
    try {
      localStorage.setItem(CONSENT_KEY, String(allowed));
    } catch {
      /* Memory-only choice. */
    }
  }
  try {
    client?.setConsent(allowed);
    notify(
      !config
        ? 'disabled'
        : !client
          ? 'loading'
          : allowed && !client.getConsent()
            ? 'unavailable'
            : allowed
              ? 'on'
              : 'off',
    );
  } catch {
    notify('unavailable');
  }
}
export function revokeTelemetry() {
  setTelemetryConsent(false, false);
}
export const telemetryGeneration = () => generation;

/** No attributes or application state can cross this boundary. */
export function observeStep(journey: string, step: string): boolean {
  try {
    if (status !== 'on' || !client?.getConsent()) return false;
    client.trackStep(journey, step);
    return true;
  } catch {
    return false;
  }
}
