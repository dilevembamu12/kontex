/// @anchor: VSCode StatusBar API — https://code.visualstudio.com/api/extension-guides/statusbar
/// Barre de statut KontEx : indicateur de confiance TTC.

import * as vscode from 'vscode';
import type { KontExClient } from './client.js';

let currentConfidence = 0.85;

export function createStatusBarItem(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );
    item.command = 'kontex.showStats';
    item.text = '$(graph) KontEx TTC';
    item.tooltip = 'KontEx — TTC v1.1 / MCW-2\nCliquer pour les statistiques';
    item.show();
    return item;
}

export async function updateStatusBar(
    item: vscode.StatusBarItem,
    _client: KontExClient,
    confidence?: number,
): Promise<void> {
    if (confidence !== undefined) {
        currentConfidence = confidence;
    }

    const pct = (currentConfidence * 100).toFixed(0);
    let icon: string;

    if (currentConfidence >= 0.85) {
        icon = '$(pass-filled)';
    } else if (currentConfidence >= 0.5) {
        icon = '$(warning)';
    } else {
        icon = '$(error)';
    }

    item.text = `${icon} TTC ${pct}%`;
    item.tooltip = [
        `KontEx TTC v1.1 / MCW-2`,
        `Confiance toile : ${pct}%`,
        `Benchmark : 9/10 (90%)`,
        '',
        'Cliquer pour les statistiques',
    ].join('\n');
}
