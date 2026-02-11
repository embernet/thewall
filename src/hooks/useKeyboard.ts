import { useEffect } from 'react';
import { useSessionStore } from '@/store/session';
import { useTemporalStore } from '@/store/session';

// ---------------------------------------------------------------------------
// Global Keyboard Shortcuts
// ---------------------------------------------------------------------------

export function useKeyboard() {
  const view = useSessionStore(s => s.view);

  useEffect(() => {
    if (view !== 'session') return;

    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+Z — Undo
      if (meta && !e.shiftKey && e.key === 'z' && !isInput) {
        e.preventDefault();
        useTemporalStore.getState().undo();
        return;
      }

      // Cmd+Shift+Z — Redo
      if (meta && e.shiftKey && e.key === 'z' && !isInput) {
        e.preventDefault();
        useTemporalStore.getState().redo();
        return;
      }

      // Escape — close any open panel (handled by React state, but blur focus)
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view]);
}
