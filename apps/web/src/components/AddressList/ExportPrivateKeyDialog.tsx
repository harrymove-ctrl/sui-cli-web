import { useEffect, useState } from 'react';
import { Eye, EyeOff, Copy, AlertTriangle } from 'lucide-react';
import { exportPrivateKey } from '@/api/services/keyManagement';
import toast from 'react-hot-toast';

const CONFIRMATION_PHRASE = 'EXPORT MY KEY';

interface ExportPrivateKeyDialogProps {
  isOpen: boolean;
  address: string;
  alias?: string;
  onClose: () => void;
}

export function ExportPrivateKeyDialog({ isOpen, address, alias, onClose }: ExportPrivateKeyDialogProps) {
  const [step, setStep] = useState<'warning' | 'result'>('warning');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ privateKey: string; keyScheme: string } | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  // Reset every time the dialog opens for a (possibly different) address -
  // the exported key must never linger in state past this dialog's lifetime.
  useEffect(() => {
    if (isOpen) {
      setStep('warning');
      setConfirmText('');
      setError(null);
      setResult(null);
      setIsRevealed(false);
      setIsSubmitting(false);
    }
  }, [isOpen, address]);

  const handleClose = () => {
    // Clear the key out of memory immediately, don't wait for unmount.
    setResult(null);
    setConfirmText('');
    onClose();
  };

  const handleConfirmExport = async () => {
    if (confirmText !== CONFIRMATION_PHRASE) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const exported = await exportPrivateKey(address, confirmText);
      setResult({ privateKey: exported.privateKey, keyScheme: exported.keyScheme });
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.privateKey);
    toast.success('Copied to clipboard - paste it only into your wallet app, then clear your clipboard');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-background border border-border/50 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-red-500/10 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Export Private Key</h3>
            <p className="text-sm text-muted-foreground font-mono truncate max-w-[280px]">
              {alias || address}
            </p>
          </div>
        </div>

        {step === 'warning' && (
          <div className="space-y-4">
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
              <p className="font-medium">This key grants complete control of this wallet.</p>
              <ul className="list-disc list-inside space-y-1 text-red-400/90">
                <li>Never paste it into any chat, AI assistant, or website</li>
                <li>Never share it with anyone, including support staff</li>
                <li>Only enter it directly into a wallet app you trust</li>
              </ul>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Type <span className="font-mono font-semibold text-foreground">{CONFIRMATION_PHRASE}</span> to
                confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                className="w-full px-3 py-2 text-sm font-mono bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-red-500/50"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={confirmText !== CONFIRMATION_PHRASE || isSubmitting}
                className="flex-1 px-4 py-2.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSubmitting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
              Never paste this anywhere except a wallet app you trust. Close this dialog when you're done.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">
                  Private Key ({result.keyScheme})
                </label>
                <button
                  onClick={() => setIsRevealed((v) => !v)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {isRevealed ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 text-xs font-mono bg-secondary border border-border rounded-lg text-foreground break-all min-h-[38px] flex items-center">
                  {isRevealed ? result.privateKey : '•'.repeat(48)}
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
                  title="Copy"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
