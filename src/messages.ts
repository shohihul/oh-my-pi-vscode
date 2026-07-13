export type TerminalMessage = {
  type: "ready" | "resize" | "input" | "openUrl" | "openFile";
  data?: string;
  cols?: number;
  rows?: number;
  uri?: string;
  path?: string;
  line?: number;
  col?: number;
};

export function parseTerminalMessage(raw: unknown): TerminalMessage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const msg = raw as Record<string, unknown>;
  const type = msg.type;

  if (type === "ready" || type === "resize") {
    if (!validDimension(msg.cols) || !validDimension(msg.rows)) {
      return null;
    }
    return {
      type,
      cols: msg.cols,
      rows: msg.rows,
    };
  }

  if (type === "input") {
    if (typeof msg.data !== "string") {
      return null;
    }
    return { type: "input", data: msg.data };
  }

  if (type === "openUrl") {
    if (typeof msg.uri !== "string" || msg.uri.length === 0) {
      return null;
    }
    return { type: "openUrl", uri: msg.uri };
  }

  if (type === "openFile") {
    if (typeof msg.path !== "string" || msg.path.length === 0) {
      return null;
    }
    const line = validOptionalPositiveInt(msg.line);
    const col = validOptionalPositiveInt(msg.col);
    return { type: "openFile", path: msg.path, line, col };
  }

  return null;
}

function validDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validOptionalPositiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : undefined;
}
