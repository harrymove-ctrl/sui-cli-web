/**
 * Google Analytics setup for tracking user behavior
 * - Page views
 * - User interactions (button clicks, form submissions)
 *
 * Analytics can be controlled via:
 * 1. VITE_GA_ID environment variable
 * 2. enable_analytics_tracking feature flag in Statsig
 */

// import { checkGate, FeatureGates } from './statsig'; // Temporarily disabled - __DEFINES__ error

// Track if analytics was disabled by feature flag
const analyticsDisabledByFlag = false;

/**
 * Get the appropriate Google Analytics ID
 * Priority: env var > domain-based lookup > fallback
 */
function getGAId(): string {
  // First check environment variable
  const envGaId = import.meta.env.VITE_GA_ID;
  if (envGaId) return envGaId;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // Map domains to their GA IDs (fallback if env var not set)
  const gaIds: Record<string, string> = {
    'sui-cli-web-production.up.railway.app': 'G-Z37RHCYYX6', // Primary domain
    localhost: 'G-Z37RHCYYX6', // Use primary GA for local development
  };

  // Find matching GA ID
  for (const [domain, id] of Object.entries(gaIds)) {
    if (hostname.includes(domain)) {
      return id;
    }
  }

  // Fallback to primary GA ID
  return 'G-Z37RHCYYX6';
}

/**
 * Check if analytics should be enabled
 * Respects both env config and feature flag
 */
function shouldEnableAnalytics(): boolean {
  // Check feature flag (if Statsig is initialized)
  // Note: This is called early, so Statsig might not be ready
  // We'll recheck on each tracking call
  return true; // Default to enabled, will check flag on each call
}

/**
 * Initialize Google Analytics
 * Call this once in app initialization
 */
export function initializeAnalytics() {
  const GA_ID = getGAId();

  // Create script element
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  (window as any).dataLayer = (window as any).dataLayer || [];
  // Google's own snippet pushes the Arguments object, not an array: gtag.js
  // reads it as such, and passing a real array silently drops the call.
  // biome-ignore lint/complexity/noArguments: required by the gtag.js contract.
  // biome-ignore lint/correctness/noUnusedFunctionParameters: the rest param documents the signature; arguments is what gets forwarded.
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(arguments);
  }
  (window as any).gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID, {
    page_path: window.location.pathname,
    page_title: document.title,
  });
}

/**
 * Check if tracking is allowed (respects feature flag)
 */
function isTrackingAllowed(): boolean {
  // Statsig temporarily disabled - always allow tracking
  return true;
  // try {
  //   return checkGate(FeatureGates.ENABLE_ANALYTICS_TRACKING);
  // } catch {
  //   return true;
  // }
}

/**
 * Track page view
 */
export function trackPageView(pageName: string) {
  if ((window as any).gtag && isTrackingAllowed()) {
    (window as any).gtag('event', 'page_view', {
      page_title: pageName,
      page_path: window.location.pathname,
    });
  }
}

/**
 * Track button click
 */
export function trackButtonClick(buttonName: string, section?: string) {
  if ((window as any).gtag && isTrackingAllowed()) {
    (window as any).gtag('event', 'button_click', {
      event_category: 'engagement',
      event_label: buttonName,
      section: section || 'unknown',
    });
  }
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(featureName: string, action: string) {
  if ((window as any).gtag && isTrackingAllowed()) {
    (window as any).gtag('event', featureName, {
      event_category: 'feature',
      event_action: action,
    });
  }
}

/**
 * Track error
 */
export function trackError(errorName: string, errorMessage: string) {
  if ((window as any).gtag && isTrackingAllowed()) {
    (window as any).gtag('event', 'exception', {
      description: `${errorName}: ${errorMessage.slice(0, 100)}`,
      fatal: false,
    });
  }
}
