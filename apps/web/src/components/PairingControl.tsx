import { Check, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { clearPairingToken, isPaired, setPairingToken } from '@/lib/authToken';

/**
 * Pairs this browser with the local server for the routes that move funds or
 * export key material (see apps/server/src/utils/authToken.ts). The token is
 * never fetched over HTTP - it only ever appears in the server's own
 * terminal output, so pairing means copying it from there.
 */
export function PairingControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [paired, setPaired] = useState(() => isPaired());
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSave = () => {
    if (!input.trim()) {
      toast.error('Paste the token from your terminal first');
      return;
    }
    setPairingToken(input.trim());
    setInput('');
    setIsOpen(false);
    toast.success('Browser paired');
  };

  const handleClear = () => {
    clearPairingToken();
    setPaired(false);
    toast.success('Pairing cleared');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        title={
          paired
            ? 'This browser is paired'
            : 'Pair this browser to export keys, sign, transfer, or pay'
        }
      >
        {paired ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <KeyRound className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{paired ? 'Paired' : 'Pair browser'}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 cursor-default"
          />
          <div className="relative bg-background border border-border/50 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <h3 className="text-lg font-semibold text-foreground mb-1">Pair this browser</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Exporting a key, signing, transferring, or paying requires pairing. Copy the token
              printed in the terminal where you started the server (look for &ldquo;Pairing
              token&rdquo;) and paste it below.
            </p>
            <input
              ref={inputRef}
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Paste pairing token"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2.5 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg text-sm font-medium transition-colors border border-border/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-primary/90 hover:bg-primary text-primary-foreground"
              >
                Pair
              </button>
            </div>
            {paired && (
              <button
                type="button"
                onClick={handleClear}
                className="mt-3 text-xs text-muted-foreground hover:text-error transition-colors"
              >
                Clear pairing on this browser
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
