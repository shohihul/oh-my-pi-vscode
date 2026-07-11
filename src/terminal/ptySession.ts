import * as pty from "@lydell/node-pty";

import { buildPtyEnv, buildSpawnCommand } from "../spawn";

export type PtySessionOptions = {
  executable: string;
  cwd: string;
  cols: number;
  rows: number;
  onData: (data: string) => void;
  onExit: (code: number) => void;
};

export class PtySession {
  #proc: pty.IPty | null = null;
  #dataDisposable: pty.IDisposable | null = null;
  #exitDisposable: pty.IDisposable | null = null;

  spawn(opts: PtySessionOptions): void {
    this.dispose();

    const { file, args } = buildSpawnCommand(opts.executable);

    this.#proc = pty.spawn(file, args, {
      name: "xterm-256color",
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd,
      env: buildPtyEnv(),
    });

    this.#dataDisposable = this.#proc.onData(opts.onData);
    this.#exitDisposable = this.#proc.onExit(({ exitCode }) => opts.onExit(exitCode ?? 0));
  }

  write(data: string): void {
    this.#proc?.write(data);
  }

  resize(cols: number, rows: number): void {
    if (cols > 0 && rows > 0) {
      this.#proc?.resize(cols, rows);
    }
  }

  dispose(): void {
    this.#dataDisposable?.dispose();
    this.#exitDisposable?.dispose();
    this.#dataDisposable = null;
    this.#exitDisposable = null;

    if (this.#proc) {
      try {
        this.#proc.kill();
      } catch {
        // already dead
      }
      this.#proc = null;
    }
  }
}
