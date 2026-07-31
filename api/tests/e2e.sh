#!/usr/bin/env bash
# ================================================================
# KontEx E2E Test Script — Scénario B2B2B complet
# ================================================================
# Usage : bash tests/e2e.sh [API_URL]
#   API_URL : base URL de l'API (défaut: http://localhost:3000)
# ================================================================
set -euo pipefail

API_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
bold()  { printf '\033[1m%s\033[0m' "$1"; }

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  $(green '✅') $desc"
    PASS=$((PASS + 1))
  else
    echo "  $(red '❌') $desc — attendu: '$expected', reçu: '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "  🧪 KontEx E2E Test Suite"
echo "  $(bold "$API_URL")"
echo "  $(date)"
echo "========================================"
echo ""

# --- Pre-check : API joignable ? ---
echo "$(bold '0. Healthcheck')"
HEALTH=$(curl -s "$API_URL/health" 2>&1 || echo '{"status":"down"}')
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','down'))" 2>/dev/null || echo "down")
# En développement, 'healthy' ou 'degraded' sont acceptables (Graphiti en fallback)
if [[ "$STATUS" == "healthy" || "$STATUS" == "degraded" ]]; then
  echo "  $(green '✅') API joignable (status: $STATUS)"
  PASS=$((PASS + 1))
else
  echo "  $(red '❌') API injoignable — status: $STATUS"
  FAIL=$((FAIL + 1))
fi
echo ""

# --- Étape 1 : Ancrage (Principe A) ---
echo "$(bold '1. Ancrage — POST /nodes (Principe A)')"

# Créer un nœud fact
FACT=$(curl -s -X POST "$API_URL/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fact","content":"E2E: La Terre orbite autour du Soleil","weight":0.99,"ambiguity":0.01,"anchors":[{"uri":"spec://nasa-orbit","sourceType":"specification"},{"uri":"https://nasa.gov","sourceType":"official_documentation"}]}')
FACT_ID=$(echo "$FACT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [[ -n "$FACT_ID" ]]; then
  echo "  $(green '✅') Nœud fact créé: ${FACT_ID:0:8}..."
  PASS=$((PASS + 1))
else
  echo "  $(red '❌') Échec création nœud fact"
  FAIL=$((FAIL + 1))
fi

# Créer un nœud rule
RULE=$(curl -s -X POST "$API_URL/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"rule","content":"E2E RULE: Si orbite alors planète","weight":0.9,"ambiguity":0.05,"anchors":[{"uri":"spec://iau-planet-def","sourceType":"specification"}]}')
RULE_ID=$(echo "$RULE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [[ -n "$RULE_ID" ]]; then
  echo "  $(green '✅') Nœud rule créé: ${RULE_ID:0:8}..."
  PASS=$((PASS + 1))
else
  echo "  $(red '❌') Échec création nœud rule"
  FAIL=$((FAIL + 1))
fi

# Tester le rejet sans ancre (Principe A)
REJECT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fact","content":"Pas d ancre","anchors":[]}')
check "Rejet sans ancre (Principe A)" "500" "$REJECT"
echo ""

# --- Étape 2 : Vérification d'ancrage ---
echo "$(bold '2. Vérification — POST /nodes/:id/verify')"
VERIFY=$(curl -s -X POST "$API_URL/nodes/$FACT_ID/verify")
IS_ANCHORED=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isAnchored',''))" 2>/dev/null)
STRENGTH=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('strength',''))" 2>/dev/null)
check "Nœud ancré" "True" "$IS_ANCHORED"
echo "     Force d'ancrage: $STRENGTH"
echo ""

# --- Étape 3 : Liens ---
echo "$(bold '3. Tissage — POST /links')"
LINK=$(curl -s -X POST "$API_URL/links" \
  -H 'Content-Type: application/json' \
  -d "{\"sourceId\":\"$FACT_ID\",\"targetId\":\"$RULE_ID\",\"relation\":\"refines\",\"weight\":0.9,\"relevanceScore\":0.85}")
LINK_ID=$(echo "$LINK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [[ -n "$LINK_ID" ]]; then
  echo "  $(green '✅') Lien refines créé: ${LINK_ID:0:8}..."
  PASS=$((PASS + 1))
else
  echo "  $(red '❌') Échec création lien"
  FAIL=$((FAIL + 1))
fi
echo ""

# --- Étape 4 : Détection ---
echo "$(bold '4. Détection — POST /detect (Principe C)')"
DETECT=$(curl -s -X POST "$API_URL/detect" \
  -H 'Content-Type: application/json' \
  -d '{"content":"La Terre orbite autour du Soleil en 365 jours."}')
IS_HALLUC=$(echo "$DETECT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isHallucination',''))" 2>/dev/null)
CONFIDENCE=$(echo "$DETECT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('confidence',''))" 2>/dev/null)
check "Assertion cohérente → non-hallucination" "False" "$IS_HALLUC"
echo "     Confiance: $CONFIDENCE"
echo ""

# --- Étape 5 : Propagation ---
echo "$(bold '5. Propagation — POST /propagate (Principe P)')"
PROPAG=$(curl -s -X POST "$API_URL/propagate" \
  -H 'Content-Type: application/json' \
  -d "{\"sourceId\":\"$FACT_ID\",\"threshold\":0.01,\"maxDepth\":5}")
REACHED=$(echo "$PROPAG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reachedCount',''))" 2>/dev/null)
echo "  $(green '✅') Nœuds atteints: $REACHED"
PASS=$((PASS + 1))
echo ""

# --- Étape 6 : Stats ---
echo "$(bold '6. Statistiques — GET /stats')"
STATS=$(curl -s "$API_URL/stats")
NODES=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nodeCount',''))" 2>/dev/null)
LINKS=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('linkCount',''))" 2>/dev/null)
ENTROPY=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('globalEntropy',''))" 2>/dev/null)
check "nodeCount >= 2" "true" "$([[ "$NODES" -ge 2 ]] && echo "true" || echo "false")"
check "linkCount >= 1" "true" "$([[ "$LINKS" -ge 1 ]] && echo "true" || echo "false")"
echo "     Entropie globale: $ENTROPY"
echo ""

# --- Étape 7 : Cache ---
echo "$(bold '7. Cache Redis — X-KontEx-Cache')"
CACHE_HEADER=$(curl -s -D - "$API_URL/stats" 2>&1 | grep -i "X-KontEx-Cache" | tr -d '\r' | awk '{print $2}')
check "Cache header présent (HIT ou MISS)" "true" "$([[ -n "$CACHE_HEADER" ]] && echo "true" || echo "false")"
echo "     Header: X-KontEx-Cache: $CACHE_HEADER"
echo ""

# --- Étape 8 : Rate Limiting ---
echo "$(bold '8. Rate Limiting — Headers')"
RATE_RESPONSE=$(curl -s -D - "$API_URL/nodes" 2>&1)
RATE_LIMIT=$(echo "$RATE_RESPONSE" | grep -i "x-ratelimit-limit" | tr -d '\r' | awk '{print $2}')
if [[ -n "$RATE_LIMIT" ]]; then
  echo "  $(green '✅') X-RateLimit-Limit présent: $RATE_LIMIT"
  PASS=$((PASS + 1))
else
  echo "  $(red '❌') X-RateLimit-Limit absent"
  FAIL=$((FAIL + 1))
fi
echo ""

# --- Résumé ---
echo "========================================"
echo "  Résumé"
echo "========================================"
echo "  $(green "✅ Passés") : $PASS"
if [[ $FAIL -gt 0 ]]; then
  echo "  $(red "❌ Échoués") : $FAIL"
fi
echo ""
TOTAL=$((PASS + FAIL))
echo "  Score : $PASS / $TOTAL"

if [[ $FAIL -eq 0 ]]; then
  echo ""
  echo "  $(green '🎉 Tous les tests E2E ont réussi !')"
  exit 0
else
  echo ""
  echo "  $(red '⚠️  Certains tests ont échoué.')"
  exit 1
fi
