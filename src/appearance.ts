export type TerminalFont = {
  family: string;
  size: number;
};

/**
 * Last-resort font stack, mirroring the default VS Code uses for its own
 * integrated terminal when neither `terminal.integrated.fontFamily` nor
 * `editor.fontFamily` is set.
 *
 * A bare `monospace` is not a safe fallback: Chromium resolves the generic
 * family through the OS, which on a zh-CN Windows install is NSimSun. Such a
 * font reports full-width advances for box-drawing and Nerd Font private-use
 * glyphs while xterm.js lays those out as single cells, so borders, bullets and
 * icons come out clipped and misaligned.
 */
const PLATFORM_MONOSPACE_FONT =
  process.platform === "darwin"
    ? "Menlo, Monaco, 'Courier New', monospace"
    : process.platform === "linux"
      ? "'Droid Sans Mono', monospace"
      : "Consolas, 'Courier New', monospace";

export const DEFAULT_TERMINAL_FONT: TerminalFont = {
  family: PLATFORM_MONOSPACE_FONT,
  size: 14,
};

export type TerminalFontSources = {
  /** `ohMyPi.fontFamily` — explicit panel override. */
  fontFamily?: string;
  /** `ohMyPi.fontSize` — explicit panel override; `0` means "inherit". */
  fontSize?: number;
  /** `terminal.integrated.fontFamily`. */
  terminalFontFamily?: string;
  /** `terminal.integrated.fontSize`. */
  terminalFontSize?: number;
  /** `editor.fontFamily`. */
  editorFontFamily?: string;
};

function isMonospaceSegment(segment: string): boolean {
  return /^monospace$/i.test(segment);
}

/**
 * Normalizes a configured font stack and appends the generic fallback VS Code's
 * terminal appends, without duplicating it. Splitting and rejoining matters:
 * a raw `${family}, monospace` turns `"Consolas,"` into
 * `"Consolas,, monospace"`, which Chromium can reject outright.
 */
export function appendMonospaceFallback(family: string): string {
  const segments: string[] = [];
  for (const raw of family.split(",")) {
    const segment = raw.trim();
    if (!segment) {
      continue;
    }
    // Keep the first `monospace` and drop later duplicates (any casing).
    if (isMonospaceSegment(segment) && segments.some(isMonospaceSegment)) {
      continue;
    }
    segments.push(segment);
  }

  if (segments.length === 0) {
    return "monospace";
  }

  if (!isMonospaceSegment(segments[segments.length - 1])) {
    segments.push("monospace");
  }

  return segments.join(", ");
}

/**
 * A configured family is only usable when something besides separators,
 * whitespace and quotes is left. `","` and `"''"` are truthy strings but carry
 * no font, so they must not shadow the next source.
 */
function isUsableFamily(family: string | undefined): family is string {
  return typeof family === "string" && /[^\s,'"]/.test(family);
}

/** Only a finite, positive number is a usable size; `0` means "inherit". */
function isUsableFontSize(size: unknown): size is number {
  return typeof size === "number" && Number.isFinite(size) && size > 0;
}

/**
 * Resolves the panel font the same way VS Code resolves the built-in terminal
 * font: explicit panel setting, then terminal settings, then the editor font,
 * then the platform default.
 */
export function resolveTerminalFont(sources: TerminalFontSources): TerminalFont {
  const configuredFamily = [
    sources.fontFamily,
    sources.terminalFontFamily,
    sources.editorFontFamily,
  ].find(isUsableFamily);
  const family = configuredFamily?.trim() || DEFAULT_TERMINAL_FONT.family;

  const size =
    [sources.fontSize, sources.terminalFontSize].find(isUsableFontSize) ??
    DEFAULT_TERMINAL_FONT.size;

  return { family: appendMonospaceFallback(family), size };
}
