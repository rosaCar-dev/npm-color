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
exports.PackageTreeProvider = exports.PackageHeaderItem = exports.ScriptItem = exports.PackageItem = void 0;
const vscode = __importStar(require("vscode"));
// ─── PackageItem ─────────────────────────────────────────────────────────────
class PackageItem extends vscode.TreeItem {
    constructor(pkg, scanner, _isRunning = false) {
        const meta = scanner.getMeta(pkg.name);
        const displayName = meta.alias ?? pkg.name;
        const colorToken = meta.color ?? pkg.colorToken;
        const iconName = meta.icon ?? 'circle-filled';
        // Estado en el label (emoji, no ThemeIcon) — va primero visualmente
        // ○ blanco = parado | ● verde = corriendo
        const statusEmoji = _isRunning ? '🟢 ' : '⚪ ';
        // label = estado + nombre
        super(`${statusEmoji}${displayName}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.pkg = pkg;
        this.scanner = scanner;
        this._isRunning = _isRunning;
        this.contextValue = 'package';
        this.description = pkg.relativePath === '.' ? '(root)' : pkg.relativePath;
        this.tooltip = new vscode.MarkdownString(`**${displayName}**\n\n` +
            `📁 \`${pkg.relativePath}\`\n\n` +
            `📦 ${pkg.packageManager}\n\n` +
            `🔧 ${Object.keys(pkg.scripts).length} scripts`);
        // iconPath = identidad con color — ThemeIcon igual que en terminal
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor(colorToken));
    }
}
exports.PackageItem = PackageItem;
// ─── ScriptItem ──────────────────────────────────────────────────────────────
class ScriptItem extends vscode.TreeItem {
    constructor(pkg, scriptName, scriptCommand, isRunning, startedAt, lastRun) {
        super(scriptName, vscode.TreeItemCollapsibleState.None);
        this.pkg = pkg;
        this.scriptName = scriptName;
        this.scriptCommand = scriptCommand;
        this.isRunning = isRunning;
        this.startedAt = startedAt;
        this.lastRun = lastRun;
        this.contextValue = isRunning ? 'scriptRunning' : 'script';
        if (isRunning && startedAt) {
            const time = startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.description = `● run ${time}h`;
        }
        else if (lastRun) {
            const time = lastRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.description = `🕒 last run ${time}h`;
        }
        else {
            this.description = scriptCommand;
        }
        this.tooltip = new vscode.MarkdownString(`**${scriptName}**\n\n` +
            `\`${scriptCommand}\`\n\n` +
            (isRunning ? `🟢 Running since ${startedAt?.toLocaleTimeString() ?? ''}` : '⚪ Click ▶ to run') +
            (lastRun ? `\n\n🕒 Last run: ${lastRun.toLocaleTimeString()}` : ''));
        this.iconPath = isRunning
            ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('play');
        this.command = {
            command: isRunning ? 'npmcolor.stopScript' : 'npmcolor.runScript',
            title: isRunning ? 'Stop Script' : 'Run Script',
            arguments: [this],
        };
    }
}
exports.ScriptItem = ScriptItem;
// ─── PackageHeaderItem ───────────────────────────────────────────────────────
class PackageHeaderItem extends vscode.TreeItem {
    constructor(label, description) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'header';
    }
}
exports.PackageHeaderItem = PackageHeaderItem;
// ─── Tree Data Provider ───────────────────────────────────────────────────────
class PackageTreeProvider {
    constructor(scanner, terminalManager) {
        this.scanner = scanner;
        this.terminalManager = terminalManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        scanner.onDidChangePackages(() => this.refresh());
        terminalManager.onDidChangeRunning(() => this.refresh());
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }
    getChildren(element) {
        if (!element)
            return this.getRootItems();
        if (element instanceof PackageItem)
            return this.getScriptItems(element.pkg);
        return [];
    }
    getRootItems() {
        const packages = this.scanner.getPackages();
        if (packages.length === 0) {
            return [new PackageHeaderItem('No packages found', 'Open a workspace with package.json files')];
        }
        const running = this.terminalManager.getAllRunning();
        const items = [];
        if (running.length > 0) {
            const header = new PackageHeaderItem(`${running.length} script${running.length > 1 ? 's' : ''} running`, running.map(r => `${r.packageName} [${r.scriptName}]`).join(', '));
            header.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
            items.push(header);
        }
        const sorted = [...packages].sort((a, b) => {
            const aR = this.terminalManager.getRunningForPackage(a.name).length;
            const bR = this.terminalManager.getRunningForPackage(b.name).length;
            return bR - aR;
        });
        return [...items, ...sorted.map(pkg => this.buildPackageItem(pkg))];
    }
    buildPackageItem(pkg) {
        const running = this.terminalManager.getRunningForPackage(pkg.name);
        const isRunning = running.length > 0;
        const item = new PackageItem(pkg, this.scanner, isRunning);
        if (isRunning) {
            item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            item.description = `${running.length} running · ${pkg.relativePath === '.' ? '(root)' : pkg.relativePath}`;
        }
        return item;
    }
    getScriptItems(pkg) {
        const scriptNames = Object.keys(pkg.scripts);
        if (scriptNames.length === 0) {
            return [new PackageHeaderItem('No scripts defined', '')];
        }
        const sorted = [...scriptNames].sort((a, b) => {
            const aR = this.terminalManager.isRunning(pkg.name, a);
            const bR = this.terminalManager.isRunning(pkg.name, b);
            if (aR && !bR)
                return -1;
            if (!aR && bR)
                return 1;
            return a.localeCompare(b);
        });
        return sorted.map(name => {
            const running = this.terminalManager.getRunningForPackage(pkg.name).find(r => r.scriptName === name);
            const lastRun = this.terminalManager.getLastRun(pkg.name, name);
            return new ScriptItem(pkg, name, pkg.scripts[name], !!running, running?.startedAt, lastRun);
        });
    }
    dispose() { this._onDidChangeTreeData.dispose(); }
}
exports.PackageTreeProvider = PackageTreeProvider;
//# sourceMappingURL=packageTreeView.js.map