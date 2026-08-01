/// @anchor: Template CRMS Bootstrap 5 — Intégration KontEx
/// Layout principal avec sidebar + header du template admin.

'use client';

import './globals.css';
import TemplateLayout from '@/components/TemplateLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Bootstrap CSS */}
        <link rel="stylesheet" href="/template/assets/css/bootstrap.min.css" />
        {/* Tabler Icons */}
        <link rel="stylesheet" href="/template/assets/plugins/tabler-icons/tabler-icons.min.css" />
        {/* Simplebar */}
        <link rel="stylesheet" href="/template/assets/plugins/simplebar/simplebar.min.css" />
        {/* Main Template CSS */}
        <link rel="stylesheet" href="/template/assets/css/style.css" id="app-style" />
        {/* Favicon */}
        <link rel="shortcut icon" href="/template/assets/img/favicon.png" />
      </head>
      <body>
        {/* Theme Config Script */}
        <script src="/template/assets/js/theme-script.js" />
        {/* jQuery */}
        <script src="/template/assets/js/jquery-3.7.1.min.js" />
        {/* Bootstrap Bundle */}
        <script src="/template/assets/js/bootstrap.bundle.min.js" />
        {/* Simplebar */}
        <script src="/template/assets/plugins/simplebar/simplebar.min.js" />
        {/* Main Script */}
        <script src="/template/assets/js/script.js" />

        <TemplateLayout>{children}</TemplateLayout>
      </body>
    </html>
  );
}
