'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  nodes: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const API = 'http://localhost:3001';
        const res = await fetch(`${API}/projects`);
        const data = await res.json();
        setProjects(data.projects || []);
      } catch { /* API inaccessible */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 className="mb-1">🚀 Projets Vibe Coding</h4>
        <p className="text-muted mb-0">Gelez vos projets, importez du code, genere les .cursorrules</p>
      </div>
      <Link href="/projects/new" className="btn btn-purple btn-lg">
        <i className="ti ti-plus me-2"></i>Nouveau Projet
      </Link>
    </div>

    {loading ? (
      <div className="text-center py-5 text-muted">Chargement...</div>
    ) : projects.length === 0 ? (
      <div className="card">
        <div className="card-body text-center py-5">
          <i className="ti ti-folders fs-48 text-muted mb-3 d-block opacity-25"></i>
          <h5>Aucun projet pour le moment</h5>
          <p className="text-muted">Creez votre premier projet Vibe Coding pour initialiser la toile TTC.</p>
          <Link href="/projects/new" className="btn btn-purple mt-2">
            <i className="ti ti-rocket me-2"></i>Initialiser un Projet
          </Link>
        </div>
      </div>
    ) : (
      <div className="row g-3">
        {projects.map(p => (
          <div key={p.id} className="col-md-6 col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="badge bg-soft-purple text-purple fs-6">
                    <i className="ti ti-stack me-1"></i>{p.nodes} nœuds
                  </span>
                </div>
                <h5 className="card-title">{p.name}</h5>
                <p className="text-muted small mb-3">ID: {p.id}</p>
                <div className="d-flex gap-2">
                  <a href={`http://localhost:3001/projects/${p.id}/export-rules`}
                    className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer">
                    <i className="ti ti-download me-1"></i>.cursorrules
                  </a>
                  <Link href="/detect" className="btn btn-sm btn-outline-purple">
                    <i className="ti ti-search me-1"></i>Detecter
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </>);
}
