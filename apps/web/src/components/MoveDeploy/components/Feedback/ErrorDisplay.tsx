/**
 * Unified error display component with actionable suggestions
 */

import { AlertCircle, Copy, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OperationError } from '../../types';

interface ErrorDisplayProps {
  error: OperationError;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
}

const ERROR_TYPE_CONFIG = {
  validation: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    title: 'Validation Error',
  },
  network: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    title: 'Network Error',
  },
  compilation: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    title: 'Compilation Error',
  },
  runtime: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    title: 'Runtime Error',
  },
  unknown: {
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    title: 'Error',
  },
};

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  compact = false,
  className = '',
}: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false);
  const config = ERROR_TYPE_CONFIG[error.type];
  const Icon = config.icon;

  const handleCopy = () => {
    const errorText = `${config.title}: ${error.message}${
      error.details ? `\n\nDetails:\n${error.details}` : ''
    }${error.code ? `\n\nCode: ${error.code}` : ''}`;

    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div
        className={`flex items-start gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} p-3 ${className}`}
      >
        <Icon className={`h-5 w-5 ${config.color} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{error.message}</p>
        </div>
        {onRetry && error.recoverable && (
          <button
            onClick={onRetry}
            className="flex-shrink-0 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 ${config.color} mt-0.5 flex-shrink-0`} />
          <div>
            <h3 className="font-semibold text-foreground">{config.title}</h3>
            {error.code && (
              <p className="text-xs text-muted-foreground mt-0.5">Error Code: {error.code}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Copy error details"
          >
            {copied ? (
              <span className="text-xs text-green-400">Copied!</span>
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      <p className="text-sm text-muted-foreground mb-3 ml-9">{error.message}</p>

      {/* Details */}
      {error.details && (
        <div className="ml-9 mb-3">
          <div className="bg-card rounded-lg p-3 border border-border">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
              {error.details}
            </pre>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {error.suggestions && error.suggestions.length > 0 && (
        <div className="ml-9 mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggestions:</p>
          <ul className="space-y-1.5">
            {error.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {onRetry && error.recoverable && (
        <div className="flex items-center gap-3 ml-9">
          {onRetry && error.recoverable && (
            <Button size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry Operation
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
