import * as vscode from 'vscode';
import { PackageInfo, RunningScript } from '../models/packageModel';
import { PackageScanner } from '../scanner/packageScanner';

export class TerminalManager {
  private _running: Map<string, RunningScript> = new Map();
  private _terminals: Map<string, vscode.Terminal> = new Map();
  private _lastRun: Map<string, Date> = new Map();
  private _onDidChangeRunning = new vscode.EventEmitter<void>();
  public readonly onDidChangeRunning = this._onDidChangeRunning.event;

  constructor(
    private context: vscode.ExtensionContext,
    private scanner?: PackageScanner
  ) {
    const stored = this.context.workspaceState.get<Record<string, string>>('npmcolor.lastRun', {});
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

  public setScanner(scanner: PackageScanner) {
    this.scanner = scanner;
  }

  public runScript(pkg: PackageInfo, scriptName: string) {
    const terminalId = `${pkg.name}::${scriptName}`;

    if (this._terminals.has(terminalId)) {
      this._terminals.get(terminalId)!.show();
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
    this.context.workspaceState.update(
      'npmcolor.lastRun',
      Object.fromEntries(Array.from(this._lastRun.entries()).map(([k, v]) => [k, v.toISOString()]))
    );

    this._onDidChangeRunning.fire();
  }

  public stopScript(pkg: PackageInfo, scriptName: string) {
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

  public reloadScript(pkg: PackageInfo, scriptName: string) {
    this.stopScript(pkg, scriptName);
    setTimeout(() => this.runScript(pkg, scriptName), 800);
  }

  /** Recarga todos los scripts corriendo de un package — llamado al editar meta */
  public reloadPackage(pkgName: string) {
    const running = this.getRunningForPackage(pkgName);
    for (const r of running) {
      const pkg = this.scanner?.getPackageByName(pkgName);
      if (pkg) this.reloadScript(pkg, r.scriptName);
    }
  }

  public stopAll() {
    for (const terminal of this._terminals.values()) {
      terminal.sendText('\x03');
      setTimeout(() => terminal.dispose(), 300);
    }
    this._running.clear();
    this._terminals.clear();
    this._onDidChangeRunning.fire();
  }

  public isRunning(packageName: string, scriptName: string): boolean {
    return this._running.has(`${packageName}::${scriptName}`);
  }

  public getRunningForPackage(packageName: string): RunningScript[] {
    return Array.from(this._running.values()).filter(r => r.packageName === packageName);
  }

  public getAllRunning(): RunningScript[] {
    return Array.from(this._running.values());
  }

  public getLastRun(packageName: string, scriptName: string): Date | undefined {
    return this._lastRun.get(`${packageName}::${scriptName}`);
  }

  private buildCommand(pkg: PackageInfo, scriptName: string): string {
    switch (pkg.packageManager) {
      case 'pnpm': return `pnpm run ${scriptName}`;
      case 'yarn': return `yarn ${scriptName}`;
      default: return `npm run ${scriptName}`;
    }
  }

  private buildWelcomeMessage(pkg: PackageInfo, scriptName: string, displayName: string): string {
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

  public dispose() {
    this._onDidChangeRunning.dispose();
  }
}
