"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalManager = void 0;
const vscode = __importStar(require("vscode"));
class TerminalManager {
    constructor(context, scanner) {
        this.context = context;
        this.scanner = scanner;
        this._running = new Map();
        this._terminals = new Map();
        this._lastRun = new Map();
        this._onDidChangeRunning = new vscode.EventEmitter();
        this.onDidChangeRunning = this._onDidChangeRunning.event;
        const stored = this.context.workspaceState.get('npmcolor.lastRun', {});
        for (const key in stored) {
            this._lastRun.set(key, new Date(stored[key]));
        }
        vscode.window.onDidCloseTerminal(terminal => {
            for (const [id, t] of this._terminals) {
                if (t === terminal) {
                    this._running.delete(id);
                    this._terminals.delete(id);
                    this._onDidChangeRunning.fire();
                    break;
                }
            }
        });
    }
    setScanner(scanner) {
        this.scanner = scanner;
    }
    runScript(pkg, scriptName) {
        const terminalId = `${pkg.name}::${scriptName}`;
        if (this._terminals.has(terminalId)) {
            this._terminals.get(terminalId).show();
            return;
        }
        const command = this.buildCommand(pkg, scriptName);
        const meta = this.scanner?.getMeta(pkg.name) ?? {};
        const displayName = meta.alias ?? pkg.name;
        const colorToken = meta.color ?? pkg.colorToken;
        const iconName = meta.icon ?? 'circle-filled';
        // Formato: [script] nombre — mismo icono+color que el panel
        const label = `[${scriptName}] ${displayName}`;
        const terminal = vscode.window.createTerminal({
            name: label,
            cwd: pkg.folderPath,
            color: new vscode.ThemeColor(colorToken),
            iconPath: new vscode.ThemeIcon(iconName, new vscode.ThemeColor(colorToken)),
            env: { PACKAGE_LENS_NAME: pkg.name },
            message: this.buildWelcomeMessage(pkg, scriptName, displayName),
        });
        terminal.show();
        terminal.sendText(command);
        this._running.set(terminalId, {
            packageName: pkg.name,
            scriptName,
            terminalId,
            startedAt: new Date(),
        });
        this._terminals.set(terminalId, terminal);
        this._lastRun.set(terminalId, new Date());
        this.context.workspaceState.update('npmcolor.lastRun', Object.fromEntries(Array.from(this._lastRun.entries()).map(([k, v]) => [k, v.toISOString()])));
        this._onDidChangeRunning.fire();
    }
    stopScript(pkg, scriptName) {
        const terminalId = `${pkg.name}::${scriptName}`;
        const terminal = this._terminals.get(terminalId);
        if (terminal) {
            terminal.sendText('\x03');
            setTimeout(() => {
                terminal.dispose();
                this._running.delete(terminalId);
                this._terminals.delete(terminalId);
                this._onDidChangeRunning.fire();
            }, 500);
        }
    }
    reloadScript(pkg, scriptName) {
        this.stopScript(pkg, scriptName);
        setTimeout(() => this.runScript(pkg, scriptName), 800);
    }
    /** Recarga todos los scripts corriendo de un package — llamado al editar meta */
    reloadPackage(pkgName) {
        const running = this.getRunningForPackage(pkgName);
        for (const r of running) {
            const pkg = this.scanner?.getPackageByName(pkgName);
            if (pkg)
                this.reloadScript(pkg, r.scriptName);
        }
    }
    stopAll() {
        for (const terminal of this._terminals.values()) {
            terminal.sendText('\x03');
            setTimeout(() => terminal.dispose(), 300);
        }
        this._running.clear();
        this._terminals.clear();
        this._onDidChangeRunning.fire();
    }
    isRunning(packageName, scriptName) {
        return this._running.has(`${packageName}::${scriptName}`);
    }
    getRunningForPackage(packageName) {
        return Array.from(this._running.values()).filter(r => r.packageName === packageName);
    }
    getAllRunning() {
        return Array.from(this._running.values());
    }
    getLastRun(packageName, scriptName) {
        return this._lastRun.get(`${packageName}::${scriptName}`);
    }
    buildCommand(pkg, scriptName) {
        switch (pkg.packageManager) {
            case 'pnpm': return `pnpm run ${scriptName}`;
            case 'yarn': return `yarn ${scriptName}`;
            default: return `npm run ${scriptName}`;
        }
    }
    buildWelcomeMessage(pkg, scriptName, displayName) {
        const divider = '─'.repeat(50);
        return [
            '', divider,
            `  ${displayName}`,
            `  📁 ${pkg.relativePath}`,
            `  ▶  ${this.buildCommand(pkg, scriptName)}`,
            `  🕐 Started at ${new Date().toLocaleTimeString()}`,
            divider, '',
        ].join('\n');
    }
    dispose() {
        this._onDidChangeRunning.dispose();
    }
}
exports.TerminalManager = TerminalManager;
//# sourceMappingURL=terminalManager.js.map