# KontEx — Journal d'Évolution

> **Projet** : KontEx — Operating System de Context Engineering B2B2B  
> **Théorie** : Théorie de la Toile Cosmologique (TTC)  
> **Objectif** : Vibe Coding sans hallucination  
> **Repo** : [github.com/dilevembamu12/kontex](https://github.com/dilevembamu12/kontex)  
> **Dernière mise à jour** : 2026-07-30

---

## Arborescence actuelle

```
kontex/
├── PROJECT_CONTEXT.md          # Vision, TTC, architecture, roadmap, OKR
├── .cursorrules                # Règles Vibe Coding ancré (152 lignes)
├── docker-compose.yml          # 4 services : API, PostgreSQL, Redis, Graphiti
├── .gitignore
│
├── api/                        # ✅ Phase 1 — API Gateway Express 5 + TTC
│   ├── Dockerfile              # Multi-stage Node.js 22
│   ├── package.json            # Express 5, Cors, Dotenv, tsx, vitest
│   ├── tsconfig.json           # Strict (14 options)
│   ├── .env.example            # Variables d'environnement
│   └── src/
│       ├── server.ts           # Point d'entrée (9 routes)
│       ├── config/environment.ts
│       ├── controllers/
│       │   ├── healthController.ts    # GET /health
│       │   ├── nodeController.ts      # POST/GET /nodes, POST /nodes/:id/verify
│       │   ├── linkController.ts      # POST/GET /links
│       │   └── detectController.ts    # POST /detect, POST /propagate, GET /stats
│       ├── routes/
│       │   ├── healthRoutes.ts
│       │   ├── nodeRoutes.ts
│       │   └── ttcRoutes.ts
│       ├── services/
│       │   ├── healthService.ts
│       │   └── ttcService.ts          # Moteur TTC TypeScript (in-memory)
│       └── middlewares/
│           ├── errorHandler.ts
│           └── requestLogger.ts
│
├── core/                       # ✅ Phase 2 — TTC Engine Rust
│   ├── Cargo.toml              # Rust edition 2024, petgraph, serde, uuid
│   ├── benches/web_benchmark.rs
│   ├── tests/integration_test.rs # 8 tests TTC
│   └── src/
│       ├── lib.rs              # Point d'entrée + réexports
│       ├── node.rs             # Node, NodeKind, Anchor, AnchorType
│       ├── link.rs             # Link, RelationKind, propagation_force()
│       ├── web.rs              # ContextWeb (graphe + HashMap O(1))
│       ├── verifier.rs         # validate_anchor() — syntaxe URI
│       └── engine/
│           ├── anchoring.rs    # Principe A — verify_node_anchoring()
│           ├── coherence.rs    # Principe C — auto_resolve_contradiction()
│           ├── propagation.rs  # Principe P — propagate_context() BFS
│           └── entropy.rs      # Principe E_min — minimize_entropy()
│
├── sdk/typescript/             # ✅ Phase 3 — SDK Vibe Coding
│   ├── package.json            # @kontex/sdk v0.1.0-alpha
│   ├── tsconfig.json           # Strict
│   ├── tests/sdk.test.ts       # 14 tests (Ancrage, Tissage, Détection)
│   └── src/
│       ├── index.ts            # API publique
│       ├── types.ts            # Types partagés (ContextNode, HallucinationReport...)
│       ├── client.ts           # ContextClient — HTTP vers API (retry, backoff)
│       ├── anchor.ts           # AnchorProvider — validation Principe A
│       ├── weaver.ts           # WebWeaver + NodeBuilder — construction fluide
│       └── detector.ts         # HallucinationDetector — négation + Jaccard
│
├── dashboard/                  # ✅ Phase 4 — UI d'administration
│   ├── package.json            # Next.js 16 + Tailwind v4
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx      # Sidebar + navigation (4 pages)
│       │   ├── page.tsx        # 📊 Vue d'ensemble (métriques TTC)
│       │   ├── web/page.tsx    # 🕸️ Toile TTC (nœuds + liens)
│       │   ├── health/page.tsx # 💚 Santé (API, PG, Redis, Graphiti)
│       │   └── anchoring/page.tsx # ⚓ Ancrage (Principe A)
│       └── components/
│           ├── MetricCard.tsx  # Carte métrique avec tendance
│           └── StatusBadge.tsx # Badge healthy/degraded/unhealthy
│
└── db/                         # ✅ Phase 5 — Schéma base de données
    └── init/
        └── 001-schema.sql      # PostgreSQL + pgvector (nodes, links, anchors, contradictions)
```

---

## Historique des commits

| Commit | Phase | Description |
|--------|-------|-------------|
| `d0a7b47` | 0 | `docs: init project context, .cursorrules and TTC foundations` |
| `e612e68` | 1 | `feat(api): Milestone 1 — API Gateway Express 5 + Docker Compose 4 services` |
| `9a37095` | 2 | `feat(core): Milestone 2 — TTC Engine Rust avec les 4 principes` |
| `383eefa` | 3 | `feat(sdk): Milestone 3 — SDK TypeScript pour Vibe Coding sans hallucination` |
| `9c86bc4` | 4 | `feat(dashboard): Milestone 4 — Dashboard Next.js d'administration TTC` |
| `ef0e8be` | 5 | `feat(api): Phase Intégration — Endpoints TTC, détection d'hallucination, schéma DB` |

---

## Endpoints API

| Méthode | Route | Description | Principe TTC |
|---------|-------|-------------|--------------|
| `GET` | `/health` | Diagnostic API + dépendances | — |
| `POST` | `/nodes` | Créer un nœud ancré | **A** |
| `GET` | `/nodes` | Lister tous les nœuds | — |
| `GET` | `/nodes/:id` | Récupérer un nœud | — |
| `POST` | `/nodes/:id/verify` | Vérifier l'ancrage | **A** |
| `POST` | `/links` | Créer un lien pondéré | **P** |
| `GET` | `/links` | Lister tous les liens | — |
| `POST` | `/detect` | Détecter une hallucination | **A+C+P** |
| `POST` | `/propagate` | Propager le contexte (BFS) | **P** |
| `GET` | `/stats` | Statistiques globales | **E_min** |

---

## Résultats de tests

| Module | Tests | Statut |
|--------|-------|--------|
| **Rust Core** | 16 (8 unitaires + 8 intégration) | ✅ Tous passent |
| **SDK TypeScript** | 14 (Ancrage 4, Tissage 6, Détection 4) | ✅ Tous passent |
| **API TypeScript** | TypeScript strict — compilation | ✅ 0 erreur |
| **Dashboard** | TypeScript strict — compilation | ✅ 0 erreur |
| **OKR O2 KR2.1** | 10 000 nœuds en < 100ms | ✅ ~20ms |

---

## Les 4 principes TTC — État d'implémentation

| Principe | Formule | Rust | TS (API) | SDK | Dashboard |
|----------|---------|:----:|:--------:|:---:|:---------:|
| **A — Ancrage** | $A(f) \implies \exists s \in Sources$ | ✅ | ✅ | ✅ | ✅ |
| **C — Cohérence** | $\neg(n_1 \oplus n_2) \lor résolu$ | ✅ | ✅ | ✅ | ✅ |
| **P — Propagation** | $P = w_{ij} \cdot relevance$ | ✅ | ✅ | ✅ | — |
| **E_min — Entropie** | $\arg\min \sum ambiguity(n)$ | ✅ | ✅ | — | ✅ |

---

## Reste à faire

### 🔴 Priorité critique
- [ ] **WASM** : Compiler le moteur Rust en WebAssembly pour l'appeler depuis Node.js
- [ ] **PostgreSQL réel** : Remplacer le stockage in-memory par la DB avec pgvector
- [ ] **Redis** : Cache des nœuds fréquents

### 🟡 Priorité haute
- [ ] **Extension VSCode** : Packager le SDK en extension (.vsix) avec sidebar TTC
- [ ] **gRPC** : Ajouter un endpoint gRPC en plus du REST
- [ ] **Tests E2E** : Dashboard → SDK → API → DB

### 🔵 Priorité moyenne
- [ ] **CI/CD** : GitHub Actions (test, build, Docker)
- [ ] **API Keys** : Authentification + rate limiting
- [ ] **Multi-tenant** : Isolation par tenant pour le B2B2B
- [ ] **Documentation** : Guide onboarding partenaire

---

## Stack technique

| Couche | Technologie | Version |
|--------|------------|---------|
| API Gateway | Express | 5.x |
| Core Engine | Rust | 1.97 (edition 2024) |
| SDK | TypeScript | 5.7 strict |
| Dashboard | Next.js | 16 + Tailwind v4 |
| Base de données | PostgreSQL + pgvector | 17 |
| Cache | Redis | 7 |
| Conteneurisation | Docker + Compose | 3.9 |
| Tests | vitest / cargo test | — |

---

*Ce document reflète l'état du projet au 2026-07-30. Toute décision architecturale doit faire référence à PROJECT_CONTEXT.md.*
