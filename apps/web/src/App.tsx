import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { trackPageView } from './lib/analytics';

// Lazy load ALL route components for better initial load and code splitting
const AppGuard = lazy(() =>
  import('./components/guards/AppGuard').then((m) => ({ default: m.AppGuard }))
);
const HomePage = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const SetupPage = lazy(() =>
  import('./components/SetupPage').then((m) => ({ default: m.SetupPage }))
);
const Dashboard = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const AddressList = lazy(() =>
  import('./components/AddressList').then((m) => ({ default: m.AddressList }))
);
const EnvironmentList = lazy(() =>
  import('./components/EnvironmentList').then((m) => ({ default: m.EnvironmentList }))
);
const ObjectList = lazy(() =>
  import('./components/ObjectList').then((m) => ({ default: m.ObjectList }))
);
// GasList removed - redirecting to CoinList instead
const FaucetForm = lazy(() =>
  import('./components/FaucetForm').then((m) => ({ default: m.FaucetForm }))
);
const TransferSui = lazy(() =>
  import('./components/TransferSui').then((m) => ({ default: m.TransferSui }))
);
const MoveDeploy = lazy(() =>
  import('./components/MoveDeploy').then((m) => ({ default: m.MoveDeploy }))
);
const TransactionBuilder = lazy(() =>
  import('./components/TransactionBuilder').then((m) => ({ default: m.TransactionBuilder }))
);
const DynamicFieldExplorer = lazy(() =>
  import('./components/DynamicFieldExplorer').then((m) => ({ default: m.DynamicFieldExplorer }))
);
// Package Explorer is its own Assets page again - packages are a different kind
// of thing from owned objects, and burying them in an Objects tab made the two
// hard to tell apart.
const PackageExplorer = lazy(() =>
  import('./components/PackageExplorer').then((m) => ({ default: m.PackageExplorer }))
);
// Anyone still on the old `/app/objects?tab=packages` URL is redirected from
// inside ObjectList, which is where that query param is read.
const DevTools = lazy(() => import('./components/DevTools').then((m) => ({ default: m.DevTools })));
const DerivedObjectCalculator = lazy(() =>
  import('./components/DerivedObjectCalculator').then((m) => ({
    default: m.DerivedObjectCalculator,
  }))
);
const DevstackBridge = lazy(() =>
  import('./components/DevstackBridge').then((m) => ({ default: m.DevstackBridge }))
);
const SecurityTools = lazy(() =>
  import('./components/SecurityTools').then((m) => ({ default: m.SecurityTools }))
);
const KeytoolManager = lazy(() =>
  import('./components/KeytoolManager').then((m) => ({ default: m.KeytoolManager }))
);
const CoinList = lazy(() => import('./components/CoinList').then((m) => ({ default: m.CoinList })));
const CoinSplit = lazy(() =>
  import('./components/CoinSplit').then((m) => ({ default: m.CoinSplit }))
);
const CoinMerge = lazy(() =>
  import('./components/CoinMerge').then((m) => ({ default: m.CoinMerge }))
);
const CoinTransfer = lazy(() =>
  import('./components/CoinTransfer').then((m) => ({ default: m.CoinTransfer }))
);

// New feature components
const GasAnalysis = lazy(() =>
  import('./components/GasAnalysis').then((m) => ({ default: m.GasAnalysis }))
);
const EventExplorer = lazy(() =>
  import('./components/EventExplorer').then((m) => ({ default: m.EventExplorer }))
);
const LocalNetwork = lazy(() =>
  import('./components/LocalNetwork').then((m) => ({ default: m.LocalNetwork }))
);
const MoveMigrate = lazy(() =>
  import('./components/MoveMigrate').then((m) => ({ default: m.MoveMigrate }))
);
const MultiPay = lazy(() => import('./components/MultiPay').then((m) => ({ default: m.MultiPay })));
const NotFound = lazy(() => import('./components/NotFound').then((m) => ({ default: m.NotFound })));

// Lazy load heavy background component
const FaultyTerminal = lazy(() => import('./components/backgrounds/FaultyTerminal'));

// Simple loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="w-6 h-6 border-2 border-sui-blue border-t-transparent rounded-full animate-spin" />
  </div>
);

export function App() {
  const location = useLocation();
  const { theme } = useTheme();

  // Determine if we're in app routes
  const isAppRoute = location.pathname.startsWith('/app');
  const isMoveDevStudio = location.pathname === '/app/move';
  const isSetupRoute = location.pathname === '/setup';
  // Landing + setup are the monochrome surfaces; the app keeps its blue.
  const isMonochromeRoute = isSetupRoute || location.pathname === '/';
  const isKnownRoute =
    ['/', '/setup'].includes(location.pathname) || location.pathname.startsWith('/app');
  const is404Page = !isKnownRoute;

  // Show animated background on all pages
  const showAnimatedBackground = true;

  // Track page views on route change
  useEffect(() => {
    const pageName =
      location.pathname === '/'
        ? 'Home Page'
        : location.pathname === '/setup'
          ? 'Setup Page'
          : location.pathname === '/app'
            ? 'Dashboard'
            : location.pathname.includes('/app/')
              ? location.pathname.replace('/app/', '')
              : 'Unknown';
    trackPageView(pageName);
  }, [location.pathname]);

  return (
    <>
      {/* Dynamic background - only on landing page for performance */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        // The shader only knows how to paint a dark field. Inverting the whole
        // layer in light mode turns it into dark glyphs on white — the same
        // texture, read the other way round.
        style={isMonochromeRoute && theme === 'light' ? { filter: 'invert(1)' } : undefined}
      >
        {showAnimatedBackground ? (
          <Suspense
            fallback={
              <div className="w-full h-full bg-gradient-to-br from-[#0a1929] via-[#0d2137] to-[#0a1929]" />
            }
          >
            <FaultyTerminal
              tint={isMoveDevStudio ? '#22c55e' : isAppRoute ? '#4da2ff' : '#ffffff'}
              brightness={is404Page ? 0.35 : isMoveDevStudio ? 0.2 : isAppRoute ? 0.3 : 0.18}
              scale={is404Page ? 1.5 : isMoveDevStudio ? 0.5 : isAppRoute ? 1.0 : 1.9}
              gridMul={isMoveDevStudio ? [4, 2] : [2, 1]}
              digitSize={isMoveDevStudio ? 1.2 : 1.3}
              glitchAmount={is404Page ? 0.5 : isMoveDevStudio ? 0.8 : 0}
              flickerAmount={is404Page ? 0.3 : isMoveDevStudio ? 0.5 : 0}
              scanlineIntensity={is404Page ? 0.4 : isMoveDevStudio ? 0.3 : 0.5}
              curvature={is404Page ? 0.3 : isMoveDevStudio ? 0.1 : isAppRoute ? 1.5 : 0.4}
              mouseReact={isMoveDevStudio}
              mouseStrength={isMoveDevStudio ? 0.2 : 0}
              timeScale={is404Page ? 0.3 : 0.5}
              noiseAmp={is404Page ? 0.4 : isMoveDevStudio ? 0 : isAppRoute ? 0.3 : 0.5}
              className="curved-panel"
              dpr={1} // Lower DPR for better performance
              style={{
                transformStyle: 'preserve-3d',
                perspective: '2000px',
              }}
            />
          </Suspense>
        ) : (
          // Simple gradient for non-landing pages or low-power devices
          <div className="w-full h-full bg-gradient-to-br from-[#0a1929] via-[#0d2137] to-[#0a1929]" />
        )}

        {/* Subtle blur overlay for app routes - makes terminal stand out more */}
        {isAppRoute && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Marketing/Landing Page - No server check */}
            <Route path="/" element={<HomePage />} />

            {/* Setup Guide Page - Has server check, shows instructions */}
            <Route path="/setup" element={<SetupPage />} />

            {/* App Routes - Protected by AppGuard */}
            <Route path="/app" element={<AppGuard />}>
              <Route index element={<Dashboard />} />
              <Route path="addresses" element={<AddressList />} />
              <Route path="environments" element={<EnvironmentList />} />
              <Route path="objects" element={<ObjectList />} />
              <Route path="objects/:objectId" element={<ObjectList />} />
              <Route path="dynamic-fields" element={<DynamicFieldExplorer />} />
              <Route path="packages" element={<PackageExplorer />} />
              <Route path="gas" element={<Navigate to="/app/coins" replace />} />
              <Route path="coins" element={<CoinList />} />
              <Route path="coins/split" element={<CoinSplit />} />
              <Route path="coins/merge" element={<CoinMerge />} />
              <Route path="coins/transfer" element={<CoinTransfer />} />
              <Route path="faucet" element={<FaucetForm />} />
              <Route path="transfer" element={<TransferSui />} />
              <Route path="move" element={<MoveDeploy />} />
              <Route path="devtools" element={<DevTools />} />
              <Route path="derived-objects" element={<DerivedObjectCalculator />} />
              <Route path="devstack" element={<DevstackBridge />} />
              <Route path="security" element={<SecurityTools />} />
              <Route path="keytool" element={<KeytoolManager />} />
              <Route path="inspector" element={<TransactionBuilder />} />
              {/* New Feature Routes */}
              <Route path="gas-analysis" element={<GasAnalysis />} />
              <Route path="events" element={<EventExplorer />} />
              <Route path="network" element={<LocalNetwork />} />
              <Route path="migrate" element={<MoveMigrate />} />
              <Route path="payments" element={<MultiPay />} />
            </Route>

            {/* 404 - Catch all unmatched routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#2a2a2a',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#34c759',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff453a',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}
