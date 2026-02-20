import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title?: string;
  width?: number;
  height?: number;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Renders children into a detached browser window.
 * When the window is closed (by user or programmatically), calls onClose.
 */
export default function WindowPortal({
  title = 'Knowledge Graph',
  width = 900,
  height = 700,
  onClose,
  children,
}: Props) {
  const externalWindow = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Center on screen
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const win = window.open(
      '',
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`,
    );

    if (!win) {
      // Popup blocked — fall back
      onClose();
      return;
    }

    externalWindow.current = win;

    // Copy stylesheets from the parent document
    win.document.title = title;

    // Set up the document body
    win.document.body.style.margin = '0';
    win.document.body.style.padding = '0';
    win.document.body.style.overflow = 'hidden';

    // Copy the dark/light class from the parent
    const isDark = document.documentElement.classList.contains('dark');
    win.document.documentElement.classList.toggle('dark', isDark);
    win.document.documentElement.classList.toggle('light', !isDark);

    // Copy all stylesheets from parent
    const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
    parentStyles.forEach(node => {
      win.document.head.appendChild(node.cloneNode(true));
    });

    // Create the container div
    const container = win.document.createElement('div');
    container.id = 'window-portal-root';
    container.style.width = '100vw';
    container.style.height = '100vh';
    win.document.body.appendChild(container);

    containerRef.current = container;
    setMounted(true);

    // Listen for the external window closing
    const timer = setInterval(() => {
      if (win.closed) {
        clearInterval(timer);
        onClose();
      }
    }, 250);

    return () => {
      clearInterval(timer);
      if (!win.closed) win.close();
      externalWindow.current = null;
      containerRef.current = null;
      setMounted(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !containerRef.current) return null;

  return createPortal(children, containerRef.current);
}
