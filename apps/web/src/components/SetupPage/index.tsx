import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SetupInstructions } from '../SetupInstructions';
import { StructuredData } from '../SEO/StructuredData';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkConnection, getServerPort, getLastConnectionError } from '@/api/client';

export function SetupPage() {
  const navigate = useNavigate();
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [connectedPort, setConnectedPort] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const checkServerConnection = async () => {
    try {
      const isConnected = await checkConnection();
      setServerConnected(isConnected);

      if (isConnected) {
        setConnectedPort(getServerPort());
        setConnectionError(null);
        if (!showSuccessState) {
          setShowSuccessState(true);
          toast.success('✅ Server connected successfully!', {
            duration: 3000,
            position: 'top-center',
          });
        }
      } else {
        // Get detailed error for debugging
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

  const handleLaunchApp = () => {
    navigate('/app');
  };

  useEffect(() => {
    checkServerConnection();

    // Poll every 5 seconds
    const interval = setInterval(checkServerConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  // Auto-navigate after 3 seconds if connected
  useEffect(() => {
    if (serverConnected && showSuccessState) {
      const timer = setTimeout(() => {
        navigate('/app');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [serverConnected, showSuccessState, navigate]);

  return (
    <>
      <StructuredData type="setup" />
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="w-full max-w-5xl mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Get Started with <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Sui CLI Web</span>
          </h1>
          <p className="text-white/60">Follow these steps to set up your local environment</p>
        </div>

        {/* Main Content */}
        <div className="w-full flex justify-center">
          {serverConnected === null ? (
            // Loading state
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
              <p className="text-white/60">Checking server connection...</p>
            </div>
          ) : serverConnected ? (
            // Success state
            <div className="w-full max-w-2xl">
              <div className="relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 rounded-3xl blur-3xl animate-pulse" />

                <div className="relative bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-xl border border-white/30 rounded-2xl p-8 sm:p-12 shadow-2xl">
                  {/* Success icon */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500 blur-xl opacity-50 animate-pulse" />
                      <div className="relative w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce-in">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Success message */}
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-3">
                      🎉 You're All Set!
                    </h2>
                    <p className="text-lg text-white/70">
                      Server is running and ready to use
                    </p>
                  </div>

                  {/* Status info */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
                        <span className="text-white font-medium">Server Status</span>
                      </div>
                      <span className="text-green-400 font-semibold">Connected</span>
                    </div>
                    <div className="mt-2 text-sm text-white/50">
                      localhost:{connectedPort || 3001}
                    </div>
                  </div>

                  {/* Launch button */}
                  <button
                    onClick={handleLaunchApp}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <span>Launch App</span>
                    <span className="text-lg">→</span>
                  </button>

                  {/* Auto-redirect note */}
                  <p className="text-center text-sm text-white/40 mt-4">
                    Redirecting automatically in 3 seconds...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Setup instructions (disconnected state)
            <SetupInstructions onRetry={handleRetry} isRetrying={isRetrying} connectionError={connectionError} />
          )}
        </div>

        {/* Footer hint */}
        {!serverConnected && (
          <div className="mt-8 text-center">
            <p className="text-sm text-white/40">
              Need help? Check our{' '}
              <a
                href="https://github.com/hien-p/raycast-sui-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-400 hover:text-rose-300 underline"
              >
                documentation
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
