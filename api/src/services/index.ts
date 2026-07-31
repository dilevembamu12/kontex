/// @anchor: barrel export pour le module services

export { getHealthReport } from './healthService.js';
export type { ComponentHealth } from './healthService.js';

export { cacheService, CacheService } from './cacheService.js';

export { ttcService, TtcService } from './ttcService.js';
export type {
  ContextNodeInput,
  AnchorInput,
  ContextLinkInput,
  StoredNode,
  StoredLink,
  AnchorVerification,
  ContradictionReport,
  HallucinationReport,
  PropagationResult,
} from './ttcService.js';
