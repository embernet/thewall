// ============================================================================
// Safe ReactMarkdown Components — opens links in system browser
// ============================================================================
//
// Prevents external links from navigating the Electron window away from the app.
// All <a> tags rendered by ReactMarkdown call shell.openExternal instead.
// ============================================================================

import React from 'react';

/**
 * Custom ReactMarkdown `components` prop that intercepts link clicks
 * and opens them in the system default browser via Electron shell.
 */
export const safeMarkdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          window.electronAPI?.shell.openExternal(href);
        }
      }}
      title={href}
      className="text-indigo-400 underline cursor-pointer hover:text-indigo-300"
    >
      {children}
    </a>
  ),
};
