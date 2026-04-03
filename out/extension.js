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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const packageScanner_1 = require("./scanner/packageScanner");
const terminalManager_1 = require("./terminal/terminalManager");
const packageTreeView_1 = require("./panel/packageTreeView");
const packageModel_1 = require("./models/packageModel");
async function activate(context) {
    console.log('npm color activating...');
    const scanner = new packageScanner_1.PackageScanner(context);
    const terminalManager = new terminalManager_1.TerminalManager(context, scanner); // ← scanner siempre pasado
    const treeProvider = new packageTreeView_1.PackageTreeProvider(scanner, terminalManager);
    const treeView = vscode.window.createTreeView('npmcolor.packagesView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
        canSelectMany: false,
    });
    const treeViewExplorer = vscode.window.createTreeView('npmcolor.packagesViewExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
        canSelectMany: false,
    });
    // ─── Commands ────────────────────────────────────────────────────────────────
    const refreshCmd = vscode.commands.registerCommand('npmcolor.refresh', async () => {
        await scanner.scanWorkspace();
        vscode.window.showInformationMessage('npm color: packages refreshed');
    });
    const runScriptCmd = vscode.commands.registerCommand('npmcolor.runScript', (item) => {
        if (item instanceof packageTreeView_1.ScriptItem)
            terminalManager.runScript(item.pkg, item.scriptName);
    });
    const stopScriptCmd = vscode.commands.registerCommand('npmcolor.stopScript', (item) => {
        if (item instanceof packageTreeView_1.ScriptItem)
            terminalManager.stopScript(item.pkg, item.scriptName);
    });
    const reloadScriptCmd = vscode.commands.registerCommand('npmcolor.reloadScript', (item) => {
        if (item instanceof packageTreeView_1.ScriptItem)
            terminalManager.reloadScript(item.pkg, item.scriptName);
    });
    const openPackageJsonCmd = vscode.commands.registerCommand('npmcolor.openPackageJson', (item) => {
        if (item instanceof packageTreeView_1.PackageItem) {
            vscode.window.showTextDocument(vscode.Uri.file(item.pkg.packageJsonPath));
        }
    });
    const stopAllCmd = vscode.commands.registerCommand('npmcolor.stopAll', () => {
        const running = terminalManager.getAllRunning();
        if (running.length === 0) {
            vscode.window.showInformationMessage('npm color: no scripts running');
            return;
        }
        terminalManager.stopAll();
        vscode.window.showInformationMessage(`npm color: stopped ${running.length} script${running.length > 1 ? 's' : ''}`);
    });
    // ─── Edit Package Meta ────────────────────────────────────────────────────────
    const editMetaCmd = vscode.commands.registerCommand('npmcolor.editPackageMeta', async (item) => {
        const pkg = item instanceof packageTreeView_1.PackageItem ? item.pkg : item;
        const meta = scanner.getMeta(pkg.name);
        // Paso 1 — Alias
        const alias = await vscode.window.showInputBox({
            prompt: `Alias para "${pkg.name}"`,
            value: meta.alias ?? pkg.name,
            placeHolder: 'Nombre personalizado (dejar vacío para usar el original)',
        });
        if (alias === undefined)
            return;
        // Paso 2 — Icono
        const iconPick = await vscode.window.showQuickPick(packageModel_1.ICON_OPTIONS, {
            placeHolder: 'Elige un icono',
        });
        if (iconPick === undefined)
            return;
        // Paso 3 — Color
        const colorPick = await vscode.window.showQuickPick(packageModel_1.COLOR_OPTIONS, {
            placeHolder: 'Elige un color',
        });
        if (colorPick === undefined)
            return;
        scanner.updateMeta(pkg.name, {
            alias: alias.trim() || undefined,
            icon: iconPick.value,
            color: colorPick.value,
        });
        // Recarga terminales activos con el nuevo icono/nombre/color
        terminalManager.reloadPackage(pkg.name);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`✅ "${pkg.name}" actualizado`);
    });
    // ─── Status Bar ──────────────────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'npmcolor.refresh';
    function updateStatusBar() {
        const packages = scanner.getPackages();
        const running = terminalManager.getAllRunning();
        if (packages.length === 0) {
            statusBar.text = '$(package) No packages';
            statusBar.tooltip = 'npm color: click to scan';
        }
        else if (running.length > 0) {
            statusBar.text = `$(circle-filled) ${running.length} running · $(package) ${packages.length} packages`;
            statusBar.tooltip = `Running: ${running.map(r => `${r.packageName}:${r.scriptName}`).join(', ')}\n\nClick to refresh`;
            statusBar.color = new vscode.ThemeColor('charts.green');
        }
        else {
            statusBar.text = `$(package) ${packages.length} packages`;
            statusBar.tooltip = `npm color: ${packages.length} packages found\nClick to refresh`;
            statusBar.color = undefined;
        }
        statusBar.show();
    }
    scanner.onDidChangePackages(updateStatusBar);
    terminalManager.onDidChangeRunning(updateStatusBar);
    // ─── Init ─────────────────────────────────────────────────────────────────────
    scanner.startWatching();
    await scanner.scanWorkspace();
    updateStatusBar();
    const packages = scanner.getPackages();
    if (packages.length > 0) {
        vscode.window.showInformationMessage(`npm color: found ${packages.length} package${packages.length > 1 ? 's' : ''} 📦`);
    }
    context.subscriptions.push(scanner, terminalManager, treeProvider, treeView, treeViewExplorer, statusBar, refreshCmd, runScriptCmd, stopScriptCmd, reloadScriptCmd, openPackageJsonCmd, stopAllCmd, editMetaCmd);
    console.log('npm color activated');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map