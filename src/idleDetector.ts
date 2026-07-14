export type IdleDetectorOptions = {
  /** Minimum accumulated bytes of PTY output before a burst qualifies as a task. */
  minBytes: number;
  /** Milliseconds of output silence before a running task is considered complete. */
  idleTimeoutMs: number;
  /** Called once when accumulated output first exceeds minBytes. */
  onActive: () => void;
  /** Called once when a task that exceeded minBytes goes idle. */
  onIdle: () => void;
};

/**
 * Detects when a long-running omp task finishes by tracking PTY output volume.
 *
 * Small bursts (typing echoes) stay below `minBytes` and never trigger a
 * notification. Once accumulated output crosses the threshold the detector
 * considers a task "running"; when output falls silent for `idleTimeoutMs`
 * it fires `onIdle` exactly once, then resets.
 */
export class IdleDetector {
  readonly #minBytes: number;
  readonly #idleTimeoutMs: number;
  readonly #onActive: () => void;
  readonly #onIdle: () => void;
  #bytesSinceIdle = 0;
  #taskRunning = false;
  #timer: NodeJS.Timeout | undefined;

  constructor(opts: IdleDetectorOptions) {
    this.#minBytes = opts.minBytes;
    this.#idleTimeoutMs = opts.idleTimeoutMs;
    this.#onActive = opts.onActive;
    this.#onIdle = opts.onIdle;
  }

  /** Feed a chunk of PTY output into the detector. */
  onData(data: string): void {
    this.#bytesSinceIdle += data.length;

    if (!this.#taskRunning && this.#bytesSinceIdle >= this.#minBytes) {
      this.#taskRunning = true;
      this.#onActive();
    }

    this.#scheduleIdleCheck();
  }
  /** Whether a task is currently producing output above the threshold. */
  get isRunning(): boolean {
    return this.#taskRunning;
  }

  /** Clear all state — call on PTY restart, exit, or view dispose. */
  reset(): void {
    this.#bytesSinceIdle = 0;
    this.#taskRunning = false;

    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  dispose(): void {
    this.reset();
  }

  #scheduleIdleCheck(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
    }

    this.#timer = setTimeout(() => {
      this.#timer = undefined;

      const wasTask = this.#taskRunning;
      this.#taskRunning = false;
      this.#bytesSinceIdle = 0;

      if (wasTask) {
        this.#onIdle();
      }
    }, this.#idleTimeoutMs);
  }
}
