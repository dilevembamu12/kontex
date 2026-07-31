# 📋 TODO List — KontEx : Bridge Rust, Persistence PG & Cache Redis

---

## 🦀 Point 1 — Bridge Rust ↔ Node.js (Binding Natif `napi-rs` / WASM)

> **Objectif :** Supprimer le duplicata de logique in-memory TypeScript (`ttcService.ts`) et déléguer 100% des calculs graph/TTC au moteur Rust `core/` avec des performances zéro-copy.

- [ ] **Configuration du Binding**
  - [ ] Installer `@napi-rs/cli` dans le workspace ou configurer `napi` dans `core/Cargo.toml`.
  - [ ] Configurer la cible de compilation native (Node-API) pour générer le binaire `.node` et les types `.d.ts`.
- [ ] **Exposition des Structures et Types**
  - [ ] Exposer la struct `ContextWeb` (graphe de la Toile).
  - [ ] Mapper les types Rust `Node`, `NodeKind`, `Anchor` et `Link` vers TypeScript.
- [ ] **Exposition des Algorithmes TTC**
  - [ ] Exposer `verify_node_anchoring()` (Principe A — Ancrage).
  - [ ] Exposer `auto_resolve_contradiction()` (Principe C — Cohérence).
  - [ ] Exposer `propagate_context()` / BFS (Principe P — Propagation).
  - [ ] Exposer `minimize_entropy()` (Principe E_min — Entropie).
- [ ] **Intégration API**
  - [ ] Remplacer l'implémentation de `api/src/services/ttcService.ts` par les appels natifs du module Rust compilé.
  - [ ] Valider la compilation TS sans erreur et tester les performances d'appel.

---

## 🐘 Point 2 — Persistence PostgreSQL + `pgvector`

> **Objectif :** Remplacer le stockage volatile en mémoire par la base de données relationnelle et vectorielle configurée dans `db/init/001-schema.sql`.

- [ ] **Configuration du Client DB**
  - [ ] Choisir et installer le driver SQL dans `api/` (`pg` / `kysely` / `Prisma`).
  - [ ] Valider l'extension `pgvector` lors de l'initialisation de la DB dans Docker.
  - [ ] Créer le module de connexion singleton `api/src/config/database.ts`.
- [ ] **Implémentation des Repositories**
  - [ ] `NodeRepository` : CRUD complet des nœuds de la toile + génération/stockage des embeddings.
  - [ ] `LinkRepository` : Création, suppression et requêtes des liens pondérés inter-nœuds.
  - [ ] `AnchorRepository` : Gestion des sources vérifiables et des états d'ancrage.
  - [ ] `ContradictionRepository` : Historisation des conflits détectés et résolus.
- [ ] **Requêtes Vectorielles & Anti-Hallucination**
  - [ ] Implémenter la recherche par similarité cosinus (`<=>`) via `pgvector` pour la détection d'hallucinations.
  - [ ] Raccorder `nodeController.ts`, `linkController.ts` et `detectController.ts` aux Repositories PG.
- [ ] **Synchronisation DB ↔ Rust Core**
  - [ ] Implémenter le chargement initial de la sous-toile active depuis PostgreSQL vers le graphe Rust au démarrage / sur requête.

---

## 🔴 Point 3 — Couche de Caching Redis

> **Objectif :** Mettre en cache les nœuds fréquents et la sous-toile active pour garantir des temps de réponse < 10ms sur le Vibe Coding.

- [ ] **Infrastructure & Configuration**
  - [ ] Installer `ioredis` dans `api/`.
  - [ ] Créer la configuration du client Redis dans `api/src/config/redis.ts`.
  - [ ] Tester le healthcheck Redis dans `healthService.ts`.
- [ ] **Stratégie de Cache**
  - [ ] Cacher le résultat des vérifications d'ancrage (`/nodes/:id/verify`) avec TTL ajustable.
  - [ ] Cacher la matrice de propagation du contexte (`/propagate`) pour les sous-toiles fréquemment accédées.
  - [ ] Mettre en place l'invalidation de cache (invalidations ciblées lors des mutations `POST /nodes`, `POST /links`).
- [ ] **Verrouillage Distribué (Optionnel)**
  - [ ] Implémenter un lock distribué (Redlock) lors des opérations de minimisation d'entropie ($E_{min}$) pour éviter les race conditions multi-instances.

---

## 🧪 Phase de Validation & Integration

- [ ] **Tests d'Intégration E2E**
  - [ ] Rédiger les tests E2E : API Express $\rightarrow$ Binding Rust $\rightarrow$ PostgreSQL + `pgvector` $\rightarrow$ Redis Cache.
  - [ ] Exécuter le benchmark de charge pour valider le maintien de la métrique **10 000 nœuds en < 100ms** avec la couche de persistence active.