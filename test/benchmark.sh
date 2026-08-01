#!/bin/bash
# ============================================================
# Benchmark TTC v1.1 / MCW-2 — 10 paires contradictoires
# Usage: bash test/benchmark.sh [api_url]
# ============================================================
API="${1:-http://localhost:3001}"
PASS=0; FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

echo "═══════════════════════════════════════════════════════"
echo "  Benchmark TTC v1.1 / MCW-2 — KontEx"
echo "  Cible: $API"
echo "═══════════════════════════════════════════════════════"
echo ""

pairs=(
  "Python: len() retourne un entier int|Python: len() retourne un float|01|Python len()"
  "React: useState retourne un tableau de 2 elements state et setState|React: useState retourne un tableau de 3 elements|02|React useState"
  "TypeScript: les types sont effaces a la compilation|TypeScript: les types sont conserves et evalues au runtime|03|TypeScript types"
  "Express 5 supporte les route handlers async sans try catch|Express 5 ne supporte pas lasync et necessite des blocs try catch|04|Express 5 async"
  "pgvector est une extension PostgreSQL pour le stockage vectoriel|pgvector est un framework pour entrainer des modeles de Machine Learning|05|pgvector"
  "Next.js 14 utilise le App Router par defaut|Next.js 14 impose le Pages Router exclusivement|06|Next.js Router"
  "Graphiti: le group_id isole les donnees entre clients|Graphiti: le group_id fusionne les donnees de tous les clients|07|Graphiti"
  "JavaScript: loperateur === verifie la valeur et le type|JavaScript: loperateur === convertit les types avant verification|08|JS ==="
  "Rust: le Borrow Checker garantit la securite memoire a la compilation|Rust: le Garbage Collector nettoie la memoire a lexecution|09|Rust"
  "KontEx B2B2B: isolation par cle composite Business_ID Client_ID|KontEx: tous les locataires partagent une cle unique globale|10|KontEx"
)

for pair in "${pairs[@]}"; do
  IFS='|' read -r coh hall id label <<< "$pair"
  
  Tc=$(curl -s -X POST "$API/detect" -H 'Content-Type: application/json' \
    -d "{\"content\":\"$coh\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'{d.get(\"tension\",1):.4f}|{d.get(\"verdict\",\"?\")}')" 2>/dev/null)
  Tco=$(echo "$Tc" | cut -d'|' -f1); Vco=$(echo "$Tc" | cut -d'|' -f2)
  
  Th=$(curl -s -X POST "$API/detect" -H 'Content-Type: application/json' \
    -d "{\"content\":\"$hall\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'{d.get(\"tension\",1):.4f}|{d.get(\"verdict\",\"?\")}')" 2>/dev/null)
  Tha=$(echo "$Th" | cut -d'|' -f1); Vha=$(echo "$Th" | cut -d'|' -f2)
  
  gap=$(echo "scale=3; $Tha - $Tco" | bc -l)
  disc="❌"
  if (( $(echo "$Tha > $Tco" | bc -l) )); then disc="✅"; PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  
  printf "%-28s %s T_coh=%-8s (%s) → T_hall=%-8s (%s) gap=%+s\n" \
    "$disc #$id $label" "" "$Tco" "$Vco" "$Tha" "$Vha" "$gap"
done

echo ""
echo "═══════════════════════════════════════════════════════"
printf "  Discrimination: %d/%d paires\n" $PASS 10
printf "  Score: %d%%\n" $((PASS*10))
echo "═══════════════════════════════════════════════════════"
