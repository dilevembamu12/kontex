'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAVIGATION = [
  {
    title: 'Main Menu',
    items: [
      { href: '/', label: '📊 Dashboard', icon: 'ti ti-layout-dashboard' },
      { href: '/projects', label: '🚀 Projets', icon: 'ti ti-stack' },
      { href: '/web', label: '🕸️ Toile TTC', icon: 'ti ti-topology-star' },
      { href: '/detect', label: '🔍 Détection', icon: 'ti ti-search' },
      { href: '/import', label: '📥 Import Markdown', icon: 'ti ti-file-import' },
      { href: '/health', label: '💚 Santé', icon: 'ti ti-heartbeat' },
      { href: '/anchoring', label: '⚓ Ancrage', icon: 'ti ti-anchor' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/config', label: '⚙️ LLMs', icon: 'ti ti-settings-cog' },
    ],
  },
];

export default function TemplateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="main-wrapper">
      {/* ========== Header ========== */}
      <header className="navbar-header">
        <div className="page-container topbar-menu">
          <div className="d-flex align-items-center gap-2">
            {/* Logo */}
            <Link href="/" className="logo">
              <span className="logo-light">
                <span className="logo-lg">
                  <img src="/template/assets/img/logo.svg" alt="KontEx" style={{ height: 32 }} />
                </span>
                <span className="logo-sm">
                  <img src="/template/assets/img/logo-small.svg" alt="KontEx" style={{ height: 28 }} />
                </span>
              </span>
            </Link>

            {/* Mobile toggle */}
            <button
              className="mobile-btn btn border-0 p-0 d-lg-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <i className="ti ti-menu-deep fs-24 text-white"></i>
            </button>

            <span className="d-none d-lg-block text-white fw-semibold ms-3">
              KontEx — TTC Engine v0.1
            </span>
          </div>

          {/* Right side */}
          <div className="d-flex align-items-center gap-3">
            <span className="badge bg-purple text-white">
              <i className="ti ti-rocket me-1"></i>B2B2B
            </span>
            <div className="d-flex align-items-center gap-2">
              <div className="avatar avatar-sm bg-soft-primary rounded-circle">
                <span className="text-primary fw-bold">K</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========== Sidebar ========== */}
      <div className={`sidebar ${sidebarOpen ? 'show' : ''}`} id="sidebar">
        <div className="sidebar-logo d-lg-none">
          <Link href="/" className="logo logo-normal">
            <img src="/template/assets/img/logo.svg" alt="KontEx" style={{ height: 28 }} />
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <i className="ti ti-x align-middle"></i>
          </button>
        </div>

        <div className="sidebar-inner">
          <div id="sidebar-menu" className="sidebar-menu">
            <ul>
              {NAVIGATION.map((section, i) => (
                <Fragment key={i}>
                  <li className="menu-title"><span>{section.title}</span></li>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href} className={isActive ? 'active' : ''}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <i className={item.icon}></i>
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ========== Main Content ========== */}
      <div className="page-wrapper">
        <div className="content container-fluid">{children}</div>
      </div>
    </div>
  );
}
