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

/** Appends the generic fallback VS Code's terminal appends, without duplicating it. */
export function appendMonospaceFallback(family: string): string {
  return /(?:^|,)\s*monospace\s*$/i.test(family) ? family : `${family}, monospace`;
}

/**
 * Resolves the panel font the same way VS Code resolves the built-in terminal
 * font: explicit panel setting, then terminal settings, then the editor font,
 * then the platform default.
 */
export function resolveTerminalFont(sources: TerminalFontSources): TerminalFont {
  const family =
    sources.fontFamily?.trim() ||
    sources.terminalFontFamily?.trim() ||
    sources.editorFontFamily?.trim() ||
    DEFAULT_TERMINAL_FONT.family;

  const size =
    sources.fontSize || sources.terminalFontSize || DEFAULT_TERMINAL_FONT.size;

  return { family: appendMonospaceFallback(family), size };
}
