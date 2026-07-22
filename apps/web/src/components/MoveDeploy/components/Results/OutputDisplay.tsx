/**
 * Terminal-style output display component with syntax highlighting and copy functionality
 */

import { Copy, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface OutputDisplayProps {
  output: string;
  type?: 'success' | 'error' | 'info';
  maxHeight?: number;
  showLineNumbers?: boolean;
  copyable?: boolean;
  className?: string;
}

const TYPE_STYLES = {
  success: {
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
    text: 'text-green-300',
  },
  error: {
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
    text: 'text-red-300',
  },
  info: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    text: 'text-blue-300',
  },
};

export function OutputDisplay({
  output,
  type = 'info',
  maxHeight = 400,
  showLineNumbers = false,
  copyable = true,
  className = '',
}: OutputDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);
  const styles = TYPE_STYLES[type];

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      // Consider at bottom if within 10px of bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(isAtBottom);
    }
  };

  const lines = output.split('\n');

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border ${styles.border} ${styles.bg} rounded-t-lg`}>
        <span className="text-xs font-medium text-muted-foreground">Output</span>
        <div className="flex items-center gap-2">
          {copyable && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              title="Copy output"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className={`border-x border-b ${styles.border} bg-black/40 rounded-b-lg overflow-auto`}
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="font-mono text-xs">
          {lines.map((line, index) => (
            <div
              key={index}
              className="flex hover:bg-white/5 transition-colors"
            >
              {showLineNumbers && (
                <span className="sticky left-0 px-3 py-1 text-gray-600 select-none text-right min-w-[3rem] bg-black/20">
                  {index + 1}
                </span>
              )}
              <pre className={`px-3 py-1 ${styles.text} whitespace-pre-wrap break-all flex-1`}>
                {line || ' '}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll to bottom indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (outputRef.current) {
              outputRef.current.scrollTop = outputRef.current.scrollHeight;
              setAutoScroll(true);
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full shadow-lg transition-colors"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
