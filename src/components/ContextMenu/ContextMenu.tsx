import { useEffect, useRef, useState, useCallback } from 'react';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Generic Context Menu
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  checked?: boolean;
  /** Optional color for pill-style rendering (e.g. speaker colors). */
  color?: string;
  children?: MenuItem[];
  /** If set, this item renders as an inline text input with submit. */
  inputPlaceholder?: string;
  /** Called with the entered text when inputPlaceholder item is submitted. */
  onInput?: (value: string) => void;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Reposition if menu would overflow viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x;
    const ny = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[160px] rounded-lg border border-wall-border bg-wall-surface py-1 shadow-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="my-1 h-px bg-wall-border" />;
        }
        if (item.children) {
          return <SubMenu key={i} item={item} onClose={onClose} />;
        }
        return (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className={`flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[11px] ${
              item.danger
                ? 'text-red-400 hover:bg-red-900/20'
                : item.disabled
                  ? 'cursor-not-allowed text-wall-muted'
                  : 'text-wall-text hover:bg-wall-border'
            }`}
          >
            {item.icon && <span className="w-4 flex items-center justify-center"><SvgIcon name={item.icon} size={12} /></span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubMenu — hover-triggered child menu
// ---------------------------------------------------------------------------

function SubMenu({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<'right' | 'left'>('right');

  useEffect(() => {
    if (!open || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    setSide(rect.right + 160 > window.innerWidth ? 'left' : 'right');
  }, [open]);

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(e) => {
        if (subRef.current && subRef.current.contains(e.relatedTarget as Node)) return;
        setOpen(false);
      }}
    >
      <button
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[11px] text-wall-text hover:bg-wall-border"
      >
        {item.icon && <span className="w-4 flex items-center justify-center"><SvgIcon name={item.icon} size={12} /></span>}
        <span className="flex-1">{item.label}</span>
        <span className="text-[9px] text-wall-subtle">{'\u25B8'}</span>
      </button>
      {open && item.children && (
        <div
          ref={subRef}
          className="absolute top-0 z-[101] min-w-[140px] rounded-lg border border-wall-border bg-wall-surface py-1 shadow-xl"
          style={side === 'right' ? { left: '100%' } : { right: '100%' }}
          onMouseLeave={() => setOpen(false)}
        >
          {item.children.map((child, j) => {
            if (child.separator) {
              return <div key={j} className="my-1 h-px bg-wall-border" />;
            }
            if (child.inputPlaceholder) {
              return <SubMenuInput key={j} item={child} onClose={onClose} />;
            }
            return (
              <button
                key={j}
                onClick={() => { child.onClick(); onClose(); }}
                className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[11px] text-wall-text hover:bg-wall-border"
              >
                <span className="w-4 text-center text-[10px]">
                  {child.checked ? '\u2713' : ''}
                </span>
                {child.icon && <SvgIcon name={child.icon} size={12} />}
                {child.color ? (
                  <span
                    className="text-[10px] font-bold rounded-lg px-1.5 py-px"
                    style={{ color: child.color, background: `${child.color}18` }}
                  >
                    {child.label}
                  </span>
                ) : (
                  child.label
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubMenuInput — inline text input rendered inside a submenu
// ---------------------------------------------------------------------------

function SubMenuInput({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus when mounted
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    item.onInput?.(v);
    onClose();
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={item.inputPlaceholder}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onClose();
        }}
        className="flex-1 min-w-0 rounded border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[11px] text-wall-text outline-none"
      />
      <button
        onClick={submit}
        className="cursor-pointer rounded border-none bg-green-600 px-1.5 py-0.5 text-[10px] text-white"
      >
        {'\u2713'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook for managing context menu state
// ---------------------------------------------------------------------------

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const show = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return { menu, show, close };
}
