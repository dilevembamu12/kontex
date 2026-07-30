# 📋 TODO — KontEx : Prochaines étapes

> **Projet** : KontEx — Operating System de Context Engineering B2B2B  
> **Date** : 2026-07-30  
> **Repo** : [github.com/dilevembamu12/kontex](https://github.com/dilevembamu12/kontex)

---

## 🟢 Priorité 1 — Extension VSCode (Vibe Coding dans l'IDE)

> **Objectif** : Permettre à un développeur de vérifier en un raccourci si le code généré par Copilot est une hallucination.

- [ ] **Initialisation du projet**
  - [ ] Créer `vscode-extension/` avec `package.json` (activation sur `*`, commandes, views)
  - [ ] Configurer TypeScript strict + bundler (esbuild/webpack) pour l'extension
  - [ ] Ajouter icône KontEx 🪐 dans la barre d'activité
- [ ] **Sidebar : Toile TTC**
  - [ ] `TreeView` listant les nœuds ancrés (Facts, Rules, Code, Docs)
  - [ ] Rafraîchissement automatique après `POST /nodes`
  - [ ] Click sur un nœud → affiche le détail (contenu, ancres, poids, ambiguïté)
- [ ] **Commandes**
  - [ ] `KontEx: Vérifier l'hallucination` — sélection → `POST /detect` → popup résultat
  - [ ] `KontEx: Ancrer la sélection` — sélection → `POST /nodes` avec le code comme contenu
  - [ ] `KontEx: Ouvrir le dashboard` — ouvre `http://localhost:3001`
- [ ] **StatusBar**
  - [ ] Indicateur de confiance TTC (🟢 > 0.8, 🟡 > 0.5, 🔴 ≤ 0.5)
  - [ ] Compteur de nœuds dans la toile
- [ ] **Packaging**
  - [ ] Générer le `.vsix` avec `vsce package`
  - [ ] Tester l'installation dans VSCode/Cursor

---

## 🟡 Priorité 2 — Persistance PostgreSQL + pgvector réelle

> **Objectif** : Remplacer le stockage in-memory (`Map`) par la base de données vectorielle.

- [ ] **Connexion réelle**
  - [ ] Installer `pg` dans `api/` (déjà configuré, juste `npm install pg`)
  - [ ] Lancer PostgreSQL via Docker : `docker compose up kontex-postgres`
  - [ ] Exécuter `db/init/001-schema.sql` à l'init du conteneur
- [ ] **Repositories**
  - [ ] `NodeRepository` : INSERT/SELECT/UPDATE/DELETE + embedding pgvector
  - [ ] `LinkRepository` : CRUD liens pondérés
  - [ ] `AnchorRepository` : CRUD ancres
  - [ ] `ContradictionRepository` : Historique des contradictions résolues
- [ ] **Vector Search**
  - [ ] Recherche par similarité cosinus `<=>` pour la détection d'hallucination
  - [ ] Génération d'embedding (placeholder OpenAI/local en Phase 0)
- [ ] **Migration du TtcService**
  - [ ] Remplacer `new Map()` par les repositories PostgreSQL
  - [ ] Fallback in-memory conservé si `DATABASE_URL` non définie

---

## 🟡 Priorité 2 — Cache Redis

> **Objectif** : Accélérer les vérifications fréquentes (< 10ms).

- [ ] **Activation**
  - [ ] Installer `ioredis` dans `api/` (déjà configuré)
  - [ ] Lancer Redis via Docker : `docker compose up kontex-redis`
- [ ] **Stratégie de cache**
  - [ ] Cache `GET /nodes/:id` (TTL 60s, invalidation sur `POST /nodes`)
  - [ ] Cache `GET /stats` (TTL 30s)
  - [ ] Cache `POST /nodes/:id/verify` (TTL 120s)
- [ ] **Invalidation**
  - [ ] `POST /nodes` → invalide `/nodes`, `/stats`
  - [ ] `POST /links` → invalide `/stats`, `/propagate`

---

## 🟡 Priorité 2 — Connecter le Dashboard aux vrais endpoints

> **Objectif** : Le dashboard affiche les données réelles de l'API, pas des mocks.

- [ ] **Page Vue d'ensemble (`/`)**
  - [ ] Remplacer les valeurs mock par `fetch('http://localhost:3000/stats')`
  - [ ] Afficher le statut réel de l'API (`GET /health`)
- [ ] **Page Toile TTC (`/web`)**
  - [ ] Charger `GET /nodes` et `GET /links`
  - [ ] Formulaire d'ajout de nœud (kind, content, anchors)
- [ ] **Page Santé (`/health`)**
  - [ ] Appeler `GET /health` et afficher les vrais composants
- [ ] **Page Ancrage (`/anchoring`)**
  - [ ] Lister les nœuds avec leur force d'ancrage réelle (`POST /nodes/:id/verify`)

---

## 🔵 Priorité 3 — Tests & CI/CD

- [ ] **Tests E2E**
  - [ ] Scénario : POST /nodes → GET /nodes → POST /links → POST /detect → GET /stats
  - [ ] Scénario : Dashboard charge les données depuis l'API
  - [ ] Scénario : Extension VSCode → API → détection d'hallucination
- [ ] **CI/CD GitHub Actions**
  - [ ] Workflow `test.yml` : `cargo test` + `npm test` (api + sdk)
  - [ ] Workflow `build.yml` : `cargo build --features napi --release` + `docker build`
  - [ ] Badge de statut dans le README
- [ ] **Docker**
  - [ ] Tester `docker compose up` (4 services)
  - [ ] Ajouter un `Dockerfile` pour le dashboard

---

## 🔵 Priorité 3 — Productionisation B2B2B

- [ ] **Authentification**
  - [ ] Middleware `apiKeyAuth` dans `api/src/middlewares/`
  - [ ] Header `Authorization: Bearer <token>` ou `X-API-Key: <key>`
  - [ ] Rate limiting (100 req/min par clé)
- [ ] **Multi-tenant**
  - [ ] Colonne `tenant_id` dans les tables PostgreSQL
  - [ ] Isolation par `tenant_id` dans les repositories
- [ ] **Webhook**
  - [ ] `POST /webhooks` — enregistrer une URL de callback
  - [ ] `onHallucinationDetected` → notifier le webhook
- [ ] **Documentation**
  - [ ] `docs/API.md` — Référence complète des endpoints
  - [ ] `docs/TTC.md` — Explication de la théorie pour les partenaires
  - [ ] `docs/ONBOARDING.md` — Guide d'intégration B2B2B

---

## ⚪ Priorité 4 — Nice-to-have

- [ ] **gRPC** : Ajouter un endpoint gRPC (`core/proto/ttc.proto`) + serveur tonic
- [ ] **Embeddings** : Génération vectorielle réelle (OpenAI text-embedding-3-small ou modèle local)
- [ ] **Graph visualization** : Page `/web` avec rendu visuel du graphe (D3.js ou vis-network)
- [ ] **Benchmark dashboard** : Page `/bench` affichant les métriques de perf en temps réel
- [ ] **SDK Python** : `sdk/python/` — équivalent du SDK TypeScript pour Jupyter/ML

---

## 📊 Progression globale

| Phase | Statut |
|-------|--------|
| Fondations TTC | ✅ |
| API Gateway | ✅ |
| TTC Engine Rust | ✅ |
| Bridge napi-rs | ✅ |
| SDK TypeScript | ✅ |
| Dashboard | ✅ |
| Schéma DB | ✅ |
| Extension VSCode | ⬜ 0% |
| PostgreSQL réel | ⬜ 10% (config prête) |
| Redis réel | ⬜ 10% (config prête) |
| Dashboard ↔ API | ⬜ 0% |
| Tests E2E | ⬜ 0% |
| CI/CD | ⬜ 0% |
| Auth + Multi-tenant | ⬜ 0% |
