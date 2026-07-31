import { useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Returns a stable `copy(text, label)` function that writes to the
 * clipboard and shows a "{label} copied" toast - the pattern every screen
 * in this app re-implements inline.
 */
export function useCopyToClipboard() {
  return useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }, []);
}

export default useCopyToClipboard;
