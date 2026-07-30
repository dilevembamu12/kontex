/// @anchor: SDK KontEx — Point d'entrée principal
/// @anchor: PROJECT_CONTEXT.md §3.1 — SDK TypeScript
///
/// KontEx SDK pour le Vibe Coding sans hallucination.
///
/// # Modules
/// - `client`  : ContextClient — connexion à l'API Gateway
/// - `anchor`  : AnchorProvider — validation des sources (Principe A)
/// - `weaver`  : WebWeaver — construction de toile contextuelle
/// - `detector`: HallucinationDetector — validation TTC des réponses LLM
///
/// # Usage rapide
/// ```typescript
/// import { ContextClient, WebWeaver, HallucinationDetector, NodeBuilder } from '@kontex/sdk';
///
/// // 1. Se connecter à l'API Gateway
/// const client = new ContextClient({ baseUrl: 'http://localhost:3000' });
/// const health = await client.getHealth();
///
/// // 2. Construire une toile contextuelle
/// const weaver = new WebWeaver();
/// const node = new NodeBuilder('fact', 'Le ciel est bleu')
///   .withAnchor({ uri: 'spec://optics', sourceType: 'specification' })
///   .build();
/// weaver.addNode(node);
///
/// // 3. Détecter les hallucinations
/// const detector = new HallucinationDetector();
/// const report = detector.analyze('Le ciel est vert', weaver);
/// console.log(report.isHallucination ? '⚠️ Hallucination' : '✓ Cohérent');
/// ```

// Client API
export { ContextClient, KontExClientError } from './client.js';
export type { ClientConfiguration } from './client.js';

// Ancre (Principe A)
export { AnchorProvider } from './anchor.js';
export type { AnchorProviderConfiguration } from './anchor.js';

// Tissage (WebWeaver)
export { WebWeaver, NodeBuilder, WeaveError } from './weaver.js';

// Détection d'hallucination
export { HallucinationDetector } from './detector.js';
export type { DetectorConfiguration } from './detector.js';

// Types
export type {
  ContextNode,
  ContextLink,
  NodeKind,
  RelationKind,
  Anchor,
  AnchorType,
  AnchorVerification,
  HallucinationReport,
  HealthReport,
  ComponentHealth,
} from './types.js';

// Version
export const SDK_VERSION = '0.1.0-alpha';
