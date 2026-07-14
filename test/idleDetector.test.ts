import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { IdleDetector } from "../src/idleDetector";

describe("IdleDetector", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it("does not fire onActive or onIdle below minBytes threshold", () => {
    let active = 0;
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 256,
      idleTimeoutMs: 5000,
      onActive: () => {
        active++;
      },
      onIdle: () => {
        idle++;
      },
    });

    det.onData("hello"); // 5 bytes — typing echo
    mock.timers.tick(6000);

    assert.equal(active, 0);
    assert.equal(idle, 0);
    det.dispose();
  });

  it("fires onActive when output crosses threshold", () => {
    let active = 0;
    const det = new IdleDetector({
      minBytes: 100,
      idleTimeoutMs: 5000,
      onActive: () => {
        active++;
      },
      onIdle: () => {},
    });

    det.onData("x".repeat(150)); // exceeds threshold
    assert.equal(active, 1);

    mock.timers.tick(6000);
    det.dispose();
  });

  it("fires onActive once, then onIdle after silence", () => {
    let active = 0;
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 100,
      idleTimeoutMs: 5000,
      onActive: () => {
        active++;
      },
      onIdle: () => {
        idle++;
      },
    });

    det.onData("x".repeat(150));
    assert.equal(active, 1);
    assert.equal(idle, 0);

    mock.timers.tick(6000);
    assert.equal(active, 1);
    assert.equal(idle, 1);

    det.dispose();
  });

  it("does not fire onIdle while data keeps flowing", () => {
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 50,
      idleTimeoutMs: 5000,
      onActive: () => {},
      onIdle: () => {
        idle++;
      },
    });

    det.onData("x".repeat(60));
    mock.timers.tick(3000);
    assert.equal(idle, 0);

    det.onData("y".repeat(60)); // reschedules timer
    mock.timers.tick(3000);
    assert.equal(idle, 0);

    mock.timers.tick(3000); // total 6s since last data
    assert.equal(idle, 1);
    det.dispose();
  });

  it("accumulates bytes across multiple small chunks", () => {
    let active = 0;
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 100,
      idleTimeoutMs: 5000,
      onActive: () => {
        active++;
      },
      onIdle: () => {
        idle++;
      },
    });

    det.onData("x".repeat(40));
    det.onData("x".repeat(40));
    det.onData("x".repeat(40)); // total 120 > 100
    assert.equal(active, 1);

    mock.timers.tick(6000);
    assert.equal(idle, 1);
    det.dispose();
  });

  it("reset cancels pending notification", () => {
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 50,
      idleTimeoutMs: 5000,
      onActive: () => {},
      onIdle: () => {
        idle++;
      },
    });

    det.onData("x".repeat(60));
    det.reset();
    mock.timers.tick(6000);

    assert.equal(idle, 0);
    det.dispose();
  });

  it("detects multiple consecutive tasks", () => {
    let active = 0;
    let idle = 0;
    const det = new IdleDetector({
      minBytes: 50,
      idleTimeoutMs: 5000,
      onActive: () => {
        active++;
      },
      onIdle: () => {
        idle++;
      },
    });

    // Task 1
    det.onData("x".repeat(60));
    assert.equal(active, 1);
    mock.timers.tick(6000);
    assert.equal(idle, 1);

    // Task 2
    det.onData("y".repeat(60));
    assert.equal(active, 2);
    mock.timers.tick(6000);
    assert.equal(idle, 2);

    det.dispose();
  });

  it("isRunning reflects task state", () => {
    const det = new IdleDetector({
      minBytes: 100,
      idleTimeoutMs: 5000,
      onActive: () => {},
      onIdle: () => {},
    });

    assert.equal(det.isRunning, false);
    det.onData("x".repeat(150));
    assert.equal(det.isRunning, true);
    mock.timers.tick(6000);
    assert.equal(det.isRunning, false);
    det.dispose();
  });
});
