// ============================================================================
// Safe ReactMarkdown Components — opens links in system browser
// ============================================================================
//
// Prevents external links from navigating the Electron window away from the app.
// All <a> tags rendered by ReactMarkdown call shell.openExternal instead.
// ============================================================================

import React from 'react';
import remarkGfm from 'remark-gfm';

/** remark plugins for ReactMarkdown — enables GFM auto-linking of plain URLs */
export const safeRemarkPlugins = [remarkGfm];

/** Link style used by both markdown links and the plain-text linkify helper */
const linkClass = 'text-indigo-400 underline cursor-pointer hover:text-indigo-300';

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
      className={linkClass}
    >
      {children}
    </a>
  ),
};

// ── Plain-text URL linkifier (for user messages rendered outside markdown) ────

const URL_RE = /\bhttps?:\/\/[^\s<>()[\]"']+/g;

/**
 * Splits a plain-text string into segments of text and clickable links.
 * Used for user chat messages that aren't processed by ReactMarkdown.
 */
export const Linkify: React.FC<{ text: string }> = ({ text }) => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.shell.openExternal(url);
        }}
        title={url}
        className={linkClass}
      >
        {url}
      </a>,
    );
    last = match.index + url.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};
