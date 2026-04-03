import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  PackageInfo,
  PACKAGE_COLOR_TOKENS,
} from '../models/packageModel';

export interface PackageMeta {
  color?: string;
  alias?: string;
  icon?: string;
  lastRun?: string;
}


export class PackageScanner {
  private _packages: Map<string, PackageInfo> = new Map();
  private _watchers: vscode.FileSystemWatcher[] = [];
  private _colorIndex = 0;
  private _onDidChangePackages = new vscode.EventEmitter<void>();
  private _customColors: Record<string, string> = {};

  private _customMeta: Record<string, PackageMeta> = {};
  public readonly onDidChangePackages = this._onDidChangePackages.event;

  constructor(private context: vscode.ExtensionContext) {
    this.loadCustomColors();
    this.loadCustomMeta();
  }

  private loadCustomColors() {
    const config = vscode.workspace.getConfiguration('npmcolor');
    this._customColors = config.get<Record<string, string>>('packageColors', {});
  }

  private loadCustomMeta() {
    this._customMeta = this.context.workspaceState.get<Record<string, PackageMeta>>(
      'npmcolor.packageMeta',
      {}
    );
  }

  public getMeta(pkgName: string): PackageMeta {
    return this._customMeta[pkgName] ?? {};
  }

  public updateMeta(pkgName: string, meta: Partial<PackageMeta>) {
    this._customMeta[pkgName] = {
      ...this._customMeta[pkgName],
      ...meta,
    };
    this.context.workspaceState.update('npmcolor.packageMeta', this._customMeta);
    this._onDidChangePackages.fire();
  }

  /** Start watching workspace for package.json files */
  public startWatching() {
    // Watch for new package.json files created
    const createWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      false, // create
      true,  // change (handled separately)
      true   // delete (handled separately)
    );

    const changeWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      true,
      false, // change
      true
    );

    const deleteWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      true,
      true,
      false // delete
    );

    createWatcher.onDidCreate(uri => {
      if (!this.isExcluded(uri.fsPath)) {
        this.addPackage(uri.fsPath);
        this._onDidChangePackages.fire();
      }
    });

    changeWatcher.onDidChange(uri => {
      if (!this.isExcluded(uri.fsPath)) {
        this.addPackage(uri.fsPath); // re-reads updated scripts
        this._onDidChangePackages.fire();
      }
    });

    deleteWatcher.onDidDelete(uri => {
      this._packages.delete(uri.fsPath);
      this._onDidChangePackages.fire();
    });

    this._watchers.push(createWatcher, changeWatcher, deleteWatcher);
  }

  /** Full scan of workspace - no need to open files */
  public async scanWorkspace(): Promise<void> {
    this._packages.clear();
    this._colorIndex = 0;

     const uris = await vscode.workspace.findFiles('**/package.json');

  for (const uri of uris) {
    if (!this.isExcluded(uri.fsPath)) {
      this.addPackage(uri.fsPath);
    }
  }

  this._onDidChangePackages.fire();
  }

  private isExcluded(filePath: string): boolean {
     const excluded = [
    'node_modules',
    'dist',
    'build',
    '.git',
    'angular-webpack',
    'babel-webpack',
    'scripts',
    'vite',
    '.angular'
  ];

  return excluded.some(ex => filePath.includes(`${path.sep}${ex}${path.sep}`));
}

  private addPackage(packageJsonPath: string) {
    try {
      const raw = fs.readFileSync(packageJsonPath, 'utf-8');
      const json = JSON.parse(raw);

      const folderPath = path.dirname(packageJsonPath);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const relativePath = path.relative(workspaceRoot, folderPath) || '.';

      // Use existing color if package already registered (preserve color on re-scan)
      const existing = this._packages.get(packageJsonPath);
      const colorIdx = existing
        ? PACKAGE_COLOR_TOKENS.indexOf(existing.colorToken)
        : this._colorIndex++;

      const name = json.name || path.basename(folderPath);

      const colorToken =
        this._customColors[name] ??
        PACKAGE_COLOR_TOKENS[colorIdx % PACKAGE_COLOR_TOKENS.length];
      const packageManager = this.detectPackageManager(folderPath);

      const info: PackageInfo = {
        name,
        packageJsonPath,
        folderPath,
        relativePath,
        scripts: json.scripts ?? {},
        colorToken,
        packageManager,
      };

      this._packages.set(packageJsonPath, info);
    } catch {
      // Silently skip malformed package.json
    }
  }

  private detectPackageManager(folderPath: string): 'npm' | 'pnpm' | 'yarn' {
    const config = vscode.workspace.getConfiguration('npmcolor');
    const configured = config.get<string>('packageManager', 'auto');

    if (configured !== 'auto') {
      return configured as 'npm' | 'pnpm' | 'yarn';
    }

    if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(folderPath, 'yarn.lock'))) return 'yarn';

    // Check parent folders too (monorepo root)
    let dir = folderPath;
    for (let i = 0; i < 4; i++) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
      if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
      if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    }

    return 'npm';
  }

  public getPackages(): PackageInfo[] {
    return Array.from(this._packages.values()).sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    );
  }

  public getPackageByName(name: string): PackageInfo | undefined {
    return Array.from(this._packages.values()).find(p => p.name === name);
  }

  public dispose() {
    this._watchers.forEach(w => w.dispose());
    this._onDidChangePackages.dispose();
  }
}
