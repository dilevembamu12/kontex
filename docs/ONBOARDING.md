# KontEx — Guide d'Intégration B2B2B

> **Cible** : Partenaires souhaitant intégrer le moteur anti-hallucination KontEx dans leur plateforme.

---

## Prérequis

- **Node.js** ≥ 20 (pour l'API Gateway)
- **Rust** ≥ 1.85 (pour compiler le moteur natif)
- **Docker** (pour PostgreSQL + Redis)
- **npm** ≥ 10

---

## Installation rapide

```bash
# 1. Cloner le repo
git clone https://github.com/dilevembamu12/kontex.git
cd kontex

# 2. Lancer l'infrastructure
sudo docker compose up -d kontex-postgres kontex-redis

# 3. Compiler le moteur Rust natif
cd core
cargo build --features napi --release
cp target/release/libkontex_ttc.so npm/kontex-ttc.linux-x64-gnu.node

# 4. Lancer l'API
cd ../api
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000

# 5. Lancer le dashboard (optionnel)
cd ../dashboard
npm install
npm run dev
# → http://localhost:5173
```

---

## Intégration SDK

```bash
npm install @kontex/sdk
```

```typescript
import { ContextClient, WebWeaver, NodeBuilder, HallucinationDetector } from '@kontex/sdk';

const client = new ContextClient({ baseUrl: 'http://localhost:3000' });

// 1. Peupler la toile avec vos données métier
const weaver = new WebWeaver();
const node = new NodeBuilder('fact', 'Votre règle métier')
  .withAnchor({ uri: 'spec://votre-source', sourceType: 'specification' })
  .build();
weaver.addNode(node);

// 2. Vérifier une réponse LLM
const detector = new HallucinationDetector();
const report = detector.analyze(llmResponse, weaver);

if (report.isHallucination) {
  console.error('⚠️ Hallucination détectée !', report.suggestions);
}
```

---

## Architecture recommandée

```
Votre App → SDK (@kontex/sdk) → API KontEx (:3000)
                                    ↓
                              PostgreSQL (données)
                                    ↓
                              Redis (cache < 10ms)
```

---

## Endpoints clés

| Endpoint | Usage |
|----------|-------|
| `POST /nodes` | Ajouter des faits/règles à la toile |
| `POST /detect` | Vérifier si un texte contient des hallucinations |
| `GET /stats` | Surveiller la santé de la toile |

Documentation complète : [API.md](./API.md)

---

## Support

- **Repo** : [github.com/dilevembamu12/kontex](https://github.com/dilevembamu12/kontex)
- **Théorie** : [TTC.md](./TTC.md)
- **Licence** : Propriétaire — contactez-nous pour une licence commerciale.
