import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, Boxes, Coins, Search, Sparkles, Wallet, Zap } from 'lucide-react';

/* Adapted from OriginKit/React Bits Pro "Hero 18" (command-palette hero), recolored from its
 * generic light/neutral SaaS look to this project's dark rose/pink terminal theme, and with
 * the mock search results swapped for this app's actual routes (wallets, coins, Move Studio,
 * inspector) instead of a generic docs/Slack/GitHub example. */

const scopes = [
  { label: 'All', count: 24, active: true },
  { label: 'Wallets', count: 5, active: false },
  { label: 'Objects', count: 1155, active: false },
  { label: 'Packages', count: 6, active: false },
];

const results: { icon: typeof Wallet; title: string; source: string; active: boolean }[] = [
  { icon: Wallet, title: 'Transfer 12 SUI to alias.sui', source: 'Wallets', active: true },
  { icon: Boxes, title: 'Publish counter_pkg to devnet', source: 'Move Studio', active: false },
  { icon: Coins, title: 'Merge 6 USDC coin objects', source: 'Coins', active: false },
  { icon: Sparkles, title: 'Explain this transaction', source: 'Inspector', active: false },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const headline: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  },
};

const panel: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.06,
      delayChildren: 0.2,
    },
  },
};

const row: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-1.5 text-[11px] font-medium text-white/60 shadow-sm">
      {children}
    </kbd>
  );
}

export function CommandPaletteHero() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-screen w-full items-start overflow-hidden px-4 pt-32 pb-16 sm:px-6 sm:pt-40 sm:pb-20 lg:items-center lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(250,250,250,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(250,250,250,0.05)_1px,transparent_1px)] bg-[size:96px_96px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_38%,black,transparent)]" />
        <div className="absolute left-[6%] top-[38%] hidden h-56 w-36 bg-[radial-gradient(rgba(250,250,250,0.1)_1px,transparent_1px)] bg-[size:11px_11px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] lg:block" />
        <div className="absolute right-[6%] top-[24%] hidden h-56 w-36 bg-[radial-gradient(rgba(250,250,250,0.1)_1px,transparent_1px)] bg-[size:11px_11px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] lg:block" />
        <div className="absolute left-1/2 top-1/3 h-[360px] w-[720px] max-w-[110vw] -translate-x-1/2 rounded-full bg-rose-500/10 blur-[110px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center text-center"
      >
        <motion.div
          variants={item}
          className="inline-flex items-center gap-2.5 rounded-full border border-rose-500/40 bg-rose-500/10 py-1.5 pl-1.5 pr-4 shadow-sm backdrop-blur"
        >
          <span className="inline-flex items-center rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-medium text-white">
            ⌘K
          </span>
          <span className="text-xs font-medium text-rose-300 sm:text-sm">
            Every Sui action, one command bar
          </span>
        </motion.div>

        <motion.h1
          variants={headline}
          className="mt-8 max-w-4xl text-4xl font-black leading-[1.02] tracking-tighter text-white sm:text-6xl md:text-7xl"
        >
          Your whole Sui stack,
          <br />
          <span className="bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 bg-clip-text text-transparent">
            one keystroke away.
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
        >
          sui-cli-web indexes your wallets, objects, packages, and Move tooling into a single
          command bar that runs 100% locally — zero cloud, max security.
        </motion.p>

        <motion.div
          variants={panel}
          className="mt-12 w-full max-w-2xl rounded-3xl border border-white/10 bg-black/70 text-left shadow-2xl shadow-black/50 backdrop-blur-md"
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <Search className="h-5 w-5 shrink-0 text-white/40" />
            <div className="flex min-w-0 flex-1 items-center">
              <span className="truncate text-sm text-white sm:text-base">transfer</span>
              {!reduceMotion && (
                <motion.span
                  aria-hidden="true"
                  className="ml-px inline-block h-5 w-px bg-white"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 1.06, times: [0, 0.5, 0.5, 1], repeat: Infinity }}
                />
              )}
            </div>
            <Key>esc</Key>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto px-3 pt-3">
            {scopes.map((scope) => (
              <span
                key={scope.label}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  scope.active ? 'bg-white/10 text-white' : 'text-white/50'
                }`}
              >
                {scope.label}
                <span className={scope.active ? 'text-white/30' : 'text-white/20'}>
                  {scope.count}
                </span>
              </span>
            ))}
          </div>

          <div className="px-5 pb-1 pt-4">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
              Top results
            </span>
          </div>

          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {results.map(({ icon: Icon, title, source, active }) => (
              <motion.div
                key={title}
                variants={row}
                className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 ${
                  active ? 'bg-white/[0.06]' : ''
                }`}
              >
                {active && !reduceMotion && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
                    initial={{ x: '-140%' }}
                    animate={{ x: '140%' }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      repeatDelay: 2.6,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="relative min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {title}
                </span>
                <span className="relative hidden shrink-0 text-xs text-white/30 sm:block">
                  {source}
                </span>
                {active && (
                  <span className="relative flex shrink-0 items-center gap-1.5 text-xs text-white/50">
                    <span className="hidden sm:inline">Open</span>
                    <Key>↵</Key>
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span className="flex items-center gap-1.5">
                <Key>↑</Key>
                <Key>↓</Key>
                <span className="hidden sm:inline">navigate</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Key>↵</Key>
                <span className="hidden sm:inline">open</span>
              </span>
            </div>
            <span className="text-xs font-medium text-white/30">sui-cli-web</span>
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-10 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row"
        >
          <button
            onClick={() => navigate('/app')}
            className="group inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-colors duration-200 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:w-auto sm:px-7"
          >
            <Zap className="h-4 w-4" />
            Open sui-cli-web
            <ArrowRight className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="flex items-center gap-2 text-sm text-white/40">
            or press <Key>⌘</Key> <Key>K</Key> anywhere
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
