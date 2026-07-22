import { useState } from 'react';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import toast from 'react-hot-toast';

type OutputType = 'build' | 'test' | 'error' | 'success' | 'info';

interface EnhancedTerminalOutputProps {
  content: string;
  type: OutputType;
  collapsible?: boolean;
  maxHeight?: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
  defaultOpen?: boolean;
}

function highlightSyntax(text: string, type: OutputType): React.ReactNode {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Error patterns
    if (
      line.toLowerCase().includes('error') ||
      line.toLowerCase().includes('failed') ||
      line.includes('❌')
    ) {
      return (
        <span key={i} className="text-red-400">
          {line}
          {'\n'}
        </span>
      );
    }

    // Success patterns
    if (
      line.toLowerCase().includes('success') ||
      line.toLowerCase().includes('✓') ||
      line.toLowerCase().includes('✅') ||
      line.toLowerCase().includes('passed')
    ) {
      return (
        <span key={i} className="text-green-400">
          {line}
          {'\n'}
        </span>
      );
    }

    // Warning patterns
    if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('⚠')) {
      return (
        <span key={i} className="text-yellow-400">
          {line}
          {'\n'}
        </span>
      );
    }

    // Paths and hex addresses
    const pathOrHexRegex = /(\/[^\s]+|0x[0-9a-fA-F]+)/g;
    if (pathOrHexRegex.test(line)) {
      const parts = line.split(pathOrHexRegex);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.match(pathOrHexRegex)) {
              return (
                <span key={j} className="text-cyan-400">
                  {part}
                </span>
              );
            }
            return part;
          })}
          {'\n'}
        </span>
      );
    }

    // Numbers
    const numberRegex = /\b\d+\b/g;
    if (numberRegex.test(line)) {
      const parts = line.split(numberRegex);
      const numbers = line.match(numberRegex) || [];
      return (
        <span key={i}>
          {parts.map((part, j) => (
            <>
              {part}
              {numbers[j] && <span className="text-purple-400">{numbers[j]}</span>}
            </>
          ))}
          {'\n'}
        </span>
      );
    }

    return (
      <span key={i} className="text-foreground/80">
        {line}
        {'\n'}
      </span>
    );
  });
}

export function EnhancedTerminalOutput({
  content,
  type,
  collapsible = false,
  maxHeight = 'max-h-80',
  showLineNumbers = false,
  copyable = true,
  defaultOpen = true,
}: EnhancedTerminalOutputProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const lines = content.split('\n');
  const lineCount = lines.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const statusColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    build: 'bg-blue-500',
    test: 'bg-yellow-500',
    info: 'bg-cyan-500',
  }[type];

  const TerminalContent = () => (
    <div className="group rounded-lg border border-border/50 overflow-hidden bg-card/30 backdrop-blur-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full animate-pulse', statusColor)} />
          <span className="text-xs font-mono text-muted-foreground uppercase">
            {type} OUTPUT
          </span>
          <span className="text-xs text-muted-foreground/50">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {copyable && (
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {collapsible && (
            <CollapsibleTrigger asChild>
              <button className="p-1.5 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground">
                {isOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </CollapsibleTrigger>
          )}
        </div>
      </div>

      {/* Terminal Content */}
      <CollapsibleContent>
        <div className={cn('relative overflow-auto font-mono text-xs', maxHeight)}>
          {/* Line numbers column */}
          {showLineNumbers && (
            <div
              className="absolute left-0 top-0 bottom-0 w-12
                         bg-muted/20 border-r border-border/30
                         text-muted-foreground/40 text-right pr-2
                         select-none pointer-events-none"
            >
              {lines.map((_, i) => (
                <div key={i} className="leading-6 h-6">
                  {i + 1}
                </div>
              ))}
            </div>
          )}

          {/* Content with syntax highlighting */}
          <pre className={cn('p-4 leading-6', showLineNumbers && 'pl-16')}>
            <code className="text-foreground">{highlightSyntax(content, type)}</code>
          </pre>

          {/* Scanline effect overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20
                       bg-[linear-gradient(transparent_50%,rgba(77,162,255,0.03)_50%)]"
            style={{ backgroundSize: '100% 4px' }}
          />
        </div>
      </CollapsibleContent>
    </div>
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <TerminalContent />
      </Collapsible>
    );
  }

  return <TerminalContent />;
}
