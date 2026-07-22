/**
 * Reusable card component for operation sections (build, test, publish, upgrade)
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { OperationStatus } from '../../types';

interface OperationCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  status: OperationStatus;
  children: ReactNode;
  actions?: ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  badge?: ReactNode;
  className?: string;
}

const STATUS_STYLES = {
  idle: 'border-border',
  loading: 'border-blue-500/30 bg-blue-500/5',
  success: 'border-green-500/30 bg-green-500/5',
  error: 'border-red-500/30 bg-red-500/5',
};

const STATUS_INDICATOR = {
  idle: null,
  loading: (
    <div className="flex items-center gap-2 text-blue-400 text-sm">
      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
      Processing...
    </div>
  ),
  success: (
    <div className="flex items-center gap-2 text-green-400 text-sm">
      <div className="h-2 w-2 rounded-full bg-green-400" />
      Success
    </div>
  ),
  error: (
    <div className="flex items-center gap-2 text-red-400 text-sm">
      <div className="h-2 w-2 rounded-full bg-red-400" />
      Error
    </div>
  ),
};

export function OperationCard({
  title,
  description,
  icon,
  status,
  children,
  actions,
  defaultExpanded = false,
  collapsible = true,
  badge,
  className = '',
}: OperationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`rounded-lg border ${STATUS_STYLES[status]} bg-card transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 ${
          collapsible ? 'cursor-pointer' : ''
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="flex-shrink-0 text-muted-foreground">{icon}</div>

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {badge}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {/* Status Indicator */}
          {STATUS_INDICATOR[status]}

          {/* Collapse Icon */}
          {collapsible && (
            <div className="flex-shrink-0 text-muted-foreground">
              {expanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {(!collapsible || expanded) && (
        <>
          <div className="border-t border-border" />
          <div className="p-4 space-y-4">{children}</div>

          {/* Actions */}
          {actions && (
            <>
              <div className="border-t border-border" />
              <div className="p-4">{actions}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
