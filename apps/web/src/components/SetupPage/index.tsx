import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StructuredData } from '../SEO/StructuredData';
import { SetupChat } from './SetupChat';
import { checkConnection, getServerPort, getLastConnectionError } from '@/api/client';

/** How long the "there it is, connected" message gets to be read before the
 *  app takes over. */
const AUTO_LAUNCH_MS = 4000;

export function SetupPage() {
  const navigate = useNavigate();
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [connectedPort, setConnectedPort] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // A ref, not state: two polls can be in flight at once, and a state guard
  // read from a stale closure let both of them fire the announcement — which
  // is what stacked the success toast twice.
  const announcedRef = useRef(false);

  const checkServerConnection = async () => {
    try {
      const isConnected = await checkConnection();
      setServerConnected(isConnected);

      if (isConnected) {
        setConnectedPort(getServerPort());
        setConnectionError(null);
        announcedRef.current = true;
      } else {
        setConnectionError(getLastConnectionError());
      }
    } catch (error) {
      setServerConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkServerConnection();
    setIsRetrying(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the poll is started once on mount and torn down on unmount.
  useEffect(() => {
    checkServerConnection();
    const interval = setInterval(checkServerConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!serverConnected) return;
    const timer = setTimeout(() => navigate('/app'), AUTO_LAUNCH_MS);
    return () => clearTimeout(timer);
  }, [serverConnected, navigate]);

  return (
    <>
      <StructuredData type="setup" />
      {/* Black scrim over the animated background: the transcript needs a calm
          surface to read against, and the chat supplies all of the contrast. */}
      <div className="relative h-screen w-full overflow-hidden bg-black/70">
        <SetupChat
          connectedPort={connectedPort}
          connectionError={connectionError}
          isRetrying={isRetrying}
          onLaunch={() => navigate('/app')}
          onRetry={handleRetry}
          serverConnected={serverConnected}
        />
      </div>
    </>
  );
}
