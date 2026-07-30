/// @anchor: VSCode TreeView — Statistiques TTC.
/// Affiche les métriques globales de la toile dans la sidebar.

import * as vscode from 'vscode';
import type { KontExClient, KontExStats } from './client.js';

export class StatsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly client: KontExClient;
    private stats: KontExStats | undefined;

    constructor(client: KontExClient) {
        this.client = client;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        try {
            this.stats = await this.client.getStats();
        } catch {
            const errorItem = new vscode.TreeItem('API inaccessible', vscode.TreeItemCollapsibleState.None);
            errorItem.iconPath = new vscode.ThemeIcon('$(error)');
            return [errorItem];
        }

        const s = this.stats;
        if (!s) {
            return [];
        }

        return [
            createStatItem('$(circuit-board)', `Nœuds : ${s.nodeCount}`, `${s.nodeCount} faits, règles, code, documentation`),
            createStatItem('$(link)', `Liens : ${s.linkCount}`, `${s.linkCount} relations pondérées`),
            createStatItem('$(shield)', `Ancrage : ${(s.anchoringRate * 100).toFixed(1)}%`, `${s.anchoredCount}/${s.nodeCount} nœuds ancrés (Principe A)`),
            createStatItem('$(warning)', `Contradictions : ${s.contradictionCount}`, s.contradictionCount > 0 ? '⚠️ Conflits non résolus (Principe C)' : '✓ Aucune contradiction'),
            createStatItem('$(graph-scatter)', `Entropie : ${s.globalEntropy.toFixed(3)}`, s.globalEntropy < 0.3 ? '✓ Ambiguïté sous contrôle' : '⚠️ Entropie élevée (Principe E_min)'),
        ];
    }
}

function createStatItem(icon: string, label: string, tooltip: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.tooltip = tooltip;
    return item;
}
