/**
 * WatchService - File system watching for auto-rebuild and hot reload
 */

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: number;
}

export interface WatchOptions {
  glob?: string | string[];
  ignored?: string | RegExp | ((path: string) => boolean);
  debounceMs?: number;
}

type Unsubscribe = () => void;

export class WatchService {
  private static instance: WatchService;
  private watchers: Map<string, FSWatcher> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    // Cleanup on process exit
    process.on('exit', () => this.unwatchAll());
    process.on('SIGINT', () => this.unwatchAll());
    process.on('SIGTERM', () => this.unwatchAll());
  }

  public static getInstance(): WatchService {
    if (!WatchService.instance) {
      WatchService.instance = new WatchService();
    }
    return WatchService.instance;
  }

  /**
   * Start watching a directory
   */
  watch(id: string, watchPath: string, options: WatchOptions = {}): void {
    // Stop existing watcher if any
    this.unwatch(id);

    const {
      glob,
      ignored = /(^|[\/\\])\../, // Ignore dotfiles by default
      debounceMs = 100,
    } = options;

    const watchTarget = glob
      ? Array.isArray(glob)
        ? glob.map(g => path.join(watchPath, g))
        : path.join(watchPath, glob)
      : watchPath;

    const watcher = chokidar.watch(watchTarget, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const emitEvent = (type: WatchEvent['type'], filePath: string) => {
      const eventKey = `${id}:${filePath}`;

      // Debounce events for the same file
      const existingTimer = this.debounceTimers.get(eventKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(eventKey);
        const event: WatchEvent = {
          type,
          path: filePath,
          timestamp: Date.now(),
        };
        this.eventEmitter.emit(`watch:${id}`, event);
      }, debounceMs);

      this.debounceTimers.set(eventKey, timer);
    };

    watcher.on('add', (filePath) => emitEvent('add', filePath));
    watcher.on('change', (filePath) => emitEvent('change', filePath));
    watcher.on('unlink', (filePath) => emitEvent('unlink', filePath));
    watcher.on('addDir', (filePath) => emitEvent('addDir', filePath));
    watcher.on('unlinkDir', (filePath) => emitEvent('unlinkDir', filePath));

    watcher.on('error', (error) => {
      console.error(`[WatchService] Error in watcher ${id}:`, error);
      this.eventEmitter.emit(`watch:${id}:error`, error);
    });

    this.watchers.set(id, watcher);
  }

  /**
   * Watch a Move package for changes
   */
  watchMovePackage(id: string, packagePath: string): void {
    this.watch(id, packagePath, {
      glob: ['sources/**/*.move', 'Move.toml'],
      ignored: [
        /(^|[\/\\])\../, // Dotfiles
        /build\//, // Build directory
        /node_modules\//, // Node modules
      ],
    });
  }

  /**
   * Stop watching
   */
  unwatch(id: string): void {
    const watcher = this.watchers.get(id);
    if (watcher) {
      watcher.close();
      this.watchers.delete(id);
    }

    // Clear any pending debounce timers for this watcher
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(`${id}:`)) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
  }

  /**
   * Stop all watchers
   */
  unwatchAll(): void {
    for (const id of this.watchers.keys()) {
      this.unwatch(id);
    }
  }

  /**
   * Subscribe to watch events
   */
  subscribe(id: string, callback: (event: WatchEvent) => void): Unsubscribe {
    this.eventEmitter.on(`watch:${id}`, callback);
    return () => this.eventEmitter.off(`watch:${id}`, callback);
  }

  /**
   * Subscribe to watch errors
   */
  subscribeErrors(id: string, callback: (error: Error) => void): Unsubscribe {
    this.eventEmitter.on(`watch:${id}:error`, callback);
    return () => this.eventEmitter.off(`watch:${id}:error`, callback);
  }

  /**
   * Check if a watcher is active
   */
  isWatching(id: string): boolean {
    return this.watchers.has(id);
  }

  /**
   * Get all active watcher IDs
   */
  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Get watched paths for a watcher
   */
  getWatchedPaths(id: string): string[] {
    const watcher = this.watchers.get(id);
    if (!watcher) return [];

    const watched = watcher.getWatched();
    const paths: string[] = [];

    for (const [dir, files] of Object.entries(watched)) {
      for (const file of files) {
        paths.push(path.join(dir, file));
      }
    }

    return paths;
  }
}
