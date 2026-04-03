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
exports.PackageScanner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const packageModel_1 = require("../models/packageModel");
class PackageScanner {
    constructor(context) {
        this.context = context;
        this._packages = new Map();
        this._watchers = [];
        this._colorIndex = 0;
        this._onDidChangePackages = new vscode.EventEmitter();
        this._customColors = {};
        this._customMeta = {};
        this.onDidChangePackages = this._onDidChangePackages.event;
        this.loadCustomColors();
        this.loadCustomMeta();
    }
    loadCustomColors() {
        const config = vscode.workspace.getConfiguration('npmcolor');
        this._customColors = config.get('packageColors', {});
    }
    loadCustomMeta() {
        this._customMeta = this.context.workspaceState.get('npmcolor.packageMeta', {});
    }
    getMeta(pkgName) {
        return this._customMeta[pkgName] ?? {};
    }
    updateMeta(pkgName, meta) {
        this._customMeta[pkgName] = {
            ...this._customMeta[pkgName],
            ...meta,
        };
        this.context.workspaceState.update('npmcolor.packageMeta', this._customMeta);
        this._onDidChangePackages.fire();
    }
    /** Start watching workspace for package.json files */
    startWatching() {
        // Watch for new package.json files created
        const createWatcher = vscode.workspace.createFileSystemWatcher('**/package.json', false, // create
        true, // change (handled separately)
        true // delete (handled separately)
        );
        const changeWatcher = vscode.workspace.createFileSystemWatcher('**/package.json', true, false, // change
        true);
        const deleteWatcher = vscode.workspace.createFileSystemWatcher('**/package.json', true, true, false // delete
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
    async scanWorkspace() {
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
    isExcluded(filePath) {
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
    addPackage(packageJsonPath) {
        try {
            const raw = fs.readFileSync(packageJsonPath, 'utf-8');
            const json = JSON.parse(raw);
            const folderPath = path.dirname(packageJsonPath);
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            const relativePath = path.relative(workspaceRoot, folderPath) || '.';
            // Use existing color if package already registered (preserve color on re-scan)
            const existing = this._packages.get(packageJsonPath);
            const colorIdx = existing
                ? packageModel_1.PACKAGE_COLOR_TOKENS.indexOf(existing.colorToken)
                : this._colorIndex++;
            const name = json.name || path.basename(folderPath);
            const colorToken = this._customColors[name] ??
                packageModel_1.PACKAGE_COLOR_TOKENS[colorIdx % packageModel_1.PACKAGE_COLOR_TOKENS.length];
            const packageManager = this.detectPackageManager(folderPath);
            const info = {
                name,
                packageJsonPath,
                folderPath,
                relativePath,
                scripts: json.scripts ?? {},
                colorToken,
                packageManager,
            };
            this._packages.set(packageJsonPath, info);
        }
        catch {
            // Silently skip malformed package.json
        }
    }
    detectPackageManager(folderPath) {
        const config = vscode.workspace.getConfiguration('npmcolor');
        const configured = config.get('packageManager', 'auto');
        if (configured !== 'auto') {
            return configured;
        }
        if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml')))
            return 'pnpm';
        if (fs.existsSync(path.join(folderPath, 'yarn.lock')))
            return 'yarn';
        // Check parent folders too (monorepo root)
        let dir = folderPath;
        for (let i = 0; i < 4; i++) {
            const parent = path.dirname(dir);
            if (parent === dir)
                break;
            dir = parent;
            if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml')))
                return 'pnpm';
            if (fs.existsSync(path.join(dir, 'yarn.lock')))
                return 'yarn';
        }
        return 'npm';
    }
    getPackages() {
        return Array.from(this._packages.values()).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }
    getPackageByName(name) {
        return Array.from(this._packages.values()).find(p => p.name === name);
    }
    dispose() {
        this._watchers.forEach(w => w.dispose());
        this._onDidChangePackages.dispose();
    }
}
exports.PackageScanner = PackageScanner;
//# sourceMappingURL=packageScanner.js.map