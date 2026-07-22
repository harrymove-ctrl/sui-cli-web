import { useState, useCallback } from 'react';

interface UseCopyToClipboardReturn {
  copied: boolean;
  copiedText: string | null;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for copying text to clipboard with feedback state
 * @param resetDelay - Time in ms before copied state resets (default: 2000)
 * @returns Object with copy function and copied state
 */
export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard API not available');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopiedText(text);

      // Reset after delay
      setTimeout(() => {
        setCopied(false);
        setCopiedText(null);
      }, resetDelay);

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopied(false);
      setCopiedText(null);
      return false;
    }
  }, [resetDelay]);

  const reset = useCallback(() => {
    setCopied(false);
    setCopiedText(null);
  }, []);

  return { copied, copiedText, copy, reset };
}

/**
 * Hook for copying with ID tracking (for multiple copy buttons)
 * @param resetDelay - Time in ms before copied state resets (default: 2000)
 * @returns Object with copy function and copiedId state
 */
export function useCopyWithId(resetDelay = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(async (text: string, id: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard API not available');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);

      // Reset after delay
      setTimeout(() => {
        setCopiedId(null);
      }, resetDelay);

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopiedId(null);
      return false;
    }
  }, [resetDelay]);

  const reset = useCallback(() => {
    setCopiedId(null);
  }, []);

  return { copiedId, copy, reset, isCopied: (id: string) => copiedId === id };
}

export default useCopyToClipboard;
