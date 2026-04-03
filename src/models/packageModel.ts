export interface PackageInfo {
  /** Display name from package.json "name" field */
  name: string;
  /** Absolute path to the package.json file */
  packageJsonPath: string;
  /** Absolute path to the package folder */
  folderPath: string;
  /** Relative path from workspace root (for display) */
  relativePath: string;
  /** Scripts defined in package.json */
  scripts: Record<string, string>;
  /** Assigned color token for this package (ThemeColor token) */
  colorToken: string;
  /** Package manager detected for this package */
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

export interface RunningScript {
  packageName: string;
  scriptName: string;
  terminalId: string;
  startedAt: Date;
}

// ─── Paleta de tokens de color asignados automáticamente ─────────────────────
// Usamos directamente tokens de VSCode, no hex — así el color es siempre correcto
export const PACKAGE_COLOR_TOKENS = [
  'terminal.ansiBlue',
  'terminal.ansiGreen',
  'terminal.ansiRed',
  'terminal.ansiYellow',
  'terminal.ansiMagenta',
  'terminal.ansiCyan',
  'charts.orange',
  'terminal.ansiBrightBlue',
  'terminal.ansiBrightGreen',
  'terminal.ansiBrightRed',
  'terminal.ansiBrightYellow',
  'terminal.ansiBrightCyan',
  'terminal.ansiBrightMagenta',
  'terminal.ansiWhite',
  'charts.yellow',
];

// ─── Opciones de UI para el diálogo de edición ───────────────────────────────
export const ICON_OPTIONS = [
  { label: '$(circle-filled) Círculo', value: 'circle-filled' },
  { label: '$(rocket) Rocket',         value: 'rocket' },
  { label: '$(star) Star',             value: 'star' },
  { label: '$(gear) Gear',             value: 'gear' },
  { label: '$(database) Database',     value: 'database' },
  { label: '$(server) Server',         value: 'server' },
  { label: '$(globe) Globe',           value: 'globe' },
  { label: '$(layers) Layers',         value: 'layers' },
];

export const COLOR_OPTIONS = [
  { label: 'Azul',     value: 'terminal.ansiBlue' },
  { label: 'Verde',    value: 'terminal.ansiGreen' },
  { label: 'Rojo',     value: 'terminal.ansiRed' },
  { label: 'Amarillo', value: 'terminal.ansiYellow' },
  { label: 'Morado',   value: 'terminal.ansiMagenta' },
  { label: 'Cian',     value: 'terminal.ansiCyan' },
  { label: 'Naranja',  value: 'charts.orange' },
  { label: 'Blanco',   value: 'terminal.ansiWhite' },
];
