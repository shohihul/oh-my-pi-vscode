export type TerminalMessage = {
  type: "ready" | "resize" | "input";
  data?: string;
  cols?: number;
  rows?: number;
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

  return null;
}

function validDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
