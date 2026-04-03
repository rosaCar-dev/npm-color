import * as vscode from 'vscode';
import { PackageScanner } from './scanner/packageScanner';
import { TerminalManager } from './terminal/terminalManager';
import { PackageTreeProvider, PackageItem, ScriptItem } from './panel/packageTreeView';
import { ICON_OPTIONS, COLOR_OPTIONS } from './models/packageModel';

export async function activate(context: vscode.ExtensionContext) {
  console.log('npm color activating...');

  const scanner = new PackageScanner(context);
  const terminalManager = new TerminalManager(context, scanner); // ← scanner siempre pasado
  const treeProvider = new PackageTreeProvider(scanner, terminalManager);

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

  const runScriptCmd = vscode.commands.registerCommand('npmcolor.runScript', (item: ScriptItem) => {
    if (item instanceof ScriptItem) terminalManager.runScript(item.pkg, item.scriptName);
  });

  const stopScriptCmd = vscode.commands.registerCommand('npmcolor.stopScript', (item: ScriptItem) => {
    if (item instanceof ScriptItem) terminalManager.stopScript(item.pkg, item.scriptName);
  });

  const reloadScriptCmd = vscode.commands.registerCommand('npmcolor.reloadScript', (item: ScriptItem) => {
    if (item instanceof ScriptItem) terminalManager.reloadScript(item.pkg, item.scriptName);
  });

  const openPackageJsonCmd = vscode.commands.registerCommand('npmcolor.openPackageJson', (item: PackageItem) => {
    if (item instanceof PackageItem) {
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
    vscode.window.showInformationMessage(
      `npm color: stopped ${running.length} script${running.length > 1 ? 's' : ''}`
    );
  });

  // ─── Edit Package Meta ────────────────────────────────────────────────────────
  const editMetaCmd = vscode.commands.registerCommand(
    'npmcolor.editPackageMeta',
    async (item: PackageItem) => {
      const pkg = item instanceof PackageItem ? item.pkg : item as any;
      const meta = scanner.getMeta(pkg.name);

      // Paso 1 — Alias
      const alias = await vscode.window.showInputBox({
        prompt: `Alias para "${pkg.name}"`,
        value: meta.alias ?? pkg.name,
        placeHolder: 'Nombre personalizado (dejar vacío para usar el original)',
      });
      if (alias === undefined) return;

      // Paso 2 — Icono
      const iconPick = await vscode.window.showQuickPick(ICON_OPTIONS, {
        placeHolder: 'Elige un icono',
      });
      if (iconPick === undefined) return;

      // Paso 3 — Color
      const colorPick = await vscode.window.showQuickPick(COLOR_OPTIONS, {
        placeHolder: 'Elige un color',
      });
      if (colorPick === undefined) return;

      scanner.updateMeta(pkg.name, {
        alias: alias.trim() || undefined,
        icon: iconPick.value,
        color: colorPick.value,
      });

      // Recarga terminales activos con el nuevo icono/nombre/color
      terminalManager.reloadPackage(pkg.name);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`✅ "${pkg.name}" actualizado`);
    }
  );

  // ─── Status Bar ──────────────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'npmcolor.refresh';

  function updateStatusBar() {
    const packages = scanner.getPackages();
    const running = terminalManager.getAllRunning();

    if (packages.length === 0) {
      statusBar.text = '$(package) No packages';
      statusBar.tooltip = 'npm color: click to scan';
    } else if (running.length > 0) {
      statusBar.text = `$(circle-filled) ${running.length} running · $(package) ${packages.length} packages`;
      statusBar.tooltip = `Running: ${running.map(r => `${r.packageName}:${r.scriptName}`).join(', ')}\n\nClick to refresh`;
      statusBar.color = new vscode.ThemeColor('charts.green');
    } else {
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
    vscode.window.showInformationMessage(
      `npm color: found ${packages.length} package${packages.length > 1 ? 's' : ''} 📦`
    );
  }

  context.subscriptions.push(
    scanner, terminalManager, treeProvider,
    treeView, treeViewExplorer, statusBar,
    refreshCmd, runScriptCmd, stopScriptCmd,
    reloadScriptCmd, openPackageJsonCmd, stopAllCmd, editMetaCmd,
  );

  console.log('npm color activated');
}

export function deactivate() {}
