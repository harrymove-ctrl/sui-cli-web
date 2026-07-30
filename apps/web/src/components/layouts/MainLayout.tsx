import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SelectionToolbar } from '@/components/ui/r-selection-toolbar';
import { cn } from '@/lib/utils';
import {
  getDefaultSelectionToolbarItems,
  SelectionToolbarPresets,
} from '@/components/ui/selectiontoolbar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppStore } from '@/stores/useAppStore';
import { QuickSwitcher } from '../QuickSwitcher';
import { Sidebar } from '../Sidebar';
import { Spinner } from '../shared/Spinner';
import { ShimmerSkeleton } from '@/components/unlumen-ui/shimmer-skeleton';
import { Loader } from '@/components/ui/loader';
import {
  SmoothScroll,
  useSmoothScroll,
} from '@/components/unlumen-ui/scroll-animation';
import { PixelCard } from '@/components/ui/pixel-card';

const ROUTE_TITLES: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/addresses': 'Manage Addresses',
  '/app/environments': 'Switch Environment',
  '/app/objects': 'My Objects',
  '/app/packages': 'My Packages',
  '/app/gas': 'Gas Coins',
  '/app/faucet': 'Request Faucet',
};

function ScrollProgress() {
  const { progress } = useSmoothScroll();
  return (
    <motion.div
      className="sticky top-0 left-0 right-0 h-1 bg-primary z-50 origin-left"
      style={{ scaleX: progress }}
    />
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground"
      aria-label={
        theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      }
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
    </button>
  );
}

export function MainLayout() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isLoading,
    error,
    setError,
    suiInstalled,
    isServerConnected,
    fetchStatus,
    fetchAddresses,
    fetchEnvironments,
    checkServerConnection,
  } = useAppStore();

  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('sui-sidebar-collapsed') === '1'
  );
  const toggleSidebar = () =>
    setSidebarCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sui-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  const contentRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/app';
  const title = ROUTE_TITLES[location.pathname] || 'Sui CLI';

  // Check connection and fetch initial data on mount
  useEffect(() => {
    const init = async () => {
      const connected = await checkServerConnection();
      if (connected) {
        // Fetch all data in parallel for faster loading
        await Promise.all([
          fetchStatus(),
          fetchAddresses(),
          fetchEnvironments(),
        ]);
      }
    };
    init();
  }, [checkServerConnection, fetchStatus, fetchAddresses, fetchEnvironments]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen(true);
        return;
      }
      if (e.key === 'Escape' && !isHome) {
        navigate('/app');
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHome, navigate]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  const handleBack = () => {
    if (location.pathname.startsWith('/app/objects/')) {
      navigate('/app/objects');
    } else {
      navigate('/app');
    }
  };

  return (
    <main
      className="h-screen w-screen bg-background overflow-hidden flex relative"
      role="main"
    >
      {/* Animated dot-grid pixel background behind all in-app pages */}
      <PixelCard
        className="absolute inset-0 pointer-events-none z-0"
        autoPlay
        colors={
          theme === 'dark'
            ? ['#4da2ff', '#003f87', '#199e70']
            : ['rgba(20,20,25,0.5)', 'rgba(77,162,255,0.35)', 'rgba(20,20,25,0.25)']
        }
        backgroundColor={theme === 'dark' ? '#0a0a0a' : '#ffffff'}
        gap={14}
        pixelSize={2.5}
        speed={35}
        appearFrom="middle"
        durationMs={2000}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/25 to-background/50 pointer-events-none z-0" />

      {/* Collapsible sidebar */}
      <aside
        className={cn(
          'relative z-10 flex-shrink-0 h-full border-r border-border overflow-hidden transition-[width] duration-200 ease-out bg-background/80 backdrop-blur-md',
          sidebarCollapsed ? 'w-16' : 'w-[280px]'
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSearchClick={() => setIsQuickSwitcherOpen(true)}
        />
      </aside>

      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        {/* Breadcrumb header */}
        <div className="flex items-center gap-2 px-8 py-5 border-b border-border bg-background/50 backdrop-blur-sm">
            {!isHome && (
              <button
                onClick={handleBack}
                className="p-1 -ml-1 hover:bg-accent/50 rounded-md transition-colors"
                aria-label="Go back"
              >
                <svg
                  className="w-4 h-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <span className="text-sm text-muted-foreground">{title}</span>
            <div className="flex-1" />
            {isLoading && <Spinner size="sm" />}
            <ThemeToggle />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-8 py-2 bg-error/10 border-b border-error/20">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Sui not installed warning */}
          {suiInstalled === false && (
            <div className="px-8 py-3 bg-warning/10 border-b border-warning/20">
              <p className="text-sm text-warning">
                Sui CLI is not installed. Please install it to use this app.
              </p>
            </div>
          )}

          {/* Content */}
          <SmoothScroll
            root={false}
            className="flex-1 overflow-y-auto w-full focus:outline-none focus-visible:outline-none relative"
          >
            <ScrollProgress />
            <div
              ref={contentRef}
              className="px-8 py-8 min-h-full"
              role="region"
              aria-label="Main content"
            >
              {isServerConnected === null ? (
                <div className="w-full max-w-sm space-y-4 pt-12 mx-auto">
                  <div className="space-y-3">
                    <ShimmerSkeleton className="h-40 w-full" rounded="lg" />
                    <div className="flex items-center gap-3">
                      <ShimmerSkeleton
                        className="h-10 w-10 shrink-0"
                        rounded="full"
                      />
                      <div className="flex-1 space-y-2">
                        <ShimmerSkeleton className="h-3.5 w-3/4" />
                        <ShimmerSkeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <ShimmerSkeleton className="h-3 w-full" />
                    <ShimmerSkeleton className="h-3 w-5/6" />
                    <ShimmerSkeleton className="h-3 w-4/6" />
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
                    <Loader variant="dots" size={16} label="Connecting" />
                    Connecting to local server...
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                      mass: 0.8,
                    }}
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </SmoothScroll>
      </div>

      <QuickSwitcher
        isOpen={isQuickSwitcherOpen}
        onClose={() => setIsQuickSwitcherOpen(false)}
      />

      {/* Floating toolbar over selected text, full demo preset (Bold/Italic/Underline/
          Strikethrough/Link/Copy). None of the app's content is contentEditable, so the
          formatting commands are visual-only no-ops (browsers require an editable
          context for execCommand to actually mutate anything) - Copy is the one button
          that does real work here (addresses, digests, object IDs). Kept per explicit
          choice to match the demo's full preset rather than trim to functional-only. */}
      <SelectionToolbar
        containerRef={contentRef}
        items={[
          ...getDefaultSelectionToolbarItems(),
          SelectionToolbarPresets.strikeThrough,
          SelectionToolbarPresets.link,
          SelectionToolbarPresets.copy,
        ]}
      />
    </main>
  );
}
