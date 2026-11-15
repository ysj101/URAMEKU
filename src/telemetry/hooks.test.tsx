import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameApi } from '../state/useGame';
import { findCase } from '../data/cases';
import { createProgress } from '../domain/game';
import { useCase01Telemetry, useOnboardingTelemetry } from './hooks';

const state = vi.hoisted(() => ({ status: 'on', epoch: 1, send: vi.fn(() => true) }));
vi.mock('./client', () => ({
  useTelemetryStatus: () => state.status,
  telemetryGeneration: () => state.epoch,
  observeStep: state.send,
}));
beforeEach(() => {
  state.status = 'on';
  state.epoch = 1;
  state.send.mockClear();
});
function game(id = 'case-01'): GameApi {
  const current = findCase(id)!;
  return { current, progress: createProgress(current), stage: 'investigate' } as GameApi;
}
const calls = () => state.send.mock.calls as unknown as string[][];

describe('actual observed onboarding progress', () => {
  it('deduplicates StrictMode, backtracking and rerenders; restarts create a new start', () => {
    const { rerender } = renderHook(({ step }) => useOnboardingTelemetry(step), {
      initialProps: { step: -2 },
      wrapper: StrictMode,
    });
    for (const step of [-1, 0, 1, 2, 1, 2, 3, 3]) rerender({ step });
    expect(calls().map((call) => call[1])).toEqual([
      'started',
      'initial-choice-confirmed',
      'updated-choice-confirmed',
      'documents-reviewed',
      'report-prepared',
      'report-submitted',
    ]);
    rerender({ step: -2 });
    expect(calls().filter((call) => call[1] === 'started')).toHaveLength(2);
  });
  it('does not backfill consent granted halfway through; a restart can be measured', () => {
    state.status = 'off';
    const { rerender } = renderHook(({ step }) => useOnboardingTelemetry(step), {
      initialProps: { step: -2 },
    });
    rerender({ step: 1 });
    state.status = 'on';
    state.epoch++;
    rerender({ step: 1 });
    rerender({ step: 3 });
    expect(state.send).not.toHaveBeenCalled();
    rerender({ step: -2 });
    expect(calls()).toEqual([['onboarding', 'started']]);
  });
});

describe('CASE01 observations', () => {
  it('does not count a stale default case while the URL selects another case', () => {
    renderHook(() => useCase01Telemetry(game(), 0, 'case-03'));
    expect(state.send).not.toHaveBeenCalled();
  });
  it('tracks new document, report view and submission without answer attributes', () => {
    const first = game();
    const { rerender } = renderHook(({ data }) => useCase01Telemetry(data, 0), {
      initialProps: { data: first },
      wrapper: StrictMode,
    });
    const opened = {
      ...first,
      progress: { ...first.progress, opened: [first.current.documents[0]!.id] },
    };
    rerender({ data: opened });
    rerender({ data: opened });
    const report = { ...opened, stage: 'article' as const };
    rerender({ data: report });
    rerender({ data: { ...report, progress: { ...report.progress, published: true } } });
    expect(calls()).toEqual([
      ['case01-report', 'started'],
      ['case01-reading', 'started'],
      ['case01-reading', 'document-opened'],
      ['case01-report', 'report-opened'],
      ['case01-report', 'report-submitted'],
    ]);
    expect(calls().every((call) => call.length === 2)).toBe(true);
  });
  it('ignores other cases and restored documents/reports', () => {
    const { unmount } = renderHook(() => useCase01Telemetry(game('case-03'), 0));
    expect(state.send).not.toHaveBeenCalled();
    unmount();
    const saved = game();
    saved.progress.opened = [saved.current.documents[0]!.id];
    const { unmount: end } = renderHook(() => useCase01Telemetry(saved, 0));
    expect(calls().some((call) => call[1] === 'document-opened')).toBe(false);
    end();
    state.send.mockClear();
    saved.progress.published = true;
    renderHook(() => useCase01Telemetry(saved, 0));
    expect(state.send).not.toHaveBeenCalled();
  });
  it('withdrawal/regrant and reset do not replay stored milestones', () => {
    const first = game();
    const { rerender } = renderHook(({ data, reset }) => useCase01Telemetry(data, reset), {
      initialProps: { data: first, reset: 0 },
    });
    state.status = 'off';
    state.epoch++;
    rerender({ data: first, reset: 0 });
    const opened = {
      ...first,
      progress: { ...first.progress, opened: [first.current.documents[0]!.id] },
    };
    rerender({ data: opened, reset: 0 });
    state.status = 'on';
    state.epoch++;
    rerender({ data: opened, reset: 0 });
    expect(calls().some((call) => call[1] === 'document-opened')).toBe(false);
    rerender({ data: first, reset: 1 });
    expect(
      calls().filter((call) => call[0] === 'case01-report' && call[1] === 'started'),
    ).toHaveLength(3);
  });
});
