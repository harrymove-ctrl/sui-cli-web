/**
 * Zustand Store Slices
 *
 * These slices follow the Zustand slice pattern for modular state management.
 * They can be combined into a single store or used independently.
 *
 * @see https://docs.pmnd.rs/zustand/guides/slices-pattern
 *
 * @example
 * // Combining slices into a store
 * import { create } from 'zustand';
 * import { createUISlice, UISlice } from './slices/uiSlice';
 * import { createConnectionSlice, ConnectionSlice } from './slices/connectionSlice';
 *
 * type AppState = UISlice & ConnectionSlice;
 *
 * export const useAppStore = create<AppState>()((...args) => ({
 *   ...createUISlice(...args),
 *   ...createConnectionSlice(...args),
 * }));
 *
 * @module stores/slices
 */

export { createUISlice, type UISlice, type View, type ThemeMode } from './uiSlice';
export { createConnectionSlice, type ConnectionSlice } from './connectionSlice';
