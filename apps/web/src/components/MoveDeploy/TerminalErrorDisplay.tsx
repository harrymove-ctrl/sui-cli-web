import { motion } from 'framer-motion';
import { Copy, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * The Sui CLI writes warnings and build progress to the same stream as real
 * failures, so the raw text is mostly noise. A publish that fails on a protocol
 * mismatch reads as:
 *
 *   Publish failed: [warning] CLI's protocol version is 123, but ...
 *   Consider installing the latest version of the CLI - https://...
 *   INCLUDING DEPENDENCY MoveStdlib
 *   BUILDING my_project
 *
 * - none of which is the error. Split the stream so each part can be shown for
 * what it is, and so an empty `problem` can be called out honestly rather than
 * dressing up a warning as the cause.
 */
export function splitCliOutput(raw: string): {
  problem: string[];
  warnings: string[];
  progress: string[];
} {
  const problem: string[] = [];
  const warnings: string[] = [];
  const progress: string[] = [];
  // Warnings wrap onto unprefixed continuation lines; keep attaching them until
  // a blank line or a line that clearly starts something else.
  let inWarning = false;

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/^Publish failed:\s*/i, '').replace(/^Upgrade failed:\s*/i, '');
    const trimmed = line.trim();

    if (/^\[?warning\]?/i.test(trimmed)) {
      warnings.push(trimmed.replace(/^\[warning\]\s*/i, ''));
      inWarning = true;
      continue;
    }
    if (/^(INCLUDING|BUILDING|FETCHING|UPDATING|COMPILING)\b/i.test(trimmed)) {
      progress.push(trimmed);
      inWarning = false;
      continue;
    }
    if (!trimmed) continue;
    // A blank line does NOT end the warning block: the CLI separates its
    // protocol-mismatch warning from its follow-up advice with one, and that
    // advice was landing in `problem` as if it were the failure. Only a real
    // error-looking line ends it.
    const looksLikeError =
      /^(error|failed|caused by|panicked|thread '|unable to|cannot|could not)\b/i.test(trimmed) ||
      /:\d+:\d+/.test(trimmed);
    if (inWarning && !looksLikeError) {
      warnings.push(trimmed);
      continue;
    }
    inWarning = false;
    problem.push(trimmed);
  }

  return { problem, warnings, progress };
}

/** Render a line, turning bare URLs into real links. */
function withLinks(line: string) {
  const parts = line.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface TerminalErrorDisplayProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  suggestions?: string[];
}

export function TerminalErrorDisplay({
  error,
  title = 'ERROR',
  onRetry,
  suggestions = [],
}: TerminalErrorDisplayProps) {
  const [showCopied, setShowCopied] = useState(false);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setShowCopied(true);
      toast.success('Error copied to clipboard');
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Generate smart suggestions based on error content
  const getSmartSuggestions = () => {
    if (suggestions.length > 0) return suggestions;

    const errorLower = error.toLowerCase();
    const smartSuggestions: string[] = [];

    if (errorLower.includes('dependency') || errorLower.includes('dependencies')) {
      smartSuggestions.push(
        'Run with --skip-dependency-verification flag if dependency sources are outdated'
      );
      smartSuggestions.push('Update dependency versions in Move.toml');
    }
    if (errorLower.includes('unexpected token') || errorLower.includes('syntax')) {
      smartSuggestions.push('Check syntax errors in your Move files');
      smartSuggestions.push('Verify all semicolons and braces are properly closed');
    }
    if (errorLower.includes('gas') || errorLower.includes('insufficient')) {
      smartSuggestions.push('Increase gas budget (current: 100000000 MIST)');
      smartSuggestions.push('Request SUI from faucet if balance is low');
    }
    if (errorLower.includes('not found') || errorLower.includes('cannot find')) {
      smartSuggestions.push('Verify the package path is correct');
      smartSuggestions.push('Ensure Move.toml exists in the directory');
    }
    if (errorLower.includes('build') || errorLower.includes('compile')) {
      smartSuggestions.push('Run build first to check for compilation errors');
      smartSuggestions.push('Check all module dependencies are included');
    }

    return smartSuggestions.length > 0
      ? smartSuggestions
      : [
          'Check the error details above for specific issues',
          'Verify your Move package structure is correct',
          'Ensure you have the latest Sui CLI version',
          'Try running the command manually to see full output',
        ];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative"
    >
      {/* Terminal Container */}
      <div
        className="relative bg-card/95 backdrop-blur-md border border-error/40 rounded-lg overflow-hidden font-mono shadow-2xl shadow-error/20"
        style={{
          boxShadow: '0 0 24px rgba(255, 69, 58, 0.18)',
        }}
      >
        {/* Scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 69, 58, 0.04) 2px, rgba(255, 69, 58, 0.04) 4px)',
          }}
        />

        {/* Terminal glow effect */}
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <div className="absolute inset-0 bg-gradient-to-b from-error/10 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-error/10 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Terminal Header */}
          <div className="border-b border-error/40 bg-error/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{
                    scale: 1,
                    rotate: [0, -5, 5, -5, 5, 0],
                  }}
                  transition={{
                    scale: { type: 'spring', stiffness: 200 },
                    rotate: { duration: 0.5, delay: 0.2 },
                  }}
                >
                  <XCircle
                    className="w-5 h-5 text-error"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))',
                    }}
                  />
                </motion.div>
                <div>
                  <div className="text-error text-sm font-bold tracking-wide">✗ {title}</div>
                  <div className="text-error/70 text-xs mt-0.5">Operation failed</div>
                </div>
              </div>
              <button
                type="button"
                onClick={copyError}
                className="p-2 hover:bg-error/15 rounded transition-colors group relative"
                title="Copy error"
              >
                {showCopied ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-success text-xs"
                  >
                    ✓
                  </motion.span>
                ) : (
                  <Copy className="w-4 h-4 text-error/70 group-hover:text-error" />
                )}
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-4 space-y-4">
            {(() => {
              const { problem, warnings, progress } = splitCliOutput(error);
              return (
                <>
                  {/* What actually went wrong */}
                  <div className="space-y-0 text-xs">
                    <div className="text-error/70 font-semibold">
                      ┌─ ERROR DETAILS ─────────────────────────────────┐
                    </div>
                    <div className="bg-muted border-l-2 border-r-2 border-error/25 px-4 py-3 space-y-1 max-h-[400px] overflow-y-auto">
                      {problem.length > 0 ? (
                        problem.map((line, idx) => (
                          <div key={idx} className="text-error leading-relaxed font-mono">
                            {withLinks(line)}
                          </div>
                        ))
                      ) : (
                        <div className="text-muted-foreground leading-relaxed">
                          The CLI didn't report a specific error - it only emitted the warnings
                          below. That usually means the command failed during the build step.
                        </div>
                      )}
                    </div>
                    <div className="text-error/70 font-semibold">
                      └─────────────────────────────────────────────────┘
                    </div>
                  </div>

                  {/* Warnings are not the failure - give them their own colour. */}
                  {warnings.length > 0 && (
                    <div className="space-y-0 text-xs">
                      <div className="text-warning/80 font-semibold">
                        ┌─ WARNINGS ──────────────────────────────────────┐
                      </div>
                      <div className="bg-muted border-l-2 border-r-2 border-warning/25 px-4 py-3 space-y-1">
                        {warnings.map((line, idx) => (
                          <div key={idx} className="text-warning leading-relaxed">
                            {withLinks(line)}
                          </div>
                        ))}
                      </div>
                      <div className="text-warning/80 font-semibold">
                        └─────────────────────────────────────────────────┘
                      </div>
                    </div>
                  )}

                  {/* Progress is context, not a problem - collapsed by default. */}
                  {progress.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Build log ({progress.length} line{progress.length !== 1 ? 's' : ''})
                      </summary>
                      <div className="mt-1 bg-muted rounded px-3 py-2 space-y-0.5">
                        {progress.map((line, idx) => (
                          <div key={idx} className="text-muted-foreground font-mono">
                            {line}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              );
            })()}

            {/* Suggestions */}
            {(() => {
              const smartSuggestions = getSmartSuggestions();
              return (
                smartSuggestions.length > 0 && (
                  <div className="space-y-0 text-xs">
                    <div className="text-amber-400/70 font-semibold">
                      ┌─ SUGGESTIONS ───────────────────────────────────┐
                    </div>
                    <div className="bg-muted border-l-2 border-r-2 border-warning/25 px-4 py-3 space-y-2">
                      {smartSuggestions.map((suggestion, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.1 }}
                          className="flex items-start gap-2 text-amber-400/90"
                        >
                          <span className="text-amber-500 flex-shrink-0">💡</span>
                          <span>{suggestion}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="text-amber-400/70 font-semibold">
                      └─────────────────────────────────────────────────┘
                    </div>
                  </div>
                )
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {onRetry && (
                <motion.button
                  onClick={onRetry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-error/15 hover:bg-error/25 border border-error/40 rounded text-error text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  [R]etry
                </motion.button>
              )}
              <motion.button
                onClick={() => window.history.back()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-2.5 bg-muted-foreground/10 hover:bg-muted-foreground/20 border border-muted-foreground/30 rounded text-muted-foreground/70 text-sm font-medium transition-colors"
              >
                [C]ancel
              </motion.button>
            </div>
          </div>
        </div>

        {/* Terminal glitch effect on error */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.3, repeat: 2, repeatDelay: 0.5 }}
          className="absolute inset-0 pointer-events-none bg-error/10"
        />
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 3px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(239, 68, 68, 0.4);
          border-radius: 3px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.6);
        }
      `}</style>
    </motion.div>
  );
}
