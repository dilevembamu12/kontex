# KontEx — Documentation API

> **Base URL** : `http://localhost:3000`  
> **Version** : 0.1.0-alpha  
> **Format** : JSON

---

## Endpoints

### Health

```http
GET /health
```

**Réponse** `200 OK` :
```json
{
  "status": "healthy",
  "uptime": 1234,
  "version": "0.1.0-alpha",
  "timestamp": "2026-07-30T...",
  "components": [
    { "component": "postgres", "status": "healthy", "latencyMs": 3, "message": "..." },
    { "component": "redis", "status": "healthy", "latencyMs": 1, "message": "..." },
    { "component": "graphiti-ttc", "status": "healthy", "latencyMs": 8, "message": "..." }
  ]
}
```

---

### Nodes

```http
POST /nodes
Content-Type: application/json

{
  "kind": "fact",
  "content": "La Terre est ronde",
  "weight": 0.9,
  "ambiguity": 0.05,
  "anchors": [
    { "uri": "spec://nasa", "sourceType": "specification" }
  ]
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `kind` | `fact\|rule\|code\|documentation` | Oui | Type de nœud |
| `content` | string | Oui | Contenu textuel |
| `weight` | number (0-1) | Non (0.5) | Poids de pertinence |
| `ambiguity` | number (0-1) | Non (0.5) | Niveau d'ambiguïté |
| `anchors` | Anchor[] | Oui (≥1) | Sources d'ancrage (Principe A) |

**Réponse** `201 Created` : le nœud créé.

---

```http
GET /nodes
```

**Réponse** `200 OK` :
```json
{
  "nodes": [ { "id": "...", "kind": "fact", "content": "...", ... } ],
  "total": 42
}
```

---

```http
GET /nodes/:id
```

**Réponse** `200 OK` : le nœud.  
**Erreur** `404` : `{ "error": "Nœud <id> introuvable" }`

---

```http
POST /nodes/:id/verify
```

**Réponse** `200 OK` :
```json
{
  "isAnchored": true,
  "strength": 0.4,
  "sourceCount": 1,
  "missingCategories": []
}
```

---

### Links

```http
POST /links
Content-Type: application/json

{
  "sourceId": "uuid-source",
  "targetId": "uuid-target",
  "relation": "references",
  "weight": 0.7,
  "relevanceScore": 0.8
}
```

| Champ | Type | Requis |
|-------|------|--------|
| `sourceId` | UUID | Oui |
| `targetId` | UUID | Oui |
| `relation` | `depends_on\|contradicts\|refines\|exemplifies\|references\|custom` | Oui |
| `weight` | number | Non (0.5) |
| `relevanceScore` | number | Non (0.5) |

---

```http
GET /links
```

**Réponse** `200 OK` : `{ "links": [...], "total": 42 }`

---

### Detection

```http
POST /detect
Content-Type: application/json

{ "content": "La Terre est plate. Elle ne tourne pas." }
```

**Réponse** `200 OK` :
```json
{
  "isHallucination": true,
  "confidence": 0.6,
  "contradictingNodeIds": ["uuid-1", "uuid-2"],
  "suggestions": [
    "@resolution: l'assertion contredit le nœud uuid-1 — vérifier les ancres"
  ]
}
```

---

### Propagation

```http
POST /propagate
Content-Type: application/json

{ "sourceId": "uuid-source", "threshold": 0.01, "maxDepth": 10 }
```

**Réponse** `200 OK` :
```json
{
  "sourceId": "uuid-source",
  "reachedCount": 5,
  "maxDepth": 3,
  "nodes": [
    { "nodeId": "uuid-1", "score": 0.72 },
    { "nodeId": "uuid-2", "score": 0.58 }
  ]
}
```

---

### Statistics

```http
GET /stats
```

**Réponse** `200 OK` :
```json
{
  "nodeCount": 42,
  "linkCount": 87,
  "anchoredCount": 40,
  "anchoringRate": 0.952,
  "contradictionCount": 2,
  "globalEntropy": 0.23
}
```

---

## Codes d'erreur

| Code | Signification |
|------|---------------|
| `201` | Ressource créée |
| `200` | Succès |
| `400` | Requête invalide (champ manquant) |
| `404` | Ressource non trouvée |
| `500` | Erreur interne |

## Authentification (Phase 3+)

*Non implémentée en v0.1*. Prévu : Header `X-API-Key` ou `Authorization: Bearer <token>`.
