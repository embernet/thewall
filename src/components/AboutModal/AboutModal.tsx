// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// SVG icons (inline, no external deps)
// ---------------------------------------------------------------------------

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AboutModal({ open, onClose }: AboutModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="relative flex flex-col items-center overflow-hidden rounded-xl border border-wall-border bg-wall-surface shadow-2xl"
        style={{ width: 440 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 cursor-pointer border-none bg-transparent text-[18px] leading-none text-wall-text-dim hover:text-wall-text"
          aria-label="Close"
        >
          ×
        </button>

        {/* Header gradient band */}
        <div
          className="w-full py-10 flex flex-col items-center"
          style={{ background: 'linear-gradient(160deg, #0f0b1e 0%, #1a0f2e 50%, #0c111f 100%)' }}
        >
          <div
            className="text-[42px] font-extrabold tracking-tighter leading-none"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            THE WALL
          </div>
          <div className="mt-2 text-[12px] text-wall-text-dim px-8 text-center">
            AI-powered intelligence surface for meetings, research &amp; thinking
          </div>
          <div className="mt-3 rounded-full border border-wall-border bg-wall-surface/60 px-3 py-1 text-[10px] font-mono text-wall-subtle">
            v0.1.0
          </div>
        </div>

        {/* Body */}
        <div className="flex w-full flex-col items-center gap-5 px-8 py-7">

          {/* Author */}
          <div className="text-center">
            <div className="text-[12px] text-wall-subtle uppercase tracking-wider mb-1">Created by</div>
            <div className="text-[16px] font-bold text-wall-text">Mark Burnett</div>
            <div className="text-[12px] text-wall-text-dim mt-0.5">&copy; 2026</div>
          </div>

          {/* Links */}
          <div className="flex gap-3">
            <a
              href="https://linkedin.com/in/markburnett"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-wall-muted bg-wall-border px-3.5 py-2 text-[12px] font-semibold text-[#0a66c2] transition-colors hover:border-[#0a66c2]/60 hover:bg-[#0a66c2]/10"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
            <a
              href="https://github.com/embernet/thewall"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-wall-muted bg-wall-border px-3.5 py-2 text-[12px] font-semibold text-wall-text transition-colors hover:border-wall-subtle hover:bg-wall-muted"
            >
              <GitHubIcon />
              GitHub
            </a>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-wall-border" />

          {/* Licence */}
          <div className="text-center">
            <div className="text-[11px] text-wall-text-muted leading-relaxed">
              Free to use under the{' '}
              <a
                href="https://github.com/embernet/thewall/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline hover:text-indigo-300"
              >
                MIT Licence
              </a>
            </div>
            <div className="mt-1 text-[10px] text-wall-subtle">
              Use it, modify it, share it — freely.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
