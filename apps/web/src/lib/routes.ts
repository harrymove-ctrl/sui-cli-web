// Shared nav route data - single source of truth for Sidebar and the Cmd+K quick-switcher,
// so both stay in sync with the app's actual routes instead of duplicating this map.

export const VIEW_TO_ROUTE: Record<string, string> = {
  addresses: '/app/addresses',
  environments: '/app/environments',
  objects: '/app/objects',
  'dynamic-fields': '/app/dynamic-fields',
  gas: '/app/coins', // Redirected from gas to coins (all coin types)
  faucet: '/app/faucet',
  transfer: '/app/transfer',
  move: '/app/move',
  inspector: '/app/inspector',
  devtools: '/app/devtools',
  'derived-objects': '/app/derived-objects',
  security: '/app/security',
  keytool: '/app/keytool',
};

// Categories rendered in this fixed order, each becoming its own nav/palette group.
export const CATEGORY_ORDER = ['Account', 'Assets', 'Actions', 'Development', 'Security'];
