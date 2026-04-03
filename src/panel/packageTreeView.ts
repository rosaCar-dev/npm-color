import * as vscode from 'vscode';
import { PackageScanner } from '../scanner/packageScanner';
import { TerminalManager } from '../terminal/terminalManager';
import { PackageInfo } from '../models/packageModel';
import { PackageMeta } from '../scanner/packageScanner';


// ─── PackageItem ─────────────────────────────────────────────────────────────
export class PackageItem extends vscode.TreeItem {
  constructor(
    public readonly pkg: PackageInfo,
    private scanner: PackageScanner,
    private _isRunning: boolean = false
  ) {
    const meta = scanner.getMeta(pkg.name);
    const displayName = meta.alias ?? pkg.name;
    const colorToken = meta.color ?? pkg.colorToken;

    const iconName = meta.icon ?? 'circle-filled';

    // Estado en el label (emoji, no ThemeIcon) — va primero visualmente
    // ○ blanco = parado | ● verde = corriendo
   const statusEmoji = _isRunning ? '🟢 ' : '⚪ ';

    // label = estado + nombre
    super(`${statusEmoji}${displayName}`, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = 'package';
    this.description = pkg.relativePath === '.' ? '(root)' : pkg.relativePath;

    this.tooltip = new vscode.MarkdownString(
      `**${displayName}**\n\n` +
      `📁 \`${pkg.relativePath}\`\n\n` +
      `📦 ${pkg.packageManager}\n\n` +
      `🔧 ${Object.keys(pkg.scripts).length} scripts`
    );

    // iconPath = identidad con color — ThemeIcon igual que en terminal
    this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor(colorToken));
  }
}

// ─── ScriptItem ──────────────────────────────────────────────────────────────
export class ScriptItem extends vscode.TreeItem {
  constructor(
    public readonly pkg: PackageInfo,
    public readonly scriptName: string,
    public readonly scriptCommand: string,
    public readonly isRunning: boolean,
    public readonly startedAt?: Date,
    public readonly lastRun?: Date
  ) {
    super(scriptName, vscode.TreeItemCollapsibleState.None);

    this.contextValue = isRunning ? 'scriptRunning' : 'script';

    if (isRunning && startedAt) {
      const time = startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.description = `● run ${time}h`;
    } else if (lastRun) {
      const time = lastRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.description = `🕒 last run ${time}h`;
    } else {
      this.description = scriptCommand;
    }

    this.tooltip = new vscode.MarkdownString(
      `**${scriptName}**\n\n` +
      `\`${scriptCommand}\`\n\n` +
      (isRunning ? `🟢 Running since ${startedAt?.toLocaleTimeString() ?? ''}` : '⚪ Click ▶ to run') +
      (lastRun ? `\n\n🕒 Last run: ${lastRun.toLocaleTimeString()}` : '')
    );

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

// ─── PackageHeaderItem ───────────────────────────────────────────────────────
export class PackageHeaderItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'header';
  }
}

// ─── Tree Data Provider ───────────────────────────────────────────────────────
export class PackageTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly scanner: PackageScanner,
    private readonly terminalManager: TerminalManager
  ) {
    scanner.onDidChangePackages(() => this.refresh());
    terminalManager.onDidChangeRunning(() => this.refresh());
  }

  public refresh() { this._onDidChangeTreeData.fire(); }
  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

  public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) return this.getRootItems();
    if (element instanceof PackageItem) return this.getScriptItems(element.pkg);
    return [];
  }

  private getRootItems(): vscode.TreeItem[] {
    const packages = this.scanner.getPackages();
    if (packages.length === 0) {
      return [new PackageHeaderItem('No packages found', 'Open a workspace with package.json files')];
    }

    const running = this.terminalManager.getAllRunning();
    const items: vscode.TreeItem[] = [];

    if (running.length > 0) {
      const header = new PackageHeaderItem(
        `${running.length} script${running.length > 1 ? 's' : ''} running`,
        running.map(r => `${r.packageName} [${r.scriptName}]`).join(', ')
      );
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

  private buildPackageItem(pkg: PackageInfo): PackageItem {
    const running = this.terminalManager.getRunningForPackage(pkg.name);
    const isRunning = running.length > 0;
    const item = new PackageItem(pkg, this.scanner, isRunning);

    if (isRunning) {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      item.description = `${running.length} running · ${pkg.relativePath === '.' ? '(root)' : pkg.relativePath}`;
    }

    return item;
  }

  private getScriptItems(pkg: PackageInfo): vscode.TreeItem[] {
    const scriptNames = Object.keys(pkg.scripts);
    if (scriptNames.length === 0) {
      return [new PackageHeaderItem('No scripts defined', '')];
    }

    const sorted = [...scriptNames].sort((a, b) => {
      const aR = this.terminalManager.isRunning(pkg.name, a);
      const bR = this.terminalManager.isRunning(pkg.name, b);
      if (aR && !bR) return -1;
      if (!aR && bR) return 1;
      return a.localeCompare(b);
    });

    return sorted.map(name => {
      const running = this.terminalManager.getRunningForPackage(pkg.name).find(r => r.scriptName === name);
      const lastRun = this.terminalManager.getLastRun(pkg.name, name);
      return new ScriptItem(pkg, name, pkg.scripts[name], !!running, running?.startedAt, lastRun);
    });
  }

  public dispose() { this._onDidChangeTreeData.dispose(); }
}