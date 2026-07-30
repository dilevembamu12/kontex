/// @anchor: VSCode Extension API — https://code.visualstudio.com/api
/// Extension KontEx — Vibe Coding sans hallucination.
///
/// Active la sidebar Toile TTC, les commandes de vérification,
/// et la barre de statut avec l'indicateur de confiance.

import * as vscode from 'vscode';
import { WebTreeProvider } from './sidebar.js';
import { StatsTreeProvider } from './statsView.js';
import { KontExClient } from './client.js';
import { updateStatusBar, createStatusBarItem } from './statusBar.js';

// État global de l'extension
let client: KontExClient | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('kontex');
    const apiUrl = config.get<string>('apiUrl', 'http://localhost:3000');

    client = new KontExClient(apiUrl);

    console.log(`[KontEx] Extension activée — API: ${apiUrl}`);

    // --- StatusBar ---
    statusBarItem = createStatusBarItem();
    context.subscriptions.push(statusBarItem);
    refreshStatusBar();

    // --- Sidebar: Toile contextuelle ---
    const webProvider = new WebTreeProvider(client);
    const webTreeView = vscode.window.createTreeView('kontex.webView', {
        treeDataProvider: webProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(webTreeView);

    // --- Sidebar: Statistiques ---
    const statsProvider = new StatsTreeProvider(client);
    const statsTreeView = vscode.window.createTreeView('kontex.statsView', {
        treeDataProvider: statsProvider,
    });
    context.subscriptions.push(statsTreeView);

    // --- Commandes ---
    context.subscriptions.push(
        vscode.commands.registerCommand('kontex.verifyHallucination', async () => {
            await verifyHallucinationCommand();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kontex.anchorSelection', async () => {
            await anchorSelectionCommand();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kontex.openDashboard', () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:3001'));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kontex.showStats', async () => {
            await showStatsCommand();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kontex.refreshWeb', () => {
            webProvider.refresh();
            statsProvider.refresh();
            refreshStatusBar();
        }),
    );

    // --- Auto-vérification à la sauvegarde ---
    const autoVerify = config.get<boolean>('autoVerifyOnSave', false);
    if (autoVerify) {
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async () => {
                await verifyCurrentDocument();
            }),
        );
    }
}

export function deactivate(): void {
    console.log('[KontEx] Extension désactivée');
}

// ============================================================
// Commandes
// ============================================================

async function verifyHallucinationCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage('KontEx : aucun éditeur actif.');
        return;
    }

    const selection = editor.selection;
    const text = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);

    if (!text || text.trim().length === 0) {
        void vscode.window.showWarningMessage('KontEx : aucun texte à vérifier.');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'KontEx : analyse de la toile TTC...',
            cancellable: false,
        },
        async () => {
            try {
                if (!client) {
                    throw new Error('Client non initialisé');
                }
                const report = await client.detectHallucination(text);

                const config = vscode.workspace.getConfiguration('kontex');
                const threshold = config.get<number>('confidenceThreshold', 0.7);

                if (report.isHallucination) {
                    const suggestion = report.suggestions.length > 0
                        ? `\n\nSuggestions :\n${report.suggestions.map((s: string) => `• ${s}`).join('\n')}`
                        : '';

                    void vscode.window.showWarningMessage(
                        `⚠️ Hallucination détectée (confiance: ${(report.confidence * 100).toFixed(0)}%)` +
                        `\n${report.contradictingNodeIds.length} nœud(s) en contradiction.${suggestion}`,
                        { modal: false },
                        'Voir le dashboard',
                    ).then((action) => {
                        if (action === 'Voir le dashboard') {
                            void vscode.env.openExternal(vscode.Uri.parse('http://localhost:3001'));
                        }
                    });
                } else if (report.confidence >= threshold) {
                    void vscode.window.showInformationMessage(
                        `✅ Cohérent avec la toile TTC (confiance: ${(report.confidence * 100).toFixed(0)}%)`,
                    );
                } else {
                    void vscode.window.showInformationMessage(
                        `🟡 Confiance faible (${(report.confidence * 100).toFixed(0)}%) — enrichir la toile.`,
                    );
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`KontEx : échec de la vérification — ${message}`);
            }
        },
    );
}

async function anchorSelectionCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage('KontEx : aucun éditeur actif.');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        void vscode.window.showWarningMessage('KontEx : sélectionnez du texte à ancrer.');
        return;
    }

    const text = editor.document.getText(selection);
    const fileName = editor.document.fileName;

    const sourceType = await vscode.window.showQuickPick(
        [
            { label: '📄 Code Repository', description: 'code_repository' },
            { label: '📋 Test Case', description: 'test_case' },
            { label: '📚 Official Documentation', description: 'official_documentation' },
            { label: '📐 Specification', description: 'specification' },
            { label: '👥 Peer Review', description: 'peer_review' },
        ],
        { placeHolder: 'Type de source d\'ancrage' },
    );

    if (!sourceType) {
        return;
    }

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'KontEx : ancrage du nœud...' },
        async () => {
            try {
                if (!client) {
                    throw new Error('Client non initialisé');
                }
                const node = await client.addNode({
                    kind: 'code',
                    content: text,
                    weight: 0.8,
                    ambiguity: 0.2,
                    anchors: [{
                        uri: `file://${fileName}`,
                        sourceType: sourceType.description,
                    }],
                });

                void vscode.window.showInformationMessage(
                    `⚓ Nœud ancré : ${node.id.slice(0, 8)}... (${text.length} caractères)`,
                );

                // Rafraîchir les vues
                void vscode.commands.executeCommand('kontex.refreshWeb');
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`KontEx : échec de l'ancrage — ${message}`);
            }
        },
    );
}

async function showStatsCommand(): Promise<void> {
    try {
        if (!client) {
            throw new Error('Client non initialisé');
        }
        const stats = await client.getStats();

        const message = [
            `🧬 Toile TTC : ${stats.nodeCount} nœuds, ${stats.linkCount} liens`,
            `⚓ Ancrage : ${(stats.anchoringRate * 100).toFixed(1)}% (${stats.anchoredCount}/${stats.nodeCount})`,
            `⚠️ Contradictions : ${stats.contradictionCount}`,
            `🔮 Entropie : ${stats.globalEntropy.toFixed(3)}`,
        ].join('\n');

        void vscode.window.showInformationMessage(message, { modal: false }, 'Dashboard').then((action) => {
            if (action === 'Dashboard') {
                void vscode.env.openExternal(vscode.Uri.parse('http://localhost:3001'));
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`KontEx : ${message}`);
    }
}

async function verifyCurrentDocument(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !client) {
        return;
    }
    const text = editor.document.getText();
    if (text.trim().length === 0) {
        return;
    }
    try {
        const report = await client.detectHallucination(text);
        await updateStatusBar(statusBarItem!, client, report.confidence);
    } catch {
        // Silencieux en auto-vérification
    }
}

async function refreshStatusBar(): Promise<void> {
    if (!statusBarItem || !client) {
        return;
    }
    try {
        const stats = await client.getStats();
        await updateStatusBar(statusBarItem, client, stats.globalEntropy < 0.3 ? 0.85 : 0.5);
    } catch {
        statusBarItem.text = '$(warning) KontEx: API inaccessible';
        statusBarItem.tooltip = 'API Gateway injoignable — vérifier http://localhost:3000/health';
    }
}
