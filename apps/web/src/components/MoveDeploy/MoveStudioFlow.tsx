import {
  ArrowLeft,
  Braces,
  Check,
  Code,
  FolderOpen,
  RefreshCw,
  Rocket,
  Terminal,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getPublishedPackages, type PublishedPackageInfo } from '@/api/services/packages';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { EASE_OUT } from '@/lib/ease';
import { cn } from '@/lib/utils';

/**
 * Focused entry flow for Move Studio.
 *
 * The old landing state rendered every control at once - path field, gas, one-
 * click bar, four stage tabs and their panels - which gave a newcomer no idea
 * what to do first. This asks two questions instead: what are you working on,
 * and what do you want to do to it. Everything else stays hidden until those
 * are answered.
 */

type Step = 'source' | 'stage';
type Source = 'local' | 'published';
export type StudioStage = 'develop' | 'deploy' | 'upgrade' | 'interact';

const STAGES: {
  id: StudioStage;
  name: string;
  detail: string;
  icon: typeof Code;
  /** Stages that need a local package directory, not just a package ID. */
  needsLocal: boolean;
}[] = [
  {
    id: 'develop',
    name: 'Develop',
    detail: 'Compile and run Move unit tests',
    icon: Code,
    needsLocal: true,
  },
  {
    id: 'deploy',
    name: 'Deploy',
    detail: 'Publish to the connected network',
    icon: Rocket,
    needsLocal: true,
  },
  {
    id: 'upgrade',
    name: 'Upgrade',
    detail: 'Publish a new version via UpgradeCap',
    icon: RefreshCw,
    needsLocal: true,
  },
  {
    id: 'interact',
    name: 'Interact',
    detail: 'Call functions on a published package',
    icon: Zap,
    needsLocal: false,
  },
];

// Slide with the direction of travel, so forward and back feel different.
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
};

export interface MoveStudioFlowProps {
  packagePath: string;
  onPackagePathChange: (path: string) => void;
  onBrowse: () => void;
  targetPackageId: string;
  onTargetPackageIdChange: (id: string) => void;
  activeAddress?: string;
  /** Called once the user has picked both a source and a stage. */
  onComplete: (stage: StudioStage) => void;
}

export function MoveStudioFlow({
  packagePath,
  onPackagePathChange,
  onBrowse,
  targetPackageId,
  onTargetPackageIdChange,
  activeAddress,
  onComplete,
}: MoveStudioFlowProps) {
  const [step, setStep] = useState<Step>('source');
  const [direction, setDirection] = useState(1);
  const [source, setSource] = useState<Source | null>(null);

  const [packages, setPackages] = useState<PublishedPackageInfo[] | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  // Only fetch once the user actually asks for the published list.
  useEffect(() => {
    if (source !== 'published' || packages !== null || loadingPackages) return;
    setLoadingPackages(true);
    setPackagesError(null);
    getPublishedPackages(activeAddress)
      .then((res) =>
        setPackages([...res.packages].sort((a, b) => Number(b.version) - Number(a.version)))
      )
      .catch((e) =>
        setPackagesError(e instanceof Error ? e.message : 'Could not load your packages')
      )
      .finally(() => setLoadingPackages(false));
  }, [source, packages, loadingPackages, activeAddress]);

  const go = (next: Step, dir: number) => {
    setDirection(dir);
    setStep(next);
  };

  const sourceReady =
    (source === 'local' && packagePath.trim().length > 0) ||
    (source === 'published' && targetPackageId.trim().length > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 overflow-hidden">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-4">
        {(['source', 'stage'] as const).map((s, i) => {
          const done = step === 'stage' && s === 'source';
          const active = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  done && 'bg-success/15 text-success',
                  active && 'bg-primary text-primary-foreground',
                  !done && !active && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {s === 'source' ? 'Package' : 'What to do'}
              </span>
              {i === 0 && <span className="mx-1 h-px w-6 bg-border" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {step === 'source' ? (
          <motion.div
            key="source"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="space-y-3"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">What are you working on?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Move Studio drives the local <span className="font-mono">sui</span> CLI.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource('local')}
                aria-pressed={source === 'local'}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                  source === 'local'
                    ? 'border-primary/50 bg-primary/[0.06]'
                    : 'border-border hover:border-foreground/25'
                )}
              >
                <FolderOpen className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-xs font-medium text-foreground">
                    A package on this machine
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">
                    A folder containing <span className="font-mono">Move.toml</span>. Build, test,
                    publish or upgrade it.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSource('published')}
                aria-pressed={source === 'published'}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                  source === 'published'
                    ? 'border-primary/50 bg-primary/[0.06]'
                    : 'border-border hover:border-foreground/25'
                )}
              >
                <Braces className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-xs font-medium text-foreground">
                    One of my published packages
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">
                    Already on-chain — call its functions.
                  </span>
                </span>
              </button>
            </div>

            {/* Second half of step 1, revealed by the choice above. */}
            <AnimatePresence mode="wait" initial={false}>
              {source === 'local' && (
                <motion.div
                  key="local"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label
                    htmlFor="flow-package-path"
                    className="block text-xs font-medium text-foreground pt-1"
                  >
                    Package path
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="flow-package-path"
                      type="text"
                      value={packagePath}
                      onChange={(e) => onPackagePathChange(e.target.value)}
                      placeholder="/path/to/your/move/package"
                      className="flex-1 px-2.5 py-2 bg-background border border-border rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                    />
                    <Button variant="outline" onClick={onBrowse} className="px-3">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    No package yet? Run{' '}
                    <span className="font-mono text-foreground">sui move new my_package</span> and
                    point here.
                  </p>
                </motion.div>
              )}

              {source === 'published' && (
                <motion.div
                  key="published"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  {loadingPackages ? (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader variant="dither" size={16} label="Loading packages" />
                      <span className="text-xs text-muted-foreground">Loading your packages…</span>
                    </div>
                  ) : packagesError ? (
                    <p className="py-3 text-xs text-error">{packagesError}</p>
                  ) : packages && packages.length > 0 ? (
                    <div className="mt-1 max-h-44 space-y-1 overflow-y-auto pr-1">
                      {packages.map((p) => {
                        const picked = targetPackageId === p.packageId;
                        return (
                          <button
                            key={p.upgradeCapId}
                            type="button"
                            onClick={() => onTargetPackageIdChange(p.packageId)}
                            aria-pressed={picked}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                              picked
                                ? 'border-primary/50 bg-primary/[0.06]'
                                : 'border-border hover:border-foreground/25'
                            )}
                          >
                            <Terminal className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="flex-1 truncate font-mono text-[11px] text-foreground">
                              {p.packageId}
                            </span>
                            <span className="text-[10px] text-muted-foreground">v{p.version}</span>
                            {picked && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-3 text-xs text-muted-foreground">
                      No packages published from this address yet — publish one from a local package
                      first.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end pt-1">
              <Button disabled={!sourceReady} onClick={() => go('stage', 1)}>
                Continue
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="stage"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="space-y-3"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">What do you want to do?</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                {source === 'local' ? packagePath : targetPackageId}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STAGES.map((stage) => {
                // A published package ID alone can't be built or republished -
                // those need the sources on disk.
                const blocked = stage.needsLocal && source === 'published';
                return (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={blocked}
                    title={blocked ? 'Needs a local package folder' : undefined}
                    onClick={() => onComplete(stage.id)}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border border-border p-3 text-left transition-colors',
                      blocked
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-primary/50 hover:bg-primary/[0.04]'
                    )}
                  >
                    <stage.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-xs font-medium text-foreground">
                        {stage.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground leading-snug">
                        {stage.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => go('source', -1)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
