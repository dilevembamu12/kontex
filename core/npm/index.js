/// @anchor: napi-rs loader — charge le module natif compilé.
/// Si le .node n'est pas trouvé, exporte une version mock pour le développement.

const path = require('path');

const PLATFORM_MAP = {
  'linux-x64': 'kontex-ttc.linux-x64-gnu.node',
  'darwin-x64': 'kontex-ttc.darwin-x64.node',
  'darwin-arm64': 'kontex-ttc.darwin-arm64.node',
  'win32-x64': 'kontex-ttc.win32-x64-msvc.node',
};

function getBinaryName() {
  const platform = `${process.platform}-${process.arch}`;
  return PLATFORM_MAP[platform] ?? `kontex-ttc.${platform}.node`;
}

function loadNativeModule() {
  const binaryName = getBinaryName();
  try {
    return require(path.join(__dirname, binaryName));
  } catch (error) {
    // Fallback : module mock pour le développement sans compilation native
    console.warn(
      `[KontEx::TTC] Module natif "${binaryName}" non trouvé — fallback mock activé.\n` +
      `  Pour compiler : cd core && cargo build --features napi --release\n` +
      `  Copier : cp target/release/libkontex_ttc.so core/npm/${binaryName}`
    );
    return createMockModule();
  }
}

function createMockModule() {
  // Mock qui délègue la logique — à remplacer par le vrai .node
  let nodeCount = 0;
  let linkCount = 0;

  return {
    JsWeb: class {
      constructor() {
        this._nodes = new Map();
        this._links = [];
      }

      addNode(kind, content, weight, ambiguity, anchors) {
        const id = `mock-${++nodeCount}`;
        this._nodes.set(id, {
          id,
          kind,
          content,
          weight: weight ?? 0.5,
          ambiguity: ambiguity ?? 0.5,
          anchors: anchors ?? [],
          metadata: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return id;
      }

      getNode(id) {
        return this._nodes.get(id) ?? null;
      }

      listNodes() {
        return [...this._nodes.values()];
      }

      addLink(sourceId, targetId, relation, weight, relevanceScore) {
        if (!this._nodes.has(sourceId)) throw new Error(`Source ${sourceId} not found`);
        if (!this._nodes.has(targetId)) throw new Error(`Target ${targetId} not found`);
        const id = `link-${++linkCount}`;
        const link = {
          id,
          sourceId,
          targetId,
          relation,
          weight: weight ?? 0.5,
          relevanceScore: relevanceScore ?? 0.5,
        };
        this._links.push(link);
        return id;
      }

      verifyAnchoring(nodeId) {
        const node = this._nodes.get(nodeId);
        if (!node) throw new Error(`Node ${nodeId} not found`);
        return {
          isAnchored: node.anchors.length > 0,
          strength: node.anchors.length > 0 ? 0.8 : 0,
          sourceCount: node.anchors.length,
          missingCategories: node.anchors.length === 0 ? ['ANY_SOURCE'] : [],
        };
      }

      detectContradiction(content) {
        return {
          isContradiction: false,
          confidence: 1.0,
          contradictions: [],
          suggestedResolution: null,
        };
      }

      propagateContext(sourceId, threshold, maxDepth) {
        return { sourceId, reachedCount: 0, maxDepth: 0, nodes: [] };
      }

      resolveContradiction(nodeA, nodeB) {
        return `Mock resolution: ${nodeA} ↔ ${nodeB}`;
      }

      minimizeEntropy(maxIterations) {
        return 0;
      }

      getStats() {
        return {
          nodeCount: this._nodes.size,
          linkCount: this._links.length,
          anchoredCount: [...this._nodes.values()].filter((n) => n.anchors.length > 0).length,
          anchoringRate: 1.0,
          contradictionCount: 0,
          globalEntropy: 0,
        };
      }
    },
  };
}

module.exports = loadNativeModule();
