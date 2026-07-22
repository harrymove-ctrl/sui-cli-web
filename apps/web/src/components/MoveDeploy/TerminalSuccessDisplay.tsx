import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Copy, ExternalLink, Package as PackageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface SuccessField {
  label: string;
  value: string;
  copyable?: boolean;
  link?: string;
  icon?: 'package' | 'object' | 'upgrade';
}

interface TerminalSuccessDisplayProps {
  title: string;
  command?: string;
  fields: SuccessField[];
  message?: string;
  rawOutput?: string; // Optional raw JSON/text output to display
}

export function TerminalSuccessDisplay({
  title,
  command = 'sui client publish --gas-budget 100000000',
  fields,
  message = 'Transaction successful',
  rawOutput
}: TerminalSuccessDisplayProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);

  const copyValue = async (value: string, label: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const truncateAddress = (addr: string) => {
    if (addr.length > 60) {
      return `${addr.slice(0, 40)}...${addr.slice(-12)}`;
    }
    return addr;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative"
    >
      {/* Terminal Container */}
      <div className="relative bg-black/20 backdrop-blur-md border border-success/30 rounded-lg overflow-hidden font-mono shadow-2xl shadow-success/20">
        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(52, 199, 89, 0.03) 2px, rgba(52, 199, 89, 0.03) 4px)',
          }}
        />

        {/* Terminal glow effect */}
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className="absolute inset-0 bg-gradient-to-b from-success/10 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-success/10 via-transparent to-transparent" />
        </div>

        {/* Animated pulse effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.2, 1.5] }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute inset-0 border-2 border-success/50 rounded-lg" />
        </motion.div>

        {/* Content */}
        <div className="relative z-10">
          {/* Terminal Header */}
          <div className="border-b border-success/30 bg-success/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{
                  scale: 1,
                  rotate: 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  delay: 0.1
                }}
              >
                <CheckCircle2 className="w-5 h-5 text-success"
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(52, 199, 89, 0.5))',
                  }}
                />
              </motion.div>
              <div>
                <div className="text-success text-sm font-semibold tracking-wide"
                  style={{ textShadow: '0 0 10px rgba(52, 199, 89, 0.5)' }}
                >
                  ✓ {title}
                </div>
                <div className="text-success text-xs mt-0.5">{message}</div>
              </div>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-4 space-y-4">
            {/* Command Output */}
            <div className="space-y-0 text-xs">
              <div className="text-success/60">┌─ COMMAND OUTPUT ────────────────────────────────┐</div>
              <div className="bg-black/40 border-l-2 border-r-2 border-success/20 px-4 py-3 space-y-1.5">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-success"
                >
                  $ {command}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-success/90 flex items-center gap-2"
                  style={{ textShadow: '0 0 8px rgba(52, 199, 89, 0.3)' }}
                >
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  <span>{message}</span>
                </motion.div>
              </div>
              <div className="text-success/60">└─────────────────────────────────────────────────┘</div>
            </div>

            {/* Results */}
            {fields.map((field, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                className="space-y-0 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="text-cyan-400/80 font-semibold tracking-wide">
                    {field.label}:
                  </div>
                  <div className="flex items-center gap-2">
                    {field.copyable && (
                      <button
                        onClick={() => copyValue(field.value, field.label, idx)}
                        className="p-1.5 hover:bg-success/20 rounded transition-colors group"
                        title="Copy"
                      >
                        {copiedIndex === idx ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-success text-xs"
                          >
                            ✓
                          </motion.span>
                        ) : (
                          <Copy className="w-3 h-3 text-cyan-400/60 group-hover:text-cyan-400" />
                        )}
                      </button>
                    )}
                    {field.link && (
                      <a
                        href={field.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-success/20 rounded transition-colors group"
                        title="Open in explorer"
                      >
                        <ExternalLink className="w-3 h-3 text-cyan-400/60 group-hover:text-cyan-400" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="bg-black/40 border border-success/20 rounded px-3 py-2 mt-1">
                  <code className="text-success/90 text-xs break-all"
                    style={{
                      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                      textShadow: '0 0 8px rgba(52, 199, 89, 0.2)'
                    }}
                  >
                    {truncateAddress(field.value)}
                  </code>
                </div>
              </motion.div>
            ))}

            {/* Raw Output Section (Collapsible) */}
            {rawOutput && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-2"
              >
                <button
                  onClick={() => setShowRawOutput(!showRawOutput)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-success/10 hover:bg-success/10 border border-success/20 hover:border-success/30 rounded transition-colors text-xs"
                >
                  <span className="text-success/80 font-semibold flex items-center gap-2">
                    <PackageIcon className="w-3 h-3" />
                    Raw Transaction Output
                  </span>
                  {showRawOutput ? (
                    <ChevronUp className="w-4 h-4 text-success" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-success" />
                  )}
                </button>

                <AnimatePresence>
                  {showRawOutput && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0 text-xs">
                        <div className="text-success/60">┌─ RAW JSON OUTPUT ───────────────────────────────┐</div>
                        <div className="bg-black/60 border-l-2 border-r-2 border-success/20 px-4 py-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                          <pre className="text-success/70 text-xs whitespace-pre-wrap break-words"
                            style={{
                              fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                              textShadow: '0 0 8px rgba(52, 199, 89, 0.2)'
                            }}
                          >
                            {typeof rawOutput === 'string'
                              ? (() => {
                                  try {
                                    return JSON.stringify(JSON.parse(rawOutput), null, 2);
                                  } catch {
                                    return rawOutput;
                                  }
                                })()
                              : JSON.stringify(rawOutput, null, 2)
                            }
                          </pre>
                        </div>
                        <div className="text-success/60">└─────────────────────────────────────────────────┘</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Bottom decoration */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center pt-2"
            >
              <div className="text-success/80 text-xs tracking-widest">
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              </div>
            </motion.div>
          </div>
        </div>

        {/* Success flash effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="absolute inset-0 pointer-events-none bg-success/20"
        />
      </div>
    </motion.div>
  );
}
