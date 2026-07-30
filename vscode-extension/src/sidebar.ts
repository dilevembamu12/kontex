/// @anchor: VSCode TreeView API — https://code.visualstudio.com/api/extension-guides/tree-view
/// Sidebar : Toile contextuelle TTC.
/// Affiche les nœuds et liens de la toile dans l'explorateur VSCode.

import * as vscode from 'vscode';
import type { KontExClient, KontExNode } from './client.js';

const KIND_ICONS: Record<string, string> = {
    fact: '$(symbol-boolean)',
    rule: '$(symbol-ruler)',
    code: '$(symbol-method)',
    documentation: '$(book)',
};

const KIND_LABELS: Record<string, string> = {
    fact: 'Fait',
    rule: 'Règle',
    code: 'Code',
    documentation: 'Documentation',
};

/**
 * Élément d'arbre représentant un nœud de la toile.
 */
export class NodeItem extends vscode.TreeItem {
    constructor(
        public readonly node: KontExNode,
    ) {
        super(
            `${node.content.slice(0, 60)}${node.content.length > 60 ? '…' : ''}`,
            vscode.TreeItemCollapsibleState.None,
        );

        this.description = `${KIND_LABELS[node.kind] ?? node.kind} · ⚓${node.anchors.length} · ⚖️${node.weight.toFixed(1)} · 🔮${node.ambiguity.toFixed(2)}`;
        this.iconPath = new vscode.ThemeIcon(KIND_ICONS[node.kind] ?? '$(circle)');
        this.tooltip = [
            `ID : ${node.id}`,
            `Type : ${KIND_LABELS[node.kind] ?? node.kind}`,
            `Contenu : ${node.content}`,
            `Poids : ${node.weight.toFixed(2)}`,
            `Ambigüité : ${node.ambiguity.toFixed(2)}`,
            `Ancres : ${node.anchors.map((a) => a.uri).join(', ')}`,
            `Créé le : ${node.createdAt}`,
        ].join('\n');

        this.contextValue = 'kontexNode';
    }
}

/**
 * Fournisseur de données pour la vue « Toile contextuelle ».
 */
export class WebTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly client: KontExClient;
    private nodes: KontExNode[] = [];
    private errorMessage: string | undefined;

    constructor(client: KontExClient) {
        this.client = client;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return []; // Pas de sous-enfants pour l'instant
        }

        try {
            const result = await this.client.listNodes();
            this.nodes = result.nodes;
            this.errorMessage = undefined;
        } catch (error: unknown) {
            this.errorMessage = error instanceof Error ? error.message : String(error);
            this.nodes = [];
        }

        if (this.errorMessage) {
            const errorItem = new vscode.TreeItem(
                `⚠️ API inaccessible : ${this.errorMessage}`,
                vscode.TreeItemCollapsibleState.None,
            );
            errorItem.iconPath = new vscode.ThemeIcon('$(error)');
            return [errorItem];
        }

        if (this.nodes.length === 0) {
            const emptyItem = new vscode.TreeItem(
                'Aucun nœud dans la toile',
                vscode.TreeItemCollapsibleState.None,
            );
            emptyItem.iconPath = new vscode.ThemeIcon('$(info)');
            emptyItem.description = 'Utilisez "Ancrer la sélection" pour ajouter un nœud';
            return [emptyItem];
        }

        // Groupe par type de nœud
        const grouped = new Map<string, KontExNode[]>();
        for (const node of this.nodes) {
            const kind = node.kind ?? 'unknown';
            if (!grouped.has(kind)) {
                grouped.set(kind, []);
            }
            grouped.get(kind)!.push(node);
        }

        const items: vscode.TreeItem[] = [];
        for (const [kind, kindNodes] of grouped) {
            const groupLabel = `${KIND_LABELS[kind] ?? kind}s (${kindNodes.length})`;
            const groupItem = new vscode.TreeItem(groupLabel, vscode.TreeItemCollapsibleState.Expanded);
            groupItem.iconPath = new vscode.ThemeIcon(KIND_ICONS[kind] ?? '$(folder)');
            items.push(groupItem);

            for (const node of kindNodes) {
                const nodeItem = new NodeItem(node);
                items.push(nodeItem);
            }
        }

        return items;
    }
}
