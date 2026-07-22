import { motion } from 'framer-motion';
import { CheckCircle2, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface SuccessField {
  label: string;
  value: string;
  copyable?: boolean;
  link?: string;
}

interface SuccessDisplayProps {
  title: string;
  fields: SuccessField[];
  collapsible?: boolean;
}

export function SuccessDisplay({ title, fields, collapsible = true }: SuccessDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="border-2 border-green-500/50 bg-gradient-to-br from-green-50/50 via-green-50/30 to-background dark:from-green-950/20 dark:via-green-950/10 dark:to-background rounded-xl overflow-hidden shadow-lg shadow-green-500/10"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-b border-green-200 dark:border-green-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring", 
              stiffness: 200,
              delay: 0.1 
            }}
            className="relative"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 0.5
              }}
              className="absolute inset-0 bg-green-500/30 rounded-lg"
            />
            <div className="relative p-1.5 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </motion.div>
          <div>
            <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">{title}</h4>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Operation completed successfully</p>
          </div>
        </div>
        {collapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-green-600 dark:text-green-400" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="overflow-hidden"
        >
          <div className="p-4 space-y-3">
            {fields.map((field, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-xs font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                  {field.label}
                  {field.copyable && (
                    <button
                      onClick={() => copyValue(field.value, field.label)}
                      className="p-1 hover:bg-green-500/10 rounded transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </button>
                  )}
                  {field.link && (
                    <a
                      href={field.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-green-500/10 rounded transition-colors"
                      title="Open in explorer"
                    >
                      <ExternalLink className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </a>
                  )}
                </label>
                <code className="block px-3 py-2 bg-green-950/10 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg text-xs font-mono text-green-900 dark:text-green-100 break-all">
                  {field.value}
                </code>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
