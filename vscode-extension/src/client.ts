/// @anchor: VSCode API — https://code.visualstudio.com/api/references/vscode-api
/// Client HTTP pour l'API Gateway KontEx.
/// Utilise le helper HTTP natif Node.js (pas de dépendance fetch).

import { httpGet, httpPost } from './http.js';

export interface KontExNode {
    id: string;
    kind: string;
    content: string;
    weight: number;
    ambiguity: number;
    anchors: ReadonlyArray<{ uri: string; sourceType: string }>;
    metadata: Record<string, string>;
    createdAt: string;
}

export interface KontExStats {
    nodeCount: number;
    linkCount: number;
    anchoredCount: number;
    anchoringRate: number;
    contradictionCount: number;
    globalEntropy: number;
}

export interface HallucinationReport {
    isHallucination: boolean;
    confidence: number;
    contradictingNodeIds: ReadonlyArray<string>;
    suggestions: ReadonlyArray<string>;
}

export interface NodeInput {
    kind: string;
    content: string;
    weight?: number;
    ambiguity?: number;
    anchors: ReadonlyArray<{ uri: string; sourceType: string }>;
}

export class KontExClient {
    private readonly baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async getHealth(): Promise<{ status: string }> {
        return httpGet(`${this.baseUrl}/health`) as Promise<{ status: string }>;
    }

    async listNodes(): Promise<{ nodes: KontExNode[]; total: number }> {
        return httpGet(`${this.baseUrl}/nodes`) as Promise<{ nodes: KontExNode[]; total: number }>;
    }

    async addNode(input: NodeInput): Promise<KontExNode> {
        return httpPost(`${this.baseUrl}/nodes`, input) as Promise<KontExNode>;
    }

    async verifyAnchoring(nodeId: string): Promise<{ isAnchored: boolean; strength: number; sourceCount: number }> {
        return httpPost(`${this.baseUrl}/nodes/${nodeId}/verify`, {}) as Promise<{ isAnchored: boolean; strength: number; sourceCount: number }>;
    }

    async detectHallucination(content: string): Promise<HallucinationReport> {
        return httpPost(`${this.baseUrl}/detect`, { content }) as Promise<HallucinationReport>;
    }

    async getStats(): Promise<KontExStats> {
        return httpGet(`${this.baseUrl}/stats`) as Promise<KontExStats>;
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.getHealth();
            return true;
        } catch {
            return false;
        }
    }
}
