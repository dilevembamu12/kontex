/// @anchor: PROJECT_CONTEXT.md §3.1 — UI Dashboard (Next.js + Tailwind)
/// Layout principal du dashboard KontEx avec sidebar de navigation.

import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'KontEx — Dashboard TTC',
  description: 'Administration de la Toile Cosmologique — Vibe Coding sans hallucination',
};

const NAVIGATION_ITEMS = [
  { href: '/', label: '📊 Vue d\'ensemble' },
  { href: '/web', label: '🕸️ Toile TTC' },
  { href: '/import', label: '📥 Import' },
  { href: '/health', label: '💚 Santé' },
  { href: '/anchoring', label: '⚓ Ancrage' },
  { href: '/config', label: '⚙️ Configuration' },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🪐</span>
              <div>
                <h1 className="text-lg font-bold text-purple-400">KontEx</h1>
                <p className="text-xs text-gray-500">TTC Dashboard v0.1</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {NAVIGATION_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
            <p>KontEx v0.1.0-alpha</p>
            <p>TTC Engine · B2B2B</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
