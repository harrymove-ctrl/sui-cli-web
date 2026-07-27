import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, TestTube2, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pie } from '@/components/dither-kit/pie';
import { PieChart } from '@/components/dither-kit/pie-chart';

interface TerminalTestOutputProps {
  output: string;
  passed: number;
  failed: number;
}

export function TerminalTestOutput({ output, passed, failed }: TerminalTestOutputProps) {
  const [showCopied, setShowCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFailures = failed > 0;

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setShowCopied(true);
      toast.success('Test results copied');
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const parseTestOutput = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line) => {
      if (line.includes('Running') || line.includes('Test result')) {
        return { type: 'info', text: line };
      } else if (line.includes('✓') || line.includes('ok') || line.includes('PASS')) {
        return { type: 'pass', text: line };
      } else if (line.includes('✗') || line.includes('FAILED') || line.includes('error')) {
        return { type: 'fail', text: line };
      } else if (line.includes('test_') || line.includes('Testing')) {
        return { type: 'test', text: line };
      }
      return { type: 'normal', text: line };
    });
  };

  const parsedLines = parseTestOutput(output);
  const colorClass = hasFailures ? 'red' : 'green';
  const borderColor = hasFailures ? 'border-error/30' : 'border-success/30';
  const bgColor = hasFailures ? 'bg-error/10' : 'bg-success/10';
  const textColor = hasFailures ? 'text-error' : 'text-success';

  const getLineColor = (type: string) => {
    switch (type) {
      case 'pass':
        return 'text-success/90';
      case 'fail':
        return 'text-error/90';
      case 'test':
        return 'text-cyan-400/80';
      case 'info':
        return 'text-blue-400/70';
      default:
        return 'text-muted-foreground/70';
    }
  };

  // Expanded modal overlay
  const expandedModal = isExpanded && (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={() => setIsExpanded(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`relative w-full max-w-4xl max-h-[85vh] bg-black/95 border ${borderColor} rounded-xl overflow-hidden font-mono shadow-2xl shadow-${colorClass}-500/30`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Expanded Header */}
          <div className={`border-b ${borderColor} ${bgColor} px-4 py-3 flex items-center justify-between sticky top-0 z-10`}>
            <div className="flex items-center gap-2">
              <TestTube2 className={`w-5 h-5 ${textColor}`} style={{ filter: `drop-shadow(0 0 4px rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.5))` }} />
              <span className={`${textColor} text-sm font-semibold tracking-wide`}>TEST RESULTS</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyOutput} className={`p-2 hover:bg-${colorClass}-500/20 rounded transition-colors`} title="Copy results">
                <Copy className={`w-4 h-4 text-${colorClass}-400/60 hover:text-${colorClass}-400`} />
              </button>
              <button onClick={() => setIsExpanded(false)} className={`p-2 hover:bg-${colorClass}-500/20 rounded transition-colors`} title="Minimize">
                <Minimize2 className={`w-4 h-4 text-${colorClass}-400`} />
              </button>
            </div>
          </div>
          {/* Expanded Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">
            <div className={`text-${colorClass}-500/70 mb-3 text-sm`}>$ sui move test</div>
            <div className="space-y-1 mb-6">
              {parsedLines.map((line, idx) => (
                <div key={idx} className={`${getLineColor(line.type)} leading-relaxed text-sm flex items-start gap-2`}
                  style={{ textShadow: line.type === 'fail' ? '0 0 8px rgba(255, 69, 58, 0.3)' : line.type === 'pass' ? '0 0 8px rgba(52, 199, 89, 0.3)' : 'none', fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace' }}>
                  {line.type === 'pass' && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {line.type === 'fail' && <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span>{line.text || '\u00A0'}</span>
                </div>
              ))}
            </div>
            {/* Summary in expanded mode */}
            <div className={`p-4 bg-black/40 border ${borderColor} rounded-lg`}>
              <div className="text-sm font-semibold text-cyan-400/80 mb-2">Summary</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-cyan-400/80">Total Tests:</span>
                <span className={`${textColor} font-semibold`}>{passed + failed}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-success/80 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Passed:</span>
                <span className="text-success font-semibold">{passed}</span>
              </div>
              {failed > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-error/80 flex items-center gap-1.5"><XCircle className="w-4 h-4" />Failed:</span>
                  <span className="text-error font-semibold">{failed}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      {expandedModal}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative"
      >
        {/* Terminal Container */}
        <div className={`relative bg-black/20 backdrop-blur-md border ${borderColor} rounded-lg overflow-hidden font-mono shadow-2xl shadow-${colorClass}-500/20`}>
        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.03) 2px, rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.03) 4px)`,
          }}
        />

        {/* Terminal glow effect */}
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className={`absolute inset-0 bg-gradient-to-b from-${colorClass}-500/10 via-transparent to-transparent`} />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Terminal Header */}
          <div className={`border-b ${borderColor} ${bgColor} px-4 py-2.5 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{
                  scale: 1,
                  ...(hasFailures && { rotate: [0, -10, 10, -10, 10, 0] })
                }}
                transition={{
                  scale: { type: "spring", stiffness: 200 },
                  rotate: { duration: 0.5 }
                }}
              >
                <TestTube2 className={`w-4 h-4 ${textColor}`}
                  style={{ filter: `drop-shadow(0 0 4px rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.5))` }}
                />
              </motion.div>
              <span className={`${textColor} text-xs font-semibold tracking-wide`}
                style={{ textShadow: `0 0 10px rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.5)` }}
              >
                TEST RESULTS
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyOutput}
                className={`p-1.5 hover:bg-${colorClass}-500/20 rounded transition-colors group`}
                title="Copy results"
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
                  <Copy className={`w-3 h-3 text-${colorClass}-400/60 group-hover:text-${colorClass}-400`} />
                )}
              </button>
              <button
                onClick={() => setIsExpanded(true)}
                className={`p-1.5 hover:bg-${colorClass}-500/20 rounded transition-colors group`}
                title="Expand output"
              >
                <Maximize2 className={`w-3 h-3 text-${colorClass}-400/60 group-hover:text-${colorClass}-400`} />
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-4 space-y-4">
            {/* Test Output */}
            <div className="space-y-0 text-xs">
              <div className={`text-${colorClass}-400/60`}>
                ┌─ TEST OUTPUT ───────────────────────────────────┐
              </div>
              <div className={`bg-black/40 border-l-2 border-r-2 border-${colorClass}-500/20 px-4 py-3`}>
                <div className={`text-${colorClass}-500/70 mb-2`}>$ sui move test</div>
                <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
                  {parsedLines.map((line, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`${getLineColor(line.type)} leading-relaxed flex items-start gap-2`}
                      style={{
                        textShadow: line.type === 'fail' ? '0 0 8px rgba(255, 69, 58, 0.3)' :
                                   line.type === 'pass' ? '0 0 8px rgba(52, 199, 89, 0.3)' : 'none',
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    >
                      {line.type === 'pass' && <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />}
                      {line.type === 'fail' && <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />}
                      <span>{line.text || '\u00A0'}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className={`text-${colorClass}-400/60`}>
                └─────────────────────────────────────────────────┘
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-0 text-xs">
              <div className={`text-${colorClass}-400/60`}>
                ┌─ SUMMARY ───────────────────────────────────────┐
              </div>
              <div className={`bg-black/40 border-l-2 border-r-2 border-${colorClass}-500/20 px-4 py-3 space-y-2`}>
                {/* A pass/fail donut, but only once something actually ran - a
                    ring rendered from zeros is just a misleading circle. */}
                {passed + failed > 0 && (
                  <div className="flex items-center gap-4 pb-1">
                    <div className="h-[76px] w-[76px] flex-shrink-0">
                      <PieChart
                        data={[
                          { name: 'Passed', value: passed },
                          { name: 'Failed', value: failed },
                        ].filter((d) => d.value > 0)}
                        config={{
                          Passed: { label: 'Passed', color: 'green' },
                          Failed: { label: 'Failed', color: 'red' },
                        }}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={0.62}
                        bloom="low"
                      >
                        <Pie variant="gradient" />
                      </PieChart>
                    </div>
                    <div className="min-w-0">
                      <div className={`text-lg font-semibold ${textColor}`}>
                        {Math.round((passed / (passed + failed)) * 100)}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {passed} of {passed + failed} passing
                      </div>
                    </div>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-cyan-400/80">Tests:</span>
                  <span className={`${textColor} font-semibold`}>
                    {passed + failed} total
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-success/80 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" />
                    Passed:
                  </span>
                  <span className="text-success font-semibold"
                    style={{ textShadow: '0 0 10px rgba(52, 199, 89, 0.5)' }}
                  >
                    {passed}
                  </span>
                </motion.div>
                {failed > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-error/80 flex items-center gap-1.5">
                      <XCircle className="w-3 h-3" />
                      Failed:
                    </span>
                    <span className="text-error font-semibold"
                      style={{ textShadow: '0 0 10px rgba(255, 69, 58, 0.5)' }}
                    >
                      {failed}
                    </span>
                  </motion.div>
                )}
              </div>
              <div className={`text-${colorClass}-400/60`}>
                └─────────────────────────────────────────────────┘
              </div>
            </div>
          </div>
        </div>

        {/* Flash effect for failures */}
        {hasFailures && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 0.3, repeat: 2, repeatDelay: 0.5 }}
            className="absolute inset-0 pointer-events-none bg-error/10"
          />
        )}
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(${hasFailures ? '239, 68, 68' : '34, 197, 94'}, 0.5);
        }
      `}</style>
    </motion.div>
    </>
  );
}
