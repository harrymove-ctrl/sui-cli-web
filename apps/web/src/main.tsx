import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { initializeAnalytics } from './lib/analytics';
// import { initClarity } from './lib/clarity'; // Temporarily disabled
// import { initStatsig } from './lib/statsig'; // Temporarily disabled - __DEFINES__ error
import './styles/globals.css';

// Handle chunk loading errors (happens after new deployments when user has cached old chunks)
// Auto-reload page once to get fresh chunks
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Loading chunk') ||
    event.message?.includes('ChunkLoadError')
  ) {
    // Only reload once to prevent infinite loops
    const hasReloaded = sessionStorage.getItem('chunk-reload');
    if (!hasReloaded) {
      sessionStorage.setItem('chunk-reload', 'true');
      window.location.reload();
    }
  }
});

// Clear reload flag on successful load
window.addEventListener('load', () => {
  sessionStorage.removeItem('chunk-reload');
});

// Initialize Analytics
initializeAnalytics();
// initClarity(); // Temporarily disabled
// initStatsig(); // Session replay + auto-capture - Temporarily disabled

const container = document.getElementById('root');

if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Explicit, rather than relying on createRoot clearing the container: this is
  // the signal index.html watches for. While the loader is still in the DOM the
  // page is considered "not started", and index.html turns it into a visible
  // error once the deadline passes.
  document.getElementById('initial-loader')?.remove();
}
