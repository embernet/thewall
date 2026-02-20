// ============================================================================
// The Wall — SVG Icon Components
// ============================================================================
// Consistent 16x16 icons for the toolbar. All icons accept className for color
// overrides via Tailwind's text-* utilities (uses currentColor).
// ============================================================================

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconMenu(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="3" width="3.5" height="10" rx="0.75" fill="currentColor" stroke="none" />
      <rect x="9.5" y="3" width="3.5" height="10" rx="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 3l9 5-9 5V3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6 13a2 2 0 004 0" />
      <path d="M8 2a4.5 4.5 0 00-4.5 4.5c0 2.5-1 3.5-1.5 4h12c-.5-.5-1.5-1.5-1.5-4A4.5 4.5 0 008 2z" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  );
}

export function IconDollar(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 3.5v9M10 5.75c0-.69-.9-1.25-2-1.25s-2 .56-2 1.25c0 .7.9 1.25 2 1.25s2 .56 2 1.25c0 .69-.9 1.25-2 1.25s-2-.56-2-1.25" />
    </svg>
  );
}

export function IconBot(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2.5" y="5" width="11" height="8.5" rx="2" />
      <circle cx="5.75" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.25" cy="9" r="1" fill="currentColor" stroke="none" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <circle cx="8" cy="1.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClipboard(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="2.5" width="10" height="12" rx="1.5" />
      <path d="M6 2.5V2a2 2 0 014 0v.5" />
      <line x1="5.5" y1="6.5" x2="10.5" y2="6.5" />
      <line x1="5.5" y1="9" x2="10.5" y2="9" />
      <line x1="5.5" y1="11.5" x2="8.5" y2="11.5" />
    </svg>
  );
}

export function IconGraph(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="11" r="1.5" />
      <line x1="5.5" y1="5.2" x2="6.8" y2="10.5" />
      <line x1="10.5" y1="5.2" x2="9.2" y2="10.5" />
      <line x1="12.2" y1="5.5" x2="12.8" y2="9.5" />
    </svg>
  );
}

export function IconSave(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12.5 14H3.5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 013.5 2h7.09a1.5 1.5 0 011.06.44l1.91 1.91a1.5 1.5 0 01.44 1.06V12.5a1.5 1.5 0 01-1.5 1.5z" />
      <rect x="5" y="8.5" width="6" height="4" rx="0.5" />
      <line x1="6" y1="2" x2="6" y2="5" />
      <line x1="10" y1="2" x2="10" y2="5" />
    </svg>
  );
}

export function IconExport(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 2v8" />
      <path d="M5 5l3-3 3 3" />
      <path d="M2 10v2.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V10" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="3" />
      <line x1="8" y1="1.5" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="14.5" y2="8" />
      <line x1="3.4" y1="3.4" x2="4.46" y2="4.46" />
      <line x1="11.54" y1="11.54" x2="12.6" y2="12.6" />
      <line x1="3.4" y1="12.6" x2="4.46" y2="11.54" />
      <line x1="11.54" y1="4.46" x2="12.6" y2="3.4" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z" />
    </svg>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6.25a2 2 0 013.89.65c0 1.33-2 2-2 2" />
      <circle cx="8" cy="11.75" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5l.9 1.6a5 5 0 011.6.65l1.7-.6.7.7-.6 1.7a5 5 0 01.65 1.6L14.5 8l-1.6.9a5 5 0 01-.65 1.6l.6 1.7-.7.7-1.7-.6a5 5 0 01-1.6.65L8 14.5l-.9-1.6a5 5 0 01-1.6-.65l-1.7.6-.7-.7.6-1.7a5 5 0 01-.65-1.6L1.5 8l1.6-.9a5 5 0 01.65-1.6l-.6-1.7.7-.7 1.7.6a5 5 0 011.6-.65z" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <line x1="8" y1="7" x2="8" y2="11.5" />
      <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
