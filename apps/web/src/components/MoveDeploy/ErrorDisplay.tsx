import { motion } from 'framer-motion';
import { XCircle, AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface ErrorDisplayProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  suggestions?: string[];
  collapsible?: boolean;
}

export function ErrorDisplay({ 
  error, 
  title = 'Operation Failed',
  onRetry, 
  suggestions,
  collapsible = true 
}: ErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(error);
      toast.success('Error copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-red-500/50 bg-gradient-to-br from-red-50/50 via-red-50/30 to-background dark:from-red-950/20 dark:via-red-950/10 dark:to-background rounded-xl overflow-hidden shadow-lg shadow-red-500/10"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-b border-red-200 dark:border-red-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="p-1.5 bg-red-500/20 rounded-lg"
          >
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </motion.div>
          <div>
            <h4 className="font-semibold text-sm text-red-900 dark:text-red-100">{title}</h4>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">Please check the error details below</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-red-600 dark:text-red-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-4 space-y-3">
            {/* Error message */}
            <div className="relative group">
              <pre className="text-xs bg-red-950/10 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 overflow-x-auto text-red-900 dark:text-red-100 font-mono max-h-48 overflow-y-auto">
                {error}
              </pre>
              <button
                onClick={copyError}
                className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm hover:bg-background rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy error"
              >
                <Copy className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>

            {/* Suggestions */}
            {suggestions && suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-800 dark:text-red-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Suggestions
                </div>
                <ul className="space-y-1.5 text-xs text-red-700 dark:text-red-300">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Retry button */}
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Operation
              </button>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
