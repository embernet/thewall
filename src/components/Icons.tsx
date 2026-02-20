// ============================================================================
// The Wall — SVG Icon Components
// ============================================================================
// Consistent 16x16 icons for the entire app. All icons accept className for
// color overrides via Tailwind's text-* utilities (uses currentColor).
//
// Usage:
//   <SvgIcon name="transcript" className="text-red-400" size={14} />
//   <IconSearch className="text-wall-text" />
// ============================================================================

import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

// ---------------------------------------------------------------------------
// Top-bar / global UI icons
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Column-type icons
// ---------------------------------------------------------------------------

/** Microphone — Transcript column */
export function IconMic(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3.5 7.5a4.5 4.5 0 009 0" />
      <line x1="8" y1="12" x2="8" y2="14.5" />
      <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" />
    </svg>
  );
}

/** Pencil — Notes column */
export function IconPencil(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M11.5 1.5l3 3-9 9H2.5v-3z" />
      <line x1="9" y1="4" x2="12" y2="7" />
    </svg>
  );
}

/** Folder — Context column */
export function IconFolder(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 2h5A1.5 1.5 0 0114 6.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z" />
    </svg>
  );
}

/** Eye — Observations column */
export function IconEye(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );
}

/** Lightbulb — Concepts column */
export function IconLightbulb(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6 11.5v1A1.5 1.5 0 007.5 14h1a1.5 1.5 0 001.5-1.5v-1" />
      <path d="M5.5 9.5C4 8.5 3 6.8 3 5a5 5 0 0110 0c0 1.8-1 3.5-2.5 4.5" />
      <line x1="6" y1="9.5" x2="10" y2="9.5" />
      <line x1="8" y1="2" x2="8" y2="3" />
    </svg>
  );
}

/** Brain — Ideas column */
export function IconBrain(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 14V8" />
      <path d="M4.5 4.5C4.5 2.5 6 1.5 8 1.5s3.5 1 3.5 3c0 1-.4 1.8-1 2.3" />
      <path d="M5.5 7c-.7.5-1.5 1.5-1.5 3 0 2 1.5 3 3 3" />
      <path d="M10.5 7c.7.5 1.5 1.5 1.5 3 0 2-1.5 3-3 3" />
      <path d="M4.5 4.5C3.5 5 2.5 6 2.5 7.5 2.5 9 3.5 10 5.5 10" />
      <path d="M11.5 4.5c1 .5 2 1.5 2 3 0 1.5-1 2.5-3 2.5" />
    </svg>
  );
}

/** Question mark — Questions column */
export function IconQuestion(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6a2 2 0 013.9.7c0 1.3-1.9 1.9-1.9 1.9" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Pin — Claims column */
export function IconPin(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5.5 10.5l-3 3" />
      <path d="M9.5 2l4.5 4.5-2.5 1L8 11l-3-3 3.5-3.5z" />
    </svg>
  );
}

/** Warning triangle — Gaps & Risks column */
export function IconWarning(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 2L1.5 13.5h13z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Checkmark circle — Actions column */
export function IconCheck(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 8.5l2 2 4-4.5" />
    </svg>
  );
}

/** Shuffle arrows — Alternatives column */
export function IconShuffle(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 4h8.5a3.5 3.5 0 010 7H9" />
      <path d="M12 2.5L14 4l-2 1.5" />
      <path d="M14 12H5.5a3.5 3.5 0 010-7H7" />
      <path d="M4 13.5L2 12l2-1.5" />
    </svg>
  );
}

/** Microscope — Deep Research column */
export function IconMicroscope(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="5" r="3" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <line x1="5" y1="12" x2="11" y2="12" />
      <line x1="4" y1="14.5" x2="12" y2="14.5" />
      <line x1="8" y1="12" x2="8" y2="14.5" />
    </svg>
  );
}

/** Crystal ball / magnifying glass — Inquiry column */
export function IconInquiry(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="7" cy="7" r="5" />
      <line x1="11" y1="11" x2="14" y2="14" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

/** Lightning bolt — Agent Queue column */
export function IconBolt(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 1.5L4 9h4l-1 5.5L12 7H8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Star — Highlights column */
export function IconStar(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 1.5l2 4.5 4.5.5-3.25 3 1 4.5L8 11.5 3.75 14l1-4.5L1.5 6.5 6 6z" />
    </svg>
  );
}

/** Clipboard check — Summary column */
export function IconSummary(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="2.5" width="10" height="12" rx="1.5" />
      <path d="M6 2.5V2a2 2 0 014 0v.5" />
      <path d="M5.5 8l2 2 3.5-3.5" />
    </svg>
  );
}

/** Trash can — Trash column */
export function IconTrash(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 4h10" />
      <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M4 4l.75 9a1.5 1.5 0 001.5 1.5h3.5a1.5 1.5 0 001.5-1.5L12 4" />
      <line x1="6.5" y1="7" x2="6.5" y2="11.5" />
      <line x1="9.5" y1="7" x2="9.5" y2="11.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card action / context menu icons
// ---------------------------------------------------------------------------

/** Copy clipboard — card copy action */
export function IconCopy(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

/** Edit pencil — card edit action */
export function IconEdit(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M11.5 1.5a2.12 2.12 0 013 3L5 14H2v-3z" />
    </svg>
  );
}

/** Link chain — card link action */
export function IconLink(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6.5 9.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1" />
      <path d="M9.5 6.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1" />
    </svg>
  );
}

/** Speech bubble — speaker */
export function IconSpeaker(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2.5 3h11A1.5 1.5 0 0115 4.5v6a1.5 1.5 0 01-1.5 1.5H5l-3 2.5V4.5A1.5 1.5 0 013.5 3z" />
    </svg>
  );
}

/** Scissors — card split action */
export function IconScissors(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="4.5" cy="4.5" r="2" />
      <circle cx="4.5" cy="11.5" r="2" />
      <line x1="6.3" y1="5.8" x2="13.5" y2="12.5" />
      <line x1="6.3" y1="10.2" x2="13.5" y2="3.5" />
    </svg>
  );
}

/** Document page — file / raw source icon */
export function IconDocument(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 1.5h5.5l4 4v8A1.5 1.5 0 0112 15H4a1.5 1.5 0 01-1.5-1.5v-10.5A1.5 1.5 0 014 1.5z" />
      <path d="M9.5 1.5V5.5h4" />
    </svg>
  );
}

/** Hamburger / more menu */
export function IconMore(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="4" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** X / close */
export function IconClose(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Help section icons
// ---------------------------------------------------------------------------

/** Rocket — Getting Started */
export function IconRocket(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 2C8 2 6 5 6 9s2 5 2 5 2-1 2-5-2-7-2-7z" />
      <path d="M6 10l-2.5 1.5 1-2.5" />
      <path d="M10 10l2.5 1.5-1-2.5" />
      <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Ruler / template — Session Templates */
export function IconTemplate(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="6" y1="6" x2="6" y2="14" />
    </svg>
  );
}

/** Playing card — Cards help section */
export function IconCard(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
      <circle cx="6" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Chat bubble — Chat / Inquiry help section */
export function IconChat(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 2.5h10A1.5 1.5 0 0114.5 4v6a1.5 1.5 0 01-1.5 1.5H6L3 14V4a1.5 1.5 0 011-1.42z" />
      <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" />
      <line x1="5.5" y1="8" x2="9" y2="8" />
    </svg>
  );
}

/** Web / spider web — Knowledge Graph */
export function IconWeb(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="2.5" />
      <line x1="8" y1="1.5" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" />
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}

/** Keyboard — Shortcuts help section */
export function IconKeyboard(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="1" y="3.5" width="14" height="9" rx="1.5" />
      <line x1="4" y1="6.5" x2="5.5" y2="6.5" />
      <line x1="7" y1="6.5" x2="9" y2="6.5" />
      <line x1="10.5" y1="6.5" x2="12" y2="6.5" />
      <line x1="4" y1="9.5" x2="12" y2="9.5" />
    </svg>
  );
}

/** Theater masks — Simulation */
export function IconMasks(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 3.5C3 2.5 5.5 2 7 2.5c1.5.5 2 2.5 1.5 4.5s-2 3-3.5 2.5S2 7 2.5 5" />
      <circle cx="4.5" cy="5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
      <path d="M4.5 7a2 2 0 002-1" />
      <path d="M9 7.5c0-1 2.5-1.5 4-.5s2 2.5 1.5 4.5-2 3-3.5 2.5S8 11 8.5 9" />
      <circle cx="11" cy="9.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="0.5" fill="currentColor" stroke="none" />
      <path d="M11.5 12a2 2 0 01-2-1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Export format icons
// ---------------------------------------------------------------------------

/** JSON braces */
export function IconJson(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5 2C3.5 2 3 3 3 4v2.5C3 7.5 2 8 2 8s1 .5 1 1.5V12c0 1 .5 2 2 2" />
      <path d="M11 2c1.5 0 2 1 2 2v2.5C13 7.5 14 8 14 8s-1 .5-1 1.5V12c0 1-.5 2-2 2" />
    </svg>
  );
}

/** Package box — compact JSON */
export function IconPackage(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 5l6-3 6 3v6l-6 3-6-3z" />
      <line x1="8" y1="8" x2="8" y2="14" />
      <line x1="2" y1="5" x2="8" y2="8" />
      <line x1="14" y1="5" x2="8" y2="8" />
    </svg>
  );
}

/** Markdown */
export function IconMarkdown(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M3.5 10V6l2 2.5L7.5 6v4" />
      <path d="M12.5 8.5l-2-2v4" />
    </svg>
  );
}

/** Chart bars — CSV */
export function IconChart(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="8" width="3" height="6" rx="0.5" />
      <rect x="6.5" y="4" width="3" height="10" rx="0.5" />
      <rect x="11" y="2" width="3" height="12" rx="0.5" />
    </svg>
  );
}

/** Globe — HTML */
export function IconGlobe(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" />
    </svg>
  );
}

/** Diamond — Obsidian */
export function IconDiamond(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 1.5L14.5 8 8 14.5 1.5 8z" />
      <path d="M4 4l4 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Template icons
// ---------------------------------------------------------------------------

/** Target / bullseye — Strategy */
export function IconTarget(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Balance scale — Decision Making */
export function IconBalance(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="3" y1="14" x2="13" y2="14" />
      <line x1="3" y1="5" x2="13" y2="5" />
      <path d="M3 5l-1.5 5h5L5 5" />
      <path d="M13 5l-1.5 5h-5L8 5" />
    </svg>
  );
}

/** Refresh / cycle — Retrospective */
export function IconRefresh(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2.5 8a5.5 5.5 0 019.5-3.7" />
      <path d="M13.5 8a5.5 5.5 0 01-9.5 3.7" />
      <path d="M12 2v3h-3" />
      <path d="M4 14v-3h3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Agent-specific icons (for the 35 built-in agents)
// ---------------------------------------------------------------------------

/** Concept / key extraction — Concept Extractor */
export function IconKey(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="5.5" cy="5.5" r="3.5" />
      <line x1="8.2" y1="8.2" x2="14" y2="14" />
      <line x1="12" y1="14" x2="14" y2="12" />
      <line x1="10.5" y1="12.5" x2="12.5" y2="10.5" />
    </svg>
  );
}

/** Question / ask — Questioner */
export function IconAsk(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 2h10a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H6L3 13.5V3.5A1.5 1.5 0 014 2z" />
      <path d="M7 5.5a1.5 1.5 0 012.9.5c0 1-1.4 1.4-1.4 1.4" />
      <circle cx="8.5" cy="9.5" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Claim identifier — stamp / badge */
export function IconBadge(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="7" r="5" />
      <path d="M5.5 14l2.5-2 2.5 2" />
      <path d="M6 6l2 2 3-3" />
    </svg>
  );
}

/** Gap / hole finder */
export function IconGap(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 5l6 6" />
      <path d="M11 5l-6 6" />
    </svg>
  );
}

/** Checkmark — Action Tracker */
export function IconCheckSquare(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8l2.5 2.5L11 6" />
    </svg>
  );
}

/** Idea spark — Idea Generator */
export function IconSpark(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 1v3" />
      <path d="M8 12v3" />
      <path d="M1 8h3" />
      <path d="M12 8h3" />
      <path d="M3.5 3.5l2 2" />
      <path d="M10.5 10.5l2 2" />
      <path d="M12.5 3.5l-2 2" />
      <path d="M5.5 10.5l-2 2" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

/** Shield check — Claim Verifier */
export function IconShieldCheck(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 1.5l5.5 2v4.5c0 3-2.5 5.5-5.5 6.5-3-1-5.5-3.5-5.5-6.5V3.5z" />
      <path d="M5.5 8l2 2 3.5-3.5" />
    </svg>
  );
}

/** Shield x — Claim Challenger */
export function IconShieldX(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 1.5l5.5 2v4.5c0 3-2.5 5.5-5.5 6.5-3-1-5.5-3.5-5.5-6.5V3.5z" />
      <path d="M6 6l4 4" />
      <path d="M10 6l-4 4" />
    </svg>
  );
}

/** Magnifying glass + sparkle — Clarity Seeker */
export function IconClarity(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
      <path d="M7 4.5v1" />
      <path d="M7 7.5v1" />
      <path d="M5.5 6h3" />
    </svg>
  );
}

/** Bug — Problem Finder */
export function IconBug(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <ellipse cx="8" cy="9" rx="3.5" ry="4.5" />
      <path d="M6 5a2.5 2.5 0 015 0" />
      <path d="M2.5 7l2 1" />
      <path d="M13.5 7l-2 1" />
      <path d="M2 11l2.5-.5" />
      <path d="M14 11l-2.5-.5" />
      <line x1="8" y1="5" x2="8" y2="13" />
    </svg>
  );
}

/** Zigzag — Tension Finder */
export function IconTension(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 12l3-8 3 6 3-6 3 8" />
    </svg>
  );
}

/** Wrench — Solution Finder */
export function IconWrench(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4.5 11.5l6-6a3 3 0 10-4.2-4.2l-6 6a2.5 2.5 0 003.5 3.5z" />
      <path d="M11 8l3 3-2 2-3-3" />
    </svg>
  );
}

/** Clipboard list — Requirement Finder */
export function IconClipboardList(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="2.5" width="10" height="12" rx="1.5" />
      <path d="M6 2.5V2a2 2 0 014 0v.5" />
      <circle cx="5.5" cy="7" r="0.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="7" x2="10.5" y2="7" />
      <circle cx="5.5" cy="9.5" r="0.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="9.5" x2="10.5" y2="9.5" />
      <circle cx="5.5" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="12" x2="10.5" y2="12" />
    </svg>
  );
}

/** Lock — Constraint Finder */
export function IconLock(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
      <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Fork / branch — Alternative Finder */
export function IconFork(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
      <line x1="8" y1="5" x2="8" y2="7" />
      <path d="M8 7l-4 4" />
      <path d="M8 7l4 4" />
    </svg>
  );
}

/** Scale / balance beam — Tradeoff Enumerator */
export function IconScale(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="8" y1="2" x2="8" y2="13" />
      <line x1="3" y1="5" x2="13" y2="5" />
      <path d="M3 5l-1 4h4l-1-4" />
      <path d="M13 5l-1 4h-4L9 5" />
      <line x1="5" y1="13" x2="11" y2="13" />
    </svg>
  );
}

/** Grid pattern — Pattern Finder */
export function IconPattern(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <line x1="5.2" y1="5.2" x2="6.8" y2="6.8" />
      <line x1="10.8" y1="5.2" x2="9.2" y2="6.8" />
      <line x1="5.2" y1="10.8" x2="6.8" y2="9.2" />
      <line x1="10.8" y1="10.8" x2="9.2" y2="9.2" />
    </svg>
  );
}

/** Ban / no — Cliche Finder */
export function IconBan(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" />
    </svg>
  );
}

/** Calendar / plan — Planner */
export function IconCalendar(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="5" y1="1.5" x2="5" y2="4.5" />
      <line x1="11" y1="1.5" x2="11" y2="4.5" />
      <circle cx="5" cy="10" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="10" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="10" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Polish / shine — Refiner */
export function IconPolish(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M10 2l1.5 3L15 6.5l-3.5 1.5L10 11l-1.5-3L5 6.5l3.5-1.5z" />
      <path d="M4 10l.75 1.5L6.25 12.25l-1.5.75L4 14.5l-.75-1.5L1.75 12.25l1.5-.75z" />
    </svg>
  );
}

/** Text align — Summariser */
export function IconTextAlign(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="2" y1="6.5" x2="12" y2="6.5" />
      <line x1="2" y1="10" x2="14" y2="10" />
      <line x1="2" y1="13.5" x2="10" y2="13.5" />
    </svg>
  );
}

/** Fist / challenge — Challenger */
export function IconChallenge(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 2l5 3v4l-5 5-5-5V5z" />
      <path d="M6.5 7l1.5 1.5L11 6" />
    </svg>
  );
}

/** Megaphone — Rhetoric Generator */
export function IconMegaphone(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 7v3l2 .5V6.5z" />
      <path d="M4 6.5l8-3v10l-8-3z" />
      <path d="M4 10.5l1 3.5h1.5l-1-3.5" />
    </svg>
  );
}

/** Handshake / collaborate — Collaborator */
export function IconHandshake(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M1.5 7l3-4h2L8 5l1.5-2h2l3 4" />
      <path d="M1.5 7l3 1L8 11l3.5-3 3-1" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Skeptic eye — Skeptic */
export function IconSkeptic(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
      <line x1="3" y1="4" x2="6" y2="5.5" />
      <line x1="13" y1="4" x2="10" y2="5.5" />
    </svg>
  );
}

/** Thumbs up — Supporter */
export function IconThumbsUp(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5 7l2-5a1.5 1.5 0 012.8.8L9 6h3.5a1.5 1.5 0 011.4 2l-1.5 5a1.5 1.5 0 01-1.4 1H5" />
      <rect x="1.5" y="7" width="3.5" height="7" rx="0.75" />
    </svg>
  );
}

/** Chain / links — Chain of Thought */
export function IconChain(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <ellipse cx="5" cy="5" rx="3" ry="2" transform="rotate(-45 5 5)" />
      <ellipse cx="11" cy="11" rx="3" ry="2" transform="rotate(-45 11 11)" />
      <line x1="6.5" y1="6.5" x2="9.5" y2="9.5" />
    </svg>
  );
}

/** Puzzle — Problem Solver */
export function IconPuzzle(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 5V3h4v.5a1.5 1.5 0 003 0V3h4v4h-.5a1.5 1.5 0 000 3h.5v4H3V5z" />
      <path d="M3 5h.5a1.5 1.5 0 000 3H3" />
    </svg>
  );
}

/** Compass — Coach */
export function IconCompass(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M10.5 5.5l-5 2 2 5 5-2z" fill="currentColor" stroke="none" opacity="0.2" />
      <path d="M10.5 5.5l-5 2 2 5 5-2z" />
    </svg>
  );
}

/** Telescope — Visionary */
export function IconTelescope(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 4l9 5-2 3z" />
      <path d="M11 9l3-1.5-5.5-4L7.5 5" />
      <line x1="7" y1="11" x2="5" y2="14.5" />
      <line x1="9" y1="10" x2="11" y2="14.5" />
    </svg>
  );
}

/** Anchor / ground — Pragmatist */
export function IconAnchor(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="4" r="2" />
      <line x1="8" y1="6" x2="8" y2="14" />
      <path d="M3 10c0 3 2.5 4 5 4s5-1 5-4" />
      <line x1="5" y1="10" x2="11" y2="10" />
    </svg>
  );
}

/** Thought cloud — Thinker */
export function IconThought(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5 11a4 4 0 01-.5-2c0-2.2 1.8-4 4-4a4 4 0 013.8 2.8c1.2.3 2.2 1.4 2.2 2.7 0 1.5-1.2 2.5-2.5 2.5H5.5c-1.4 0-2.5-1-2.5-2.5 0-.5.2-1 .5-1.5z" />
      <circle cx="4" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="14.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Globe search — Researcher */
export function IconResearch(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <ellipse cx="7" cy="7" rx="2.5" ry="5.5" />
      <line x1="1.5" y1="7" x2="12.5" y2="7" />
      <line x1="11" y1="11" x2="14.5" y2="14.5" />
    </svg>
  );
}

/** Network nodes — Knowledge Manager */
export function IconNetwork(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="3" r="2" />
      <circle cx="3" cy="12" r="2" />
      <circle cx="13" cy="12" r="2" />
      <line x1="8" y1="5" x2="4.5" y2="10" />
      <line x1="8" y1="5" x2="11.5" y2="10" />
      <line x1="5" y1="12" x2="11" y2="12" />
    </svg>
  );
}

/** Book / methodology */
export function IconBook(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 2.5h5.5a1 1 0 011 1v10l-1-.75-1.5.75H2z" />
      <path d="M14 2.5H8.5a1 1 0 00-1 1v10l1-.75 1.5.75H14z" />
    </svg>
  );
}

/** Image / picture — Image Generator */
export function IconImage(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.5" cy="6" r="1.5" />
      <path d="M2 11l3.5-3.5 2 2L10.5 6.5 14 10" />
    </svg>
  );
}

/** File import — Import */
export function IconImport(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 10V2" />
      <path d="M5 7l3 3 3-3" />
      <path d="M2 10v2.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V10" />
    </svg>
  );
}

/** Database backup — Export All */
export function IconBackup(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <ellipse cx="8" cy="4" rx="6" ry="2.5" />
      <path d="M2 4v8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V4" />
      <path d="M2 8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
    </svg>
  );
}


// ============================================================================
// SvgIcon — universal icon renderer from string key
// ============================================================================
//
// Maps a string icon key to the corresponding SVG component. Falls back to
// rendering the string as text (supports user-provided emoji in custom
// templates, persona icons, etc.).
//
// Usage:   <SvgIcon name="transcript" className="text-red-400" size={14} />
// ============================================================================

const ICON_MAP: Record<string, (props: IconProps) => JSX.Element> = {
  // Top bar / global
  menu: IconMenu,
  pause: IconPause,
  play: IconPlay,
  bell: IconBell,
  search: IconSearch,
  dollar: IconDollar,
  bot: IconBot,
  clipboard: IconClipboard,
  graph: IconGraph,
  save: IconSave,
  export: IconExport,
  sun: IconSun,
  moon: IconMoon,
  help: IconHelp,
  gear: IconGear,
  info: IconInfo,

  // Column types
  transcript: IconMic,
  notes: IconPencil,
  context: IconFolder,
  observations: IconEye,
  concepts: IconLightbulb,
  ideas: IconBrain,
  questions: IconQuestion,
  claims: IconPin,
  gaps: IconWarning,
  actions: IconCheck,
  alternatives: IconShuffle,
  deep_research: IconMicroscope,
  inquiry: IconInquiry,
  agent_queue: IconBolt,
  highlights: IconStar,
  summary: IconSummary,
  trash: IconTrash,

  // Card actions
  copy: IconCopy,
  edit: IconEdit,
  star: IconStar,
  pin: IconPin,
  link: IconLink,
  speaker: IconSpeaker,
  scissors: IconScissors,
  document: IconDocument,
  more: IconMore,
  close: IconClose,
  'find-related': IconSearch,
  delete: IconTrash,

  // Help sections
  'getting-started': IconRocket,
  rocket: IconRocket,
  templates: IconTemplate,
  template: IconTemplate,
  columns: IconClipboard,
  cards: IconCard,
  agents: IconBot,
  'transcript-audio': IconMic,
  chat: IconChat,
  'knowledge-graph': IconWeb,
  web: IconWeb,
  'search-section': IconSearch,
  'export-section': IconExport,
  settings: IconGear,
  simulation: IconMasks,
  masks: IconMasks,
  shortcuts: IconKeyboard,
  keyboard: IconKeyboard,

  // Export formats
  json: IconJson,
  package: IconPackage,
  markdown: IconMarkdown,
  csv: IconChart,
  chart: IconChart,
  html: IconGlobe,
  globe: IconGlobe,
  obsidian: IconDiamond,
  diamond: IconDiamond,
  'copy-all': IconCopy,
  backup: IconBackup,
  import: IconImport,

  // Template icons
  brainstorm: IconLightbulb,
  research: IconMicroscope,
  decision: IconBalance,
  balance: IconBalance,
  retro: IconRefresh,
  refresh: IconRefresh,
  interview: IconMic,
  strategy: IconTarget,
  target: IconTarget,

  // Agent icons (keyed by agent id)
  'concept-extractor': IconKey,
  'questioner': IconAsk,
  'claim-identifier': IconBadge,
  'gap-finder': IconGap,
  'action-tracker': IconCheckSquare,
  'idea-generator': IconSpark,
  'claim-verifier': IconShieldCheck,
  'claim-challenger': IconShieldX,
  'clarity-seeker': IconClarity,
  'problem-finder': IconBug,
  'tension-finder': IconTension,
  'solution-finder': IconWrench,
  'requirement-finder': IconClipboardList,
  'constraint-finder': IconLock,
  'alternative-finder': IconFork,
  'tradeoff-enumerator': IconScale,
  'pattern-finder': IconPattern,
  'cliche-finder': IconBan,
  'planner': IconCalendar,
  'refiner': IconPolish,
  'summariser': IconTextAlign,
  'challenger': IconChallenge,
  'rhetoric-generator': IconMegaphone,
  'collaborator': IconHandshake,
  'skeptic': IconSkeptic,
  'supporter': IconThumbsUp,
  'chain-of-thought': IconChain,
  'problem-solver': IconPuzzle,
  'coach': IconCompass,
  'visionary': IconTelescope,
  'pragmatist': IconAnchor,
  'thinker': IconThought,
  'researcher': IconResearch,
  'knowledge-manager': IconNetwork,
  'methodology': IconBook,
  'image-generator': IconImage,
};

interface SvgIconProps {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Universal icon component. Renders an SVG if the name matches a known icon
 * key, otherwise falls back to rendering the string as text (for user-provided
 * emoji in custom templates, persona icons, etc.).
 */
export function SvgIcon({ name, className, size, style }: SvgIconProps) {
  const Icon = ICON_MAP[name];
  if (Icon) {
    const sizeProps = size ? { width: size, height: size } : {};
    return <Icon className={className} style={style} {...sizeProps} />;
  }
  // Fallback: render as text (emoji or arbitrary string)
  return <span className={className} style={{ fontSize: size ?? 14, lineHeight: 1, ...style }}>{name}</span>;
}

/** Check whether a string is a known SVG icon key. */
export function hasIcon(name: string): boolean {
  return name in ICON_MAP;
}
