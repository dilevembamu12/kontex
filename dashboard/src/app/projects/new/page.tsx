'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function VibeCodingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState({
    projectName: '',
    tenantId: '',
    stackBack: 'laravel',
    stackFront: 'react',
    importType: 'github',
    repoUrl: '',
    antiPatterns: `- Ne jamais utiliser 'any' en TypeScript
- Toujours valider les requetes via les FormRequests Laravel
- Ne pas inventer de nouvelles tables SQL non definies dans les migrations
- Utiliser Eloquent exclusivement, pas de requetes SQL brutes
- Les reponses API doivent toujours etre wrappees dans ApiResponse`,
  });

  async function handleCreateProject() {
    setLoading(true);
    try {
      const API = 'http://localhost:3001';
      const res = await fetch(`${API}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.projectName,
          tenantId: formData.tenantId || 'default',
          stack: { back: formData.stackBack, front: formData.stackFront },
          antiPatterns: formData.antiPatterns.split('\n').filter(l => l.trim()),
          repoUrl: formData.importType === 'github' ? formData.repoUrl : undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur reseau' });
    } finally { setLoading(false); }
  }

  function handleDownloadRules() {
    const rules = `# KontEx .cursorrules — Genere le ${new Date().toISOString().split('T')[0]}
# Projet: ${formData.projectName || 'Mon Projet'}
# Stack: ${formData.stackBack} + ${formData.stackFront}
# Tenant: ${formData.tenantId || 'default'}

# === Bouclier Anti-Hallucination (TTC MCW-2) ===
# Regles generees automatiquement — toute violation declenche T > T_crit
${formData.antiPatterns.split('\n').filter(l => l.trim()).map(l => `# ${l.replace(/^- /, '')}`).join('\n')}

# === Conventions du Projet ===
# Backend: ${formData.stackBack === 'laravel' ? 'PHP/Laravel' : 'Node.js/Express'}
# Frontend: ${formData.stackFront === 'react' ? 'React/Next.js' : 'Vue.js/Nuxt'}

# === KontEx MCP Server ===
# L'IA consulte automatiquement le moteur TTC avant chaque generation
# Endpoint: http://localhost:3001/detect
# Methode: TTC v1.1 / MCW-2 — Tension topologique T > 0.10 => HALLUCINATION

# === Instructions pour Cursor ===
# 1. Avant de generer du code, verifier la similarite avec la toile TTC
# 2. Si T > 0.10, NE PAS generer — demander clarification
# 3. Toujours ancrer le code genere dans une source documentaire
# 4. Respecter le principe d'isolation multi-tenant (Business_ID::Client_ID)
`;

    const blob = new Blob([rules], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '.cursorrules'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container-fluid py-4">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
        <div>
          <h2 className="fw-bold mb-0">🚀 Initialisation Vibe Coding</h2>
          <p className="text-muted mb-0">Creation de la Toile Cosmologique & Connexion IDE</p>
        </div>
        <Link href="/" className="btn btn-outline-secondary">
          <i className="ti ti-x me-2"></i>Annuler
        </Link>
      </div>

      <div className="row">
        {/* STEPPER */}
        <div className="col-md-3">
          <div className="list-group list-group-flush rounded-3 border shadow-sm">
            {[
              { num: 1, title: 'Identite & Locataire', sub: 'Isolation Multi-Tenant' },
              { num: 2, title: 'Ingestion Code & Docs', sub: `${formData.stackBack === 'laravel' ? 'Laravel' : 'Express'}, ZIP, GitHub` },
              { num: 3, title: 'Bouclier Semantique', sub: 'Mur des Interdits (Tension)' },
              { num: 4, title: 'Generation IDE', sub: 'Fichiers Cursor & MCP' },
            ].map((s) => (
              <button key={s.num}
                className={`list-group-item list-group-item-action d-flex gap-3 py-3 ${step === s.num ? 'bg-purple text-white border-purple' : 'bg-transparent'}`}
                onClick={() => setStep(s.num)}>
                <span className={`badge ${step === s.num ? 'bg-white text-purple' : 'bg-soft-purple text-purple'} fs-6 rounded-circle`} style={{width:32,height:32}}>{s.num}</span>
                <div>
                  <h6 className="mb-0 fw-bold">{s.title}</h6>
                  <small className={step === s.num ? 'opacity-75' : 'text-muted'}>{s.sub}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CONTENU */}
        <div className="col-md-9">
          <div className="card shadow-sm">
            <div className="card-body p-5">

              {/* ETAPE 1: IDENTITE */}
              {step === 1 && (
                <div>
                  <h4 className="mb-4"><i className="ti ti-building text-purple me-2"></i>1. Contexte du Projet</h4>
                  <div className="mb-4">
                    <label className="form-label text-muted">Nom du Projet</label>
                    <input type="text" className="form-control" placeholder="Ex: E-Commerce Refonte"
                      value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                  </div>
                  <div className="mb-4">
                    <label className="form-label text-muted">Selection du Client (Etancheite Business_ID::Client_ID)</label>
                    <select className="form-select" value={formData.tenantId} onChange={e => setFormData({...formData, tenantId: e.target.value})}>
                      <option value="">Selectionner une agence / client...</option>
                      <option value="cli_omega">Client Omega (Retail)</option>
                      <option value="cli_alpha">Agence Alpha (SaaS)</option>
                    </select>
                    <div className="form-text text-success mt-2"><i className="ti ti-shield-check me-1"></i>Ce choix garantit que l'IA ne croisera jamais ces donnees avec un autre projet.</div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <button className="btn btn-purple px-4" onClick={() => setStep(2)} disabled={!formData.projectName.trim()}>
                      Suivant <i className="ti ti-arrow-right ms-2"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPE 2: INGESTION */}
              {step === 2 && (
                <div>
                  <h4 className="mb-4"><i className="ti ti-cloud-upload text-purple me-2"></i>2. Ingestion & Trepied de Maturite</h4>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-muted">Stack Back-end</label>
                      <select className="form-select" value={formData.stackBack} onChange={e => setFormData({...formData, stackBack: e.target.value})}>
                        <option value="laravel">PHP / Laravel (v10+)</option>
                        <option value="node">Node.js / Express</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted">Stack Front-end</label>
                      <select className="form-select" value={formData.stackFront} onChange={e => setFormData({...formData, stackFront: e.target.value})}>
                        <option value="react">React / Next.js</option>
                        <option value="vue">Vue.js / Nuxt</option>
                      </select>
                    </div>
                  </div>

                  <div className="card mb-4">
                    <div className="card-header fw-bold">Importer un code existant (Optionnel)</div>
                    <div className="card-body">
                      <ul className="nav nav-pills mb-3">
                        <li className="nav-item">
                          <button className={`nav-link ${formData.importType === 'github' ? 'active bg-purple' : 'text-muted'}`}
                            onClick={() => setFormData({...formData, importType: 'github'})}>
                            <i className="ti ti-brand-github me-2"></i>Lien GitHub
                          </button>
                        </li>
                        <li className="nav-item">
                          <button className={`nav-link ${formData.importType === 'zip' ? 'active bg-purple' : 'text-muted'}`}
                            onClick={() => setFormData({...formData, importType: 'zip'})}>
                            <i className="ti ti-file-zip me-2"></i>Upload ZIP
                          </button>
                        </li>
                      </ul>
                      {formData.importType === 'github' ? (
                        <input type="text" className="form-control font-monospace" placeholder="https://github.com/client/repo.git"
                          value={formData.repoUrl} onChange={e => setFormData({...formData, repoUrl: e.target.value})} />
                      ) : (
                        <div className="border rounded p-5 text-center">
                          <i className="ti ti-cloud-upload fs-32 text-muted mb-3 d-block"></i>
                          <p className="text-muted">Glissez-deposez un fichier .zip ici</p>
                          <input type="file" className="form-control" accept=".zip" />
                          <div className="form-text mt-2">Notre parseur AST extraira automatiquement les Controllers Laravel, les modeles Eloquent et les routes sans envoyer le code mort a l'IA.</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <button className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="ti ti-arrow-left me-2"></i>Precedent</button>
                    <button className="btn btn-purple px-4" onClick={() => setStep(3)}>Suivant <i className="ti ti-arrow-right ms-2"></i></button>
                  </div>
                </div>
              )}

              {/* ETAPE 3: BOUCLIER */}
              {step === 3 && (
                <div>
                  <h4 className="mb-4"><i className="ti ti-shield-x text-danger me-2"></i>3. Mur des Interdits (Anti-Hallucination)</h4>
                  <p className="text-muted">Definissez ici ce que l'Agent IA (Cursor) n'a <strong>strictement pas le droit</strong> de generer.</p>
                  <textarea className="form-control font-monospace mb-4" rows={8}
                    placeholder="- Ne jamais utiliser 'any' en TypeScript&#10;- Toujours valider les requetes via les FormRequests Laravel..."
                    value={formData.antiPatterns}
                    onChange={e => setFormData({...formData, antiPatterns: e.target.value})} />
                  <div className="d-flex justify-content-between">
                    <button className="btn btn-outline-secondary" onClick={() => setStep(2)}><i className="ti ti-arrow-left me-2"></i>Precedent</button>
                    <button className="btn btn-purple px-4" onClick={() => { setStep(4); handleCreateProject(); }}>
                      Valider la Toile <i className="ti ti-arrow-right ms-2"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPE 4: RESULTAT */}
              {step === 4 && (
                <div className="text-center py-5">
                  {loading ? (
                    <div>
                      <div className="spinner-border text-purple mb-4" style={{width:64,height:64}}></div>
                      <h4 className="fw-bold">Construction de la Toile Cosmologique...</h4>
                      <p className="text-muted">Extraction AST, ancrage des faits, resolution des equations de champ TTC...</p>
                    </div>
                  ) : result?.error ? (
                    <div className="alert alert-danger">
                      <h5>Erreur</h5>
                      <p>{String(result.error)}</p>
                      <button className="btn btn-outline-danger mt-2" onClick={() => setStep(3)}>Reessayer</button>
                    </div>
                  ) : (
                    <div>
                      <i className="ti ti-sparkles text-purple mb-3 d-block" style={{fontSize:'4rem'}}></i>
                      <h3 className="fw-bold">La Toile Cosmologique est prete !</h3>
                      <p className="text-muted w-75 mx-auto mb-5">
                        KontEx a compile le contexte, ancre les relations {formData.stackBack === 'laravel' ? 'Laravel' : 'Express'}/{formData.stackFront === 'react' ? 'React' : 'Vue'} dans le moteur Rust, et securise le projet sous le locataire <strong>{formData.tenantId || 'Selectionne'}</strong>.
                      </p>
                      <div className="d-flex justify-content-center gap-3">
                        <button className="btn btn-lg btn-success shadow" onClick={handleDownloadRules}>
                          <i className="ti ti-download me-2"></i>Telecharger <code>.cursorrules</code>
                        </button>
                        <Link href="/detect" className="btn btn-lg btn-outline-purple">
                          <i className="ti ti-search me-2"></i>Tester la Detection
                        </Link>
                      </div>
                      <div className="mt-5 p-3 border rounded text-start mx-auto" style={{maxWidth:600}}>
                        <h6 className="text-muted mb-2">Instructions pour le Vibe Coding :</h6>
                        <ol className="text-muted mb-0 small">
                          <li>Placez le fichier <code>.cursorrules</code> a la racine de votre dossier local.</li>
                          <li>Ouvrez Cursor (Cmd+I) et commencez a prompter.</li>
                          <li>L'IA consultera automatiquement le moteur KontEx via MCP sans halluciner sur votre base de donnees.</li>
                        </ol>
                      </div>
                      {result && (
                        <div className="mt-3">
                          <span className="badge bg-soft-success text-success fs-6">
                            ✓ {String((result as Record<string,unknown>).nodesCreated ?? '?')} nœuds ancres · {String((result as Record<string,unknown>).linksCreated ?? '?')} liens tissees
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
