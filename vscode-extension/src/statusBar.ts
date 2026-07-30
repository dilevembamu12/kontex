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
    item.text = '$(pulse) KontEx';
    item.tooltip = 'KontEx — Vibe Coding sans hallucination\nCliquer pour voir les statistiques';
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

    let icon: string;
    let label: string;

    if (currentConfidence >= 0.85) {
        icon = '$(check)';
        label = `TTC ${(currentConfidence * 100).toFixed(0)}%`;
    } else if (currentConfidence >= 0.7) {
        icon = '$(warning)';
        label = `TTC ${(currentConfidence * 100).toFixed(0)}%`;
    } else if (currentConfidence >= 0.4) {
        icon = '$(error)';
        label = `TTC ${(currentConfidence * 100).toFixed(0)}%`;
    } else {
        icon = '$(circle-slash)';
        label = `TTC ${(currentConfidence * 100).toFixed(0)}%`;
    }

    item.text = `${icon} ${label}`;
    item.tooltip = [
        `Confiance TTC : ${(currentConfidence * 100).toFixed(0)}%`,
        currentConfidence >= 0.85 ? '✅ Cohérent avec la toile' :
        currentConfidence >= 0.7 ? '🟡 Quelques divergences' :
        '🔴 Hallucinations probables',
        '',
        'Cliquer pour les statistiques détaillées',
    ].join('\n');
}
