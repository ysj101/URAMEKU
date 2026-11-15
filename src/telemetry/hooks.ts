import { useEffect, useRef } from 'react';
import type { GameApi } from '../state/useGame';
import { observeStep, telemetryGeneration, useTelemetryStatus } from './client';
import { JourneyObserver } from './observer';

export function useOnboardingTelemetry(step: number) {
  const status = useTelemetryStatus();
  const observer = useRef(new JourneyObserver(observeStep));
  const previous = useRef(step);
  const epoch = useRef(-1);
  const active = useRef(false);
  useEffect(() => {
    if (epoch.current !== telemetryGeneration() || (step === -2 && previous.current !== -2)) {
      observer.current.reset();
      active.current = false;
      epoch.current = telemetryGeneration();
    }
    if (status === 'on' && step === -2 && !active.current) {
      observer.current.step('onboarding', 'started');
      active.current = true;
    }
    if (status === 'on' && active.current && step > previous.current) {
      const milestone = [
        'initial-choice-confirmed',
        'updated-choice-confirmed',
        'documents-reviewed',
        'report-prepared',
        'report-submitted',
      ][step + 1];
      if (milestone) observer.current.step('onboarding', milestone);
    }
    previous.current = step;
  }, [step, status]);
}

export function useCase01Telemetry(game: GameApi, resetEpoch: number, routeCaseId?: string) {
  const status = useTelemetryStatus();
  const observer = useRef(new JourneyObserver(observeStep));
  const previous = useRef({
    id: '',
    opened: [] as string[],
    published: false,
    reset: -1,
    epoch: -1,
  });
  useEffect(() => {
    const { current, progress, stage } = game;
    const before = previous.current;
    const epoch = telemetryGeneration();
    // App synchronizes URL-selected cases in an effect. Ignore its stale/default state.
    if (routeCaseId && routeCaseId !== current.id) return;
    const fresh = before.id !== current.id || before.reset !== resetEpoch || before.epoch !== epoch;
    if (fresh) observer.current.reset();
    if (status === 'on' && current.id === 'case-06') {
      if (!progress.published) {
        observer.current.step('case01-report', 'started');
        observer.current.step('case01-reading', 'started');
        if (stage === 'article') observer.current.step('case01-report', 'report-opened');
      }
      // A restored document or submitted report is never emitted as a new action.
      if (!fresh && progress.opened.some((id) => !before.opened.includes(id)))
        observer.current.step('case01-reading', 'document-opened');
      if (!fresh && !before.published && progress.published)
        observer.current.step('case01-report', 'report-submitted');
    }
    previous.current = {
      id: current.id,
      opened: [...progress.opened],
      published: progress.published,
      reset: resetEpoch,
      epoch,
    };
  }, [game, resetEpoch, status, routeCaseId]);
}
