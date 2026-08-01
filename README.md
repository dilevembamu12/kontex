# KontEx — Operating System de Context Engineering B2B2B

> **Théorie de la Toile Cosmologique (TTC) v1.1 / MCW-2**
> Détection d'hallucinations par résolution d'équations de champ sur graphe contextuel.

[![TTC v1.1](https://img.shields.io/badge/TTC-v1.1%20%2F%20MCW--2-purple)](#)
[![Benchmark](https://img.shields.io/badge/benchmark-9%2F10-success)](#)
[![Rust](https://img.shields.io/badge/Rust-39%20tests%20OK-orange)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)

---

## 🧬 Qu'est-ce que KontEx ?

KontEx modélise le contexte d'un projet comme un **champ physique continu** régi par le Lagrangien MCW-2. Les assertions d'un LLM sont injectées comme perturbations dans ce champ. Une hallucination se manifeste par une **tension topologique** $T$ dépassant le seuil critique — une déchirure dans le tissu sémantique.

Contrairement aux approches heuristiques (regex, cosine similarity, LLM-as-judge), la TTC offre :
- **Universalité** : les équations de champ sont indépendantes du domaine
- **Continuité** : la tension $T$ est une grandeur physique continue, pas un booléen
- **Fondement mathématique** : Lagrangien, lois de conservation, symétries

```
┌─────────────────────────────────────────────────────────┐
│                   Pipeline /detect                       │
│                                                          │
│  Assertion → Gemini 768d → pgvector → solve MCW-2 → T   │
│                                                          │
│  T > T_crit (0.10) ? 🔴 HALLUCINATION : 🟢 COHÉRENT     │
└─────────────────────────────────────────────────────────┘
```

## 📊 Performances

| Métrique | Valeur |
|----------|--------|
| **Benchmark 10 paires** | **9/10 (90%)** |
| Discrimination MCW-2 | T_hall / T_coh = **6.1×** |
| Reproductibilité | ΔT < 10⁻¹⁵ |
| Tests Rust | **39/39 passed** |
| Temps de réponse | ~700ms (Gemini API) + ~2ms (solveur Rust) |

## 🏗️ Architecture

```
kontex/
├── api/          # Express 5 + TypeScript 5.7 — API Gateway (port 3001)
├── core/         # Rust 2024 — Moteur TTC + napi-rs bridge → .so
├── dashboard/    # Next.js 14 — Dashboard Bootstrap 5 (port 3000)
├── test/         # Scripts de benchmark et validation
├── docker/       # Docker Compose (PostgreSQL + Redis)
└── docs/         # Documentation scientifique
```

### Stack technique

| Couche | Technologie | Rôle |
|--------|------------|------|
| **API Gateway** | Express 5 + TypeScript 5.7 strict | 12 endpoints REST, auth B2B2B |
| **Moteur TTC** | Rust 2024 + petgraph + napi-rs | Solveur PDE, 39 tests |
| **Base vectorielle** | PostgreSQL 17 + pgvector | Embeddings 768d, IVFFlat |
| **Cache** | Redis 7 | Cache GET avec invalidation |
| **Embeddings** | Gemini `gemini-embedding-2` (768d) | Vecteurs sémantiques |
| **Dashboard** | Next.js 14 + Bootstrap 5 + D3.js | Visualisation, détection, config |

## 🚀 Démarrage rapide

### Prérequis
- Docker & Docker Compose
- Node.js 18+
- Rust (optionnel, pour recompiler le .so)

### 1. Lancer les services

```bash
# PostgreSQL + pgvector + Redis
cd docker && docker compose up -d

# API (port 3001)
cd api && npm install && PORT=3001 npm run dev

# Dashboard (port 3000)
cd dashboard && npm install && npm run dev
```

### 2. Importer des faits

```bash
# Importer un markdown structuré
curl -X POST http://localhost:3001/nodes/import \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"## Python len()\nLa fonction len() retourne un entier\n\n## React useState\nuseState retourne [state, setState]"}'

# Tisser les liens automatiquement
curl -X POST http://localhost:3001/nodes/weave
```

### 3. Détecter une hallucination

```bash
curl -X POST http://localhost:3001/detect \
  -H 'Content-Type: application/json' \
  -d '{"content":"Python: la fonction len() retourne un float"}'
```

Ou utilisez le dashboard : **http://localhost:3000/detect**

## 🔬 Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/detect` | Détection d'hallucination TTC MCW-2 |
| `GET` | `/benchmark` | Score benchmark 10 paires |
| `GET` | `/ttc/lagrangian` | Lagrangien MCW-2 global |
| `POST` | `/nodes` | Créer un nœud |
| `GET` | `/nodes` | Lister les nœuds |
| `DELETE` | `/nodes/:id` | Supprimer un nœud |
| `POST` | `/nodes/import` | Importer un markdown |
| `POST` | `/nodes/weave` | Tisser les liens (Jaccard) |
| `POST` | `/links` | Créer un lien |
| `GET` | `/links` | Lister les liens |
| `GET` | `/stats` | Statistiques globales |
| `GET` | `/health` | Health check |

## 🧪 Tests

```bash
# Tests Rust (39 tests)
cd core && cargo test

# Benchmark TTC (10 paires contradictoires)
bash test/benchmark.sh

# Validation complète
bash /tmp/ttc-test.sh
```

## 📐 Fondements mathématiques

### Lagrangien MCW-2

$$\mathcal{L}_{\mathcal{W}} = -\tfrac12(\partial\Gamma)^2 - \tfrac12\Gamma^2(\partial\Phi)^2 - \tfrac12(\partial T)^2 - U(\Gamma,T) - \boxed{\tfrac{\gamma}{2} T (\partial\Phi)^2}$$

### Trois champs scalaires

| Champ | Nom | Interprétation |
|-------|-----|---------------|
| $\Gamma(x)$ | Cohérence | Degré d'organisation locale |
| $\Phi(x)$ | Phase | Relations de phase entre régions |
| $T(x)$ | Tension | Indicateur d'hallucination |

### Équations de champ

$$\square\Gamma - \Gamma(\nabla\Phi)^2 - \alpha\Gamma(\Gamma^2-v_\Gamma^2) - 2\lambda T\Gamma = 0$$

$$\nabla_\mu(\Gamma^2\nabla^\mu\Phi) = 0$$

$$\square T - \beta(T-v_T) - \lambda\Gamma^2 - \boxed{\tfrac{\gamma}{2}(\nabla\Phi)^2} = 0$$

### Paramètres calibrés

| Paramètre | Valeur | Rôle |
|-----------|--------|------|
| $\alpha$ | 0.01 | Auto-interaction de $\Gamma$ |
| $\beta$ | 0.3 | Masse de $T$ |
| $\lambda$ | 0.001 | Couplage $\Gamma$-$T$ |
| $\gamma$ | 0.1 | Couplage $\Phi$-$T$ (MCW-2) |
| $v_\Gamma$ | 1.0 | VEV de cohérence |
| $v_T$ | 0.0 | VEV de tension |
| $T_{crit}$ | 0.10 | Seuil d'hallucination |

## 📚 Références

1. White Paper TTC — Théorie de la Toile Cosmologique, Équations fondamentales, 2026
2. TTC-discrete-spec-v1.1.md — Spécification normative
3. TTC-MCW2-extension.md — Extension MCW-2
4. [pgvector](https://github.com/pgvector/pgvector)
5. [napi-rs](https://napi.rs)
6. [petgraph](https://docs.rs/petgraph)

---

*« La vérité n'est pas une probabilité. C'est un état d'équilibre du champ $\Gamma$. »* — Principe A, TTC

**Auteur** : Dileve MBAMU — [dileve.com](https://dileve.com)
