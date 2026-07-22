import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  /** Shown inline (and keeps the dialog open) when the last confirm attempt failed. */
  errorMessage?: string | null;
  /** Disables both buttons and shows confirmText as a pending label while the action is in flight. */
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  errorMessage,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      confirmButton: 'bg-red-500/90 hover:bg-red-500 text-white',
      iconBg: 'bg-red-500/10',
    },
    warning: {
      icon: (
        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      confirmButton: 'bg-yellow-500/90 hover:bg-yellow-500 text-black',
      iconBg: 'bg-yellow-500/10',
    },
    default: {
      icon: (
        <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      confirmButton: 'bg-accent/90 hover:bg-accent text-accent-foreground',
      iconBg: 'bg-accent/10',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="bg-background border border-border/50 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="p-6">
          {/* Icon and Title */}
          <div className="flex items-start gap-4">
            <div className={clsx('p-3 rounded-full flex-shrink-0', styles.iconBg)}>
              {styles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="dialog-title" className="text-lg font-semibold text-text-primary mb-1">
                {title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {message}
              </p>
              {errorMessage ? (
                <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2.5 bg-secondary/50 hover:bg-secondary text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors border border-border/30 disabled:opacity-50 disabled:pointer-events-none"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={isConfirming}
            className={clsx(
              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:pointer-events-none',
              styles.confirmButton
            )}
          >
            {isConfirming ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
