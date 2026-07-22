import type { NetworkError } from '@/hooks/useNetworkRetry';

interface NetworkErrorBannerProps {
  error: NetworkError | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function NetworkErrorBanner({ error, onRetry, isRetrying }: NetworkErrorBannerProps) {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case 'timeout':
        return (
          <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'server_disconnected':
        return (
          <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'network_error':
        return (
          <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTitle = () => {
    switch (error.type) {
      case 'timeout':
        return 'Request Timed Out';
      case 'server_disconnected':
        return 'Server Disconnected';
      case 'network_error':
        return 'Network Error';
      default:
        return 'Connection Error';
    }
  };

  return (
    <div className="mb-4 p-4 rounded-lg border border-border/50 bg-destructive/10">
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <h3 className="font-medium text-destructive">{getTitle()}</h3>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          {error.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Retry attempt: {error.retryCount}/3
            </p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded bg-primary hover:bg-primary/90 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            {isRetrying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retrying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
