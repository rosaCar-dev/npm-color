"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLOR_OPTIONS = exports.ICON_OPTIONS = exports.PACKAGE_COLOR_TOKENS = void 0;
// ─── Paleta de tokens de color asignados automáticamente ─────────────────────
// Usamos directamente tokens de VSCode, no hex — así el color es siempre correcto
exports.PACKAGE_COLOR_TOKENS = [
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
exports.ICON_OPTIONS = [
    { label: '$(circle-filled) Círculo', value: 'circle-filled' },
    { label: '$(rocket) Rocket', value: 'rocket' },
    { label: '$(star) Star', value: 'star' },
    { label: '$(gear) Gear', value: 'gear' },
    { label: '$(database) Database', value: 'database' },
    { label: '$(server) Server', value: 'server' },
    { label: '$(globe) Globe', value: 'globe' },
    { label: '$(layers) Layers', value: 'layers' },
];
exports.COLOR_OPTIONS = [
    { label: 'Azul', value: 'terminal.ansiBlue' },
    { label: 'Verde', value: 'terminal.ansiGreen' },
    { label: 'Rojo', value: 'terminal.ansiRed' },
    { label: 'Amarillo', value: 'terminal.ansiYellow' },
    { label: 'Morado', value: 'terminal.ansiMagenta' },
    { label: 'Cian', value: 'terminal.ansiCyan' },
    { label: 'Naranja', value: 'charts.orange' },
    { label: 'Blanco', value: 'terminal.ansiWhite' },
];
//# sourceMappingURL=packageModel.js.map