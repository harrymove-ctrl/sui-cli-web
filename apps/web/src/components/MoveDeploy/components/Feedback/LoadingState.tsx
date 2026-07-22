/**
 * Loading state component with animated skeleton and messages
 */

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  variant?: 'spinner' | 'skeleton' | 'dots';
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  submessage,
  variant = 'spinner',
  className = '',
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">{message}</p>
        {submessage && <p className="text-xs text-muted-foreground mt-1">{submessage}</p>}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <div className="flex gap-2 mb-3">
          <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        {submessage && <p className="text-xs text-muted-foreground mt-1">{submessage}</p>}
      </div>
    );
  }

  // Skeleton variant
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-accent rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-accent rounded animate-pulse w-1/3" />
          <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-secondary rounded animate-pulse" />
        <div className="h-3 bg-secondary rounded animate-pulse w-5/6" />
        <div className="h-3 bg-secondary rounded animate-pulse w-4/6" />
      </div>
    </div>
  );
}

// Specific loading states for operations
export function BuildingState() {
  return (
    <LoadingState
      message="Building package..."
      submessage="Compiling Move modules"
      variant="dots"
    />
  );
}

export function TestingState() {
  return (
    <LoadingState
      message="Running tests..."
      submessage="Executing test suite"
      variant="dots"
    />
  );
}

export function PublishingState() {
  return (
    <LoadingState
      message="Publishing to blockchain..."
      submessage="Waiting for transaction confirmation"
      variant="dots"
    />
  );
}

export function UpgradingState() {
  return (
    <LoadingState
      message="Upgrading package..."
      submessage="Processing upgrade transaction"
      variant="dots"
    />
  );
}
