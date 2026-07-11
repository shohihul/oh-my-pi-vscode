export type TerminalFont = {
  family: string;
  size: number;
};

export type TerminalAppearance = {
  font: TerminalFont;
};

export const DEFAULT_TERMINAL_FONT: TerminalFont = {
  family: "monospace",
  size: 14,
};
