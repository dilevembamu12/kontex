# 🌌 Théorie de la Toile Cosmologique (TTC)

[![Version](https://img.shields.io/badge/version-1.0-blue)](https://github.com/dilevembamu12/theorie-toile-cosmologique-TTC)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/status-Research%20In%20Progress-orange)](https://dileve.com)

> **Un cadre unifié pour la physique fondamentale** — La réalité observable émerge de trois champs scalaires : cohérence ($\Gamma$), phase ($\Phi$) et tension ($T$).

---

## 🎯 Résumé

La **Théorie de la Toile Cosmologique (TTC)** propose que l'univers est tissé de trois champs scalaires fondamentaux — $\Gamma$ (cohérence), $\Phi$ (phase) et $T$ (tension) — qui constituent le « tissu » sous-jacent de la réalité physique.

$$\boxed{\mathcal{W} = (\Gamma, \Phi, T)}$$

La TTC ambitionne de faire émerger de ce cadre unique :
- La relativité générale et la mécanique quantique
- Le Modèle Standard de la physique des particules
- Le modèle cosmologique $\Lambda$CDM
- Les courbes de rotation galactiques (testées sur 175 galaxies SPARC)
- Les matrices de mélange CKM et PMNS

---

## 📂 Structure du projet

| Fichier | Description |
|---------|-------------|
| `TTC-White-Paper.md` | **White Paper principal** — Théorie complète, postulats, équations |
| `TTC-session-globale.md` | Journal de session — Historique complet de co-construction |
| `TTC-benchmark-catalogue.md` | Catalogue de tous les postulats et formules à dériver |
| `TTC-maxwell-derivation.md` | Dérivation des équations de Maxwell depuis la TTC |
| `TTC-puissance-max-onde.md` | Calcul de la puissance maximale des ondes TTC |
| `TTC-note-Pmax-c5-sur-G.md` | Note sur $P_{max} = c^5/G$ |
| `TTC-demo-Pmax-etape-par-etape.md` | Démonstration pas à pas |
| `TTC-tully-fisher-sparc.md` | Test de la relation de Tully-Fisher sur SPARC |
| `analyse-critique-TTC-deepseek.md` | Analyse critique complète (30+ sections) |
| `critique-contreverification-chatgpt.md` | Contre-vérification externe |
| `sparc_analysis.py` | Script d'analyse des données SPARC |
| `tcm1d_v2_spherical.py` | Modèle MCW-1 sphérique |
| `test_aTTC.py` | Test du paramètre $a_{TTC}$ |
| `test_tully_fisher.py` & `v2` | Tests de la relation de Tully-Fisher |
| `TTC-thumbnail-Pmax.html` | Visuel interactif $P_{max}$ |
| `mcw1_*/` | Résultats MCW-1 (naines, SPARC) |
| `SPARC_data/` | Données SPARC — 175 galaxies |

---

## 🔬 Résultats clés

### ✅ Succès
- **CKM** : $s_{23}$ à 0.2σ, $s_{13}$ à 0.4σ, $\delta$ à 0.05σ — spectaculaire
- **Courbes plates** : $\Gamma \propto 1/r \Rightarrow$ courbes de rotation plates (prouvé analytiquement)
- **$N_g = 3$** : 3 champs scalaires $\Rightarrow$ 3 générations de fermions (prédit)
- **Hiérarchie des masses** : $m_1 \ll m_2 \ll m_3$ émerge naturellement

### 🟡 En cours
- **Relation de Tully-Fisher** ($v_\infty^4 \propto M_b$) : non dérivée du lagrangien
- **PMNS** : $\theta_{12}$ à 2.6σ, $\theta_{23}=45°$ (falsifiable)
- **Corrélation** $r_c \propto 1/v_\infty$ : réfutée sur SPARC (pente +0.66)

### 🔴 À résoudre
- **$\Sigma m_\nu$** : prédiction 0.01-0.02 eV exclue par les oscillations
- **Réduction des paramètres libres** : non atteinte pour le secteur fermions

---

## 🚀 Démarrage rapide

### Prérequis
- Python 3.8+
- Bibliothèques : `numpy`, `scipy`, `matplotlib`, `pandas`

### Exécuter les tests
```bash
# Test aTTC
python test_aTTC.py

# Analyse SPARC
python sparc_analysis.py

# Test Tully-Fisher
python test_tully_fisher_v2.py
```

---

## 👤 Auteur

**Dileve MBAMU**
- Site : [dileve.com](https://dileve.com)
- Contact : contact@dileve.com
- GitHub : [@dilevembamu12](https://github.com/dilevembamu12)

**Co-auteur scientifique**
- DeepSeek V4 Pro (GitHub Copilot)

---

## 📜 Citation

```bibtex
@unpublished{MBAMU2026TTC,
  title     = {Théorie de la Toile Cosmologique (TTC) — White Paper v1.0},
  author    = {Dileve MBAMU and DeepSeek V4 Pro},
  year      = {2026},
  note      = {Recherche en cours},
  url       = {https://github.com/dilevembamu12/theorie-toile-cosmologique-TTC}
}
```

---

## ⚠️ Avertissement

Ce projet est une **recherche théorique en cours**. Les résultats présentés sont préliminaires et n'ont pas été validés par une revue par les pairs. Toute contribution, vérification ou critique est bienvenue.

---

> *« La physique théorique fait face à un problème de fragmentation. La TTC propose un cadre commun. »*
