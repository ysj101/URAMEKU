/** Deduplicate milestones across rerenders/backtracking. No saved progress is replayed. */
export class JourneyObserver {
  private reached = new Set<string>();
  constructor(private send: (journey: string, step: string) => boolean) {}
  reset() {
    this.reached.clear();
  }
  step(journey: string, step: string) {
    const key = `${journey}/${step}`;
    if (!this.reached.has(key) && this.send(journey, step)) this.reached.add(key);
  }
}
