# KontEx — Théorie de la Toile Cosmologique (TTC)

> **Version** : 0.1.0-alpha  
> **Application** : Vibe Coding sans hallucination

---

## Vue d'ensemble

La **Théorie de la Toile Cosmologique (TTC)** est le fondement mathématique de KontEx. Elle modélise le **contexte** comme une toile de nœuds interconnectés, où chaque assertion (fait, règle, code, documentation) est un nœud, et chaque relation sémantique est un lien pondéré.

---

## Les 4 Principes

### 1. Principe d'Ancrage ($A$)

$$A(f) \implies \exists s \in Sources : lien(f, s)$$

> Chaque fait ($f$) doit être relié à au moins une source vérifiable ($s$).

**Application** : Avant d'accepter une assertion générée par un LLM, KontEx vérifie qu'elle est **ancrée** dans une source (documentation officielle, test, spécification, code repository, peer review).

**Métrique** : Force d'ancrage ∈ [0, 1], calculée à partir du nombre et de la qualité des sources.

---

### 2. Principe de Cohérence ($C$)

$$C(n_1, n_2) \implies \neg (n_1 \oplus n_2) \lor résolu(n_1, n_2)$$

> Deux nœuds ne peuvent pas se contredire sans qu'une résolution explicite ne soit enregistrée.

**Application** : Détection automatique des contradictions entre le code généré et les faits établis dans la toile. Résolution par comparaison des forces d'ancrage.

---

### 3. Principe de Propagation ($P$)

$$P(n_i, n_j) = w_{ij} \cdot relevance(n_i, n_j)$$

> Le contexte se propage de proche en proche, avec une atténuation proportionnelle aux poids des liens et à la distance.

**Application** : BFS pondéré qui calcule l'influence d'un nœud sur ses voisins. Utilisé pour enrichir le contexte des requêtes LLM.

---

### 4. Principe d'Entropie Minimale ($E_{min}$)

$$E_{min}(T) = \arg\min_{T'} \sum_{n \in T'} ambiguity(n)$$

> La toile tend vers l'état de moindre ambiguïté.

**Application** : Réduction itérative de l'ambiguïté des nœuds les plus incertains, en renforçant leurs ancrages ou en ajoutant des liens de raffinement.

---

## Structure de données

```
Node {
  id: UUID
  kind: Fact | Rule | Code | Documentation
  content: String
  weight: Float ∈ [0, 1]
  ambiguity: Float ∈ [0, 1]
  anchors: Anchor[]
}

Link {
  source_id: UUID
  target_id: UUID
  relation: DependsOn | Contradicts | Refines | Exemplifies | References
  weight: Float ∈ [0, 1]
  relevance_score: Float ∈ [0, 1]
}
```

---

## Architecture

```
Requête LLM → [KontEx SDK] → [API Gateway] → [TTC Engine (Rust)]
                                                    ↓
                                             PostgreSQL + pgvector
                                                    ↓
                                             Redis (cache)
```

---

## Benchmark (OKR O2)

| Métrique | Cible | Résultat |
|----------|-------|----------|
| Insertion 10k nœuds | < 100ms | ~20ms ✅ |
| Détection d'hallucination | > 95% | En cours |
| Contradictions non résolues | 0 | ✅ |

---

*Document de référence pour les partenaires B2B2B. Pour l'implémentation technique, voir les sources dans `core/src/engine/`.*
