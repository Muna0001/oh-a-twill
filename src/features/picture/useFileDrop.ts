import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Web only: accept a file dropped onto an element. Pass the returned callback as the `ref` of a
 * View (on web a View is a DOM node). `over` is true while a file is dragged over it.
 * Does nothing on iOS and Android.
 */
export function useFileDrop(onFile: (file: File) => void): [setNode: (node: unknown) => void, over: boolean] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [over, setOver] = useState(false);
  const latest = useRef(onFile);
  useEffect(() => {
    latest.current = onFile;
  });

  const attach = useCallback((next: unknown) => {
    const el = next as HTMLElement | null;
    setNode(el && typeof el.addEventListener === 'function' ? el : null);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !node) return;
    // Same as the reference: dragover marks the card, dragleave and drop clear it.
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    };
    const onDragLeave = () => setOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) latest.current(file);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
  }, [node]);

  return [attach, over && node !== null];
}
