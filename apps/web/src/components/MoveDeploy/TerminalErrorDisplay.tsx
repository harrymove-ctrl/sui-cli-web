import { motion } from 'framer-motion';
import { XCircle, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

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
  suggestions = []
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

  // Parse error to highlight important parts
  const parseErrorLine = (line: string) => {
    const trimmed = line.trim();

    // Detect line type
    const isErrorKeyword = /^(error|Error|ERROR)[\[\]:]/i.test(trimmed);
    const isWarning = /^(warning|Warning)[\[\]:]/i.test(trimmed);
    const isNote = /^\[Note\]|^Note:/i.test(trimmed);
    const isLocation = /at .+:\d+:\d+/i.test(trimmed) || /─+>/.test(trimmed);
    const isCommand = trimmed.startsWith('$') || trimmed.startsWith('sui ');
    const isBuilding = /^(BUILDING|INCLUDING|DEPENDENCY)/i.test(trimmed);

    return {
      text: line,
      type: isErrorKeyword ? 'error' :
            isWarning ? 'warning' :
            isNote ? 'note' :
            isLocation ? 'location' :
            isCommand ? 'command' :
            isBuilding ? 'building' :
            'normal'
    };
  };

  const getLineStyle = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400 font-bold';
      case 'warning':
        return 'text-amber-400 font-semibold';
      case 'note':
        return 'text-blue-400/90';
      case 'location':
        return 'text-purple-400/80';
      case 'command':
        return 'text-blue-400/80';
      case 'building':
        return 'text-cyan-400/80';
      default:
        return 'text-red-500';
    }
  };

  // Generate smart suggestions based on error content
  const getSmartSuggestions = () => {
    if (suggestions.length > 0) return suggestions;

    const errorLower = error.toLowerCase();
    const smartSuggestions: string[] = [];

    if (errorLower.includes('dependency') || errorLower.includes('dependencies')) {
      smartSuggestions.push('Run with --skip-dependency-verification flag if dependency sources are outdated');
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

    return smartSuggestions.length > 0 ? smartSuggestions : [
      'Check the error details above for specific issues',
      'Verify your Move package structure is correct',
      'Ensure you have the latest Sui CLI version',
      'Try running the command manually to see full output'
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
        className="relative bg-black/20 backdrop-blur-md border border-red-500/60 rounded-lg overflow-hidden font-mono shadow-2xl shadow-red-500/60"
        style={{
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.5), inset 0 0 30px rgba(239, 68, 68, 0.15)'
        }}
      >
        {/* Scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239, 68, 68, 0.1) 2px, rgba(239, 68, 68, 0.1) 4px)',
          }}
        />

        {/* Terminal glow effect */}
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-red-500/20 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Terminal Header */}
          <div className="border-b border-red-500/40 bg-red-950/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{
                    scale: 1,
                    rotate: [0, -5, 5, -5, 5, 0]
                  }}
                  transition={{
                    scale: { type: "spring", stiffness: 200 },
                    rotate: { duration: 0.5, delay: 0.2 }
                  }}
                >
                  <XCircle className="w-5 h-5 text-red-500"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))',
                    }}
                  />
                </motion.div>
                <div>
                  <div className="text-red-500 text-sm font-bold tracking-wide"
                    style={{ textShadow: '0 0 12px rgba(239, 68, 68, 0.7)' }}
                  >
                    ✗ {title}
                  </div>
                  <div className="text-red-500/70 text-xs mt-0.5">Operation failed</div>
                </div>
              </div>
              <button
                onClick={copyError}
                className="p-2 hover:bg-red-500/20 rounded transition-colors group relative"
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
                  <Copy className="w-4 h-4 text-red-500/70 group-hover:text-red-500" />
                )}
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-4 space-y-4">
            {/* ASCII Box with Error */}
            <div className="space-y-0 text-xs">
              <div className="text-red-500/70 font-semibold">┌─ ERROR DETAILS ─────────────────────────────────┐</div>
              <div className="bg-black/40 border-l-2 border-r-2 border-red-500/30 px-4 py-3 space-y-1 max-h-[400px] overflow-y-auto">
                {error.split('\n').map((line, idx) => {
                  const parsed = parseErrorLine(line);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`${getLineStyle(parsed.type)} leading-relaxed`}
                      style={{
                        textShadow: parsed.type === 'error' ? '0 0 12px rgba(239, 68, 68, 0.6)' :
                                   parsed.type === 'warning' ? '0 0 10px rgba(251, 191, 36, 0.4)' :
                                   '0 0 8px rgba(239, 68, 68, 0.3)',
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    >
                      {parsed.text || '\u00A0'}
                    </motion.div>
                  );
                })}
              </div>
              <div className="text-red-500/70 font-semibold">└─────────────────────────────────────────────────┘</div>
            </div>

            {/* Suggestions */}
            {(() => {
              const smartSuggestions = getSmartSuggestions();
              return smartSuggestions.length > 0 && (
                <div className="space-y-0 text-xs">
                  <div className="text-amber-400/70 font-semibold">┌─ SUGGESTIONS ───────────────────────────────────┐</div>
                  <div className="bg-black/40 border-l-2 border-r-2 border-amber-500/20 px-4 py-3 space-y-2">
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
                  <div className="text-amber-400/70 font-semibold">└─────────────────────────────────────────────────┘</div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {onRetry && (
                <motion.button
                  onClick={onRetry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }}
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
          className="absolute inset-0 pointer-events-none bg-red-500/10"
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
