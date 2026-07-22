import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { checkConnection } from '@/api/client';

export function AppGuard() {
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const isMobile = useMobileDetect();

  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        const isConnected = await checkConnection();
        setServerConnected(isConnected);

        // Don't show toast on mobile - they'll see the friendly message instead
        if (!isConnected && !hasChecked && !isMobile) {
          toast.error('⚠️ Server not running. Please start the server first.', {
            duration: 4000,
            position: 'top-center',
          });
        }
      } catch (error) {
        setServerConnected(false);
        // Don't show toast on mobile
        if (!hasChecked && !isMobile) {
          toast.error('⚠️ Server not running. Please start the server first.', {
            duration: 4000,
            position: 'top-center',
          });
        }
      } finally {
        setHasChecked(true);
      }
    };

    checkServerConnection();
  }, [hasChecked, isMobile]);

  // Show loading state while checking
  if (serverConnected === null) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-white/60">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Redirect to setup if not connected
  if (!serverConnected) {
    return <Navigate to="/setup" replace />;
  }

  // Render app if connected
  return <MainLayout />;
}
