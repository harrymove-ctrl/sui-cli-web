import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Folder,
  Home,
  ChevronRight,
  ChevronLeft,
  Package,
  X,
  Loader2,
  FileText,
  HardDrive,
  Star,
  Clock,
  Search,
  TreePine
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  browseDirectory,
  getSuggestedDirectories,
  scanMovePackages,
  type DirectoryEntry,
  type SuggestedDirectory,
  type ScannedPackage
} from '@/api/client';

// Cross-platform path helper - handles both / and \ separators
const getPathBasename = (filePath: string): string => {
  if (!filePath) return 'Root';
  // Split by both forward and backward slashes
  const segments = filePath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || 'Root';
};

interface FileBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

export function FileBrowser({ onSelect, onClose }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [suggestedDirs, setSuggestedDirs] = useState<SuggestedDirectory[]>([]);

  // Scan state
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);
  const [scanFilter, setScanFilter] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showScanResults, setShowScanResults] = useState(false);

  // Sort entries: Move packages first, then directories, then files
  const sortEntries = (entries: DirectoryEntry[]): DirectoryEntry[] => {
    return [...entries].sort((a, b) => {
      // Move packages first
      if (a.isPackage && !b.isPackage) return -1;
      if (!a.isPackage && b.isPackage) return 1;
      // Then directories
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  // Filter scanned packages based on scan filter
  const filteredScannedPackages = useMemo(() => {
    if (!scanFilter.trim()) return scannedPackages;
    const query = scanFilter.toLowerCase();
    return scannedPackages.filter(pkg =>
      pkg.name.toLowerCase().includes(query) ||
      pkg.relativePath.toLowerCase().includes(query)
    );
  }, [scannedPackages, scanFilter]);

  // Scan current directory for Move packages
  const handleScanPackages = async () => {
    setIsScanning(true);
    setShowScanResults(true);
    try {
      const result = await scanMovePackages(currentPath, 5);
      setScannedPackages(result.packages);
      if (result.packages.length === 0) {
        toast('No Move packages found in this directory', { icon: '📭' });
      } else {
        toast.success(`Found ${result.packages.length} Move package(s)`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to scan packages');
      setScannedPackages([]);
    } finally {
      setIsScanning(false);
    }
  };

  // Load directory
  const loadDirectory = async (path?: string) => {
    setLoading(true);
    try {
      const data = await browseDirectory(path);
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      // Sort entries: Move packages first
      setEntries(sortEntries(data.entries));

      // Add to recent paths
      const newRecent = [data.currentPath, ...recentPaths.filter((p) => p !== data.currentPath)].slice(0, 10);
      setRecentPaths(newRecent);
      localStorage.setItem('fileBrowserRecent', JSON.stringify(newRecent));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite
  const toggleFavorite = (path: string) => {
    const newFavorites = favorites.includes(path)
      ? favorites.filter((f) => f !== path)
      : [...favorites, path];
    setFavorites(newFavorites);
    localStorage.setItem('fileBrowserFavorites', JSON.stringify(newFavorites));
  };

  // CONSOLIDATED: Load initial data on mount (suggested dirs, favorites, recent, and home directory)
  useEffect(() => {
    const initializeFileBrowser = async () => {
      // Load favorites and recent from localStorage
      const savedFavorites = localStorage.getItem('fileBrowserFavorites');
      const savedRecent = localStorage.getItem('fileBrowserRecent');
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
      if (savedRecent) setRecentPaths(JSON.parse(savedRecent));

      // Load suggested directories from API
      try {
        const data = await getSuggestedDirectories();
        setSuggestedDirs(data.directories);
      } catch (error: any) {
        console.error('Failed to load suggested directories:', error.message);
      }

      // Load home directory
      loadDirectory();
    };

    initializeFileBrowser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle select
  const handleSelect = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    } else if (entries.some(e => e.path === currentPath && e.isPackage)) {
      // If current directory is a package, select it
      onSelect(currentPath);
      onClose();
    } else {
      toast.error('Please select a Move package directory');
    }
  };

  // Go to parent
  const handleGoUp = () => {
    if (parentPath) {
      setSelectedPath(null);
      loadDirectory(parentPath);
    }
  };

  // Create modal content
  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      style={{ isolation: 'isolate' }}
    >
      {/* Backdrop - animated separately for smooth blur */}
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-black/60"
      />

      {/* Modal Container - Using viewport-based sizing */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{
          maxWidth: 'min(90vw, 1400px)',
          maxHeight: 'min(90vh, 900px)',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header - Fixed height */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-background via-primary/5 to-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">Browse for Move Package</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select a directory containing Move.toml</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(currentPath)}
              className={`p-2 rounded-lg transition-all ${
                favorites.includes(currentPath)
                  ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title={favorites.includes(currentPath) ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${favorites.includes(currentPath) ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - Flexible height with internal scrolling */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar - Collapsible on mobile */}
          <div className="hidden md:flex md:w-64 lg:w-72 border-r border-border flex-shrink-0 overflow-y-auto bg-muted/30">
            <div className="w-full">
              {/* Favorites */}
              {favorites.length > 0 && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="p-4 border-b border-border"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 px-1">
                    <Star className="w-3.5 h-3.5" />
                    FAVORITES
                  </div>
                  <div className="space-y-1">
                    {favorites.map((favPath) => (
                      <motion.button
                        key={favPath}
                        variants={itemVariants}
                        onClick={() => loadDirectory(favPath)}
                        whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-3 py-2 rounded-lg transition-colors text-left flex items-center gap-2.5 text-sm group"
                      >
                        <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <span className="truncate group-hover:text-foreground">{getPathBasename(favPath)}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Recent */}
              {recentPaths.length > 0 && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="p-4 border-b border-border"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 px-1">
                    <Clock className="w-3.5 h-3.5" />
                    RECENT
                  </div>
                  <div className="space-y-1">
                    {recentPaths.slice(0, 5).map((recentPath) => (
                      <motion.button
                        key={recentPath}
                        variants={itemVariants}
                        onClick={() => loadDirectory(recentPath)}
                        whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-3 py-2 rounded-lg transition-colors text-left flex items-center gap-2.5 text-sm group"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate group-hover:text-foreground">{getPathBasename(recentPath)}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Quick Access */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="p-4"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 px-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  QUICK ACCESS
                </div>
                <div className="space-y-1">
                  {suggestedDirs.map((dir) => (
                    <motion.button
                      key={dir.path}
                      variants={itemVariants}
                      onClick={() => loadDirectory(dir.path)}
                      whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-3 py-2 rounded-lg transition-colors text-left flex items-center gap-2.5 text-sm group"
                    >
                      <Folder className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate group-hover:text-foreground">{dir.name}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Main File List */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Breadcrumb + Navigation - Fixed height */}
            <div className="px-4 sm:px-5 py-3 border-b border-border flex-shrink-0 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGoUp}
                  disabled={!parentPath || loading}
                  className="p-2 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Go up one level"
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => loadDirectory()}
                  className="p-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                  title="Go to home"
                >
                  <Home className="w-4 h-4" />
                </motion.button>
                <div className="flex-1 flex items-center gap-2 text-sm bg-background border border-border rounded-lg px-3 py-2 min-w-0">
                  <Home className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <code className="font-mono text-xs text-muted-foreground truncate">
                    {currentPath || 'Loading...'}
                  </code>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>

              {/* Scan Button - prominent action */}
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleScanPackages}
                  disabled={isScanning}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border border-border"
                  title="Scan for all Move packages in subdirectories (recursive)"
                >
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TreePine className="w-4 h-4" />
                  )}
                  <span>Find All Move Packages</span>
                </motion.button>
              </div>
            </div>

            {/* Directory Listing - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 relative">
              {/* Loading Overlay */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg"
                  >
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scanned Packages Results */}
              <AnimatePresence>
                {showScanResults && scannedPackages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-muted/50 border border-border rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                          <TreePine className="w-4 h-4" />
                          Found {scannedPackages.length} Move Package(s)
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setShowScanResults(false);
                            setScanFilter('');
                          }}
                          className="text-muted-foreground hover:text-foreground p-1 hover:bg-white/10 rounded"
                          title="Close scan results"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </div>

                      {/* Search within scan results */}
                      {scannedPackages.length > 5 && (
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={scanFilter}
                            onChange={(e) => setScanFilter(e.target.value)}
                            placeholder="Filter packages by name or path..."
                            className="w-full pl-9 pr-3 py-2 bg-background/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          {scanFilter && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {filteredScannedPackages.length}/{scannedPackages.length}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {filteredScannedPackages.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            No packages match "{scanFilter}"
                          </div>
                        ) : (
                          filteredScannedPackages.map((pkg) => (
                            <motion.button
                              key={pkg.path}
                              whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedPath(pkg.path);
                                setShowScanResults(false);
                                setScanFilter('');
                              }}
                              className={`w-full px-3 py-2 rounded-lg text-left transition-all flex items-center gap-2 text-sm ${
                                selectedPath === pkg.path
                                  ? 'bg-primary/20 text-primary border border-primary/30'
                                  : ''
                              }`}
                            >
                              <Package className="w-4 h-4 text-primary flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{pkg.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{pkg.relativePath}</div>
                              </div>
                            </motion.button>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {entries.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Folder className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium">Empty directory</p>
                  <p className="text-xs mt-1">No files or folders to display</p>
                </div>
              )}

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {entries.map((entry) => {
                    const isSelected = selectedPath === entry.path;
                    const isPackage = entry.isPackage;

                    return (
                      <motion.button
                        key={entry.path}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (entry.isDirectory) {
                            if (isPackage) {
                              // Move package: select it
                              setSelectedPath(entry.path);
                            } else {
                              // Regular folder: navigate into it
                              setSelectedPath(null);
                              loadDirectory(entry.path);
                            }
                          }
                        }}
                        className={`w-full px-4 py-3 rounded-xl text-left transition-all flex items-center gap-3 group ${
                          isSelected
                            ? 'bg-primary/15 border-2 border-primary shadow-sm'
                            : 'hover:bg-muted/60 border-2 border-transparent hover:shadow-sm'
                        }`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {isPackage ? (
                            <Package className="w-6 h-6 text-primary" />
                          ) : entry.isDirectory ? (
                            <Folder className="w-6 h-6 text-primary" />
                          ) : (
                            <FileText className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {entry.name}
                            </span>
                            {isPackage && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium whitespace-nowrap">
                                Move Package
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow for directories */}
                        {entry.isDirectory && !isPackage && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed height */}
        <div className="px-5 py-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0 bg-gradient-to-r from-background via-primary/5 to-background">
          <div className="text-sm text-muted-foreground flex-1 min-w-0">
            {selectedPath ? (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">
                  Selected: <code className="font-mono font-medium text-foreground">{getPathBasename(selectedPath)}</code>
                </span>
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <span className="hidden sm:inline">Click a Move package to select it</span>
                <span className="sm:hidden">Select a Move package</span>
              </span>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSelect}
              disabled={!selectedPath}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-sm font-medium shadow-lg shadow-primary/20 disabled:shadow-none"
            >
              Select Package
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  // Render modal using portal to escape parent context
  return createPortal(modalContent, document.body);
}
