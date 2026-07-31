/// @anchor: Client API pour le dashboard KontEx.
/// Utilise fetch() pour communiquer avec l'API Gateway Express.

const API_BASE = 'http://localhost:3000';

export interface KontExNode {
  id: string;
  kind: string;
  content: string;
  weight: number;
  ambiguity: number;
  anchors: Array<{ uri: string; sourceType: string }>;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface KontExLink {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
  relevanceScore: number;
  createdAt: string;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  components: Array<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs: number;
    message: string;
  }>;
}

export interface KontExStats {
  nodeCount: number;
  linkCount: number;
  anchoredCount: number;
  anchoringRate: number;
  contradictionCount: number;
  globalEntropy: number;
}

export interface AnchorVerification {
  isAnchored: boolean;
  strength: number;
  sourceCount: number;
  missingCategories: string[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => apiFetch<HealthReport>('/health'),
  getStats: () => apiFetch<KontExStats>('/stats'),
  getNodes: () => apiFetch<{ nodes: KontExNode[]; total: number }>('/nodes'),
  getLinks: () => apiFetch<{ links: KontExLink[]; total: number }>('/links'),
  verifyNode: (id: string) => apiFetch<AnchorVerification>(`/nodes/${id}/verify`, { method: 'POST' }),
  createNode: (node: {
    kind: string;
    content: string;
    weight?: number;
    ambiguity?: number;
    anchors: Array<{ uri: string; sourceType: string }>;
  }) => apiFetch<KontExNode>('/nodes', {
    method: 'POST',
    body: JSON.stringify(node),
  }),

  // Configuration LLM
  getLlmConfig: () => apiFetch<Record<string, unknown>>('/config/llm'),
  updateLlmConfig: (config: Record<string, unknown>) =>
    apiFetch<{ success: boolean }>('/config/llm', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  testLlmConnection: (params: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/config/llm/test', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Import Markdown
  importMarkdown: (body: { markdown: string; sourceUri?: string; sourceType?: string }) =>
    apiFetch<Record<string, unknown>>('/nodes/import', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
