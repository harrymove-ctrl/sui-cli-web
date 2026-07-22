import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Terminal, Send, Zap, Network, Droplets, Package, Shield, Eye } from "lucide-react";

// Feature card data for Sui CLI Web
const features = [
  {
    title: "Wallet Management",
    description:
      "Create, switch, and manage multiple addresses with real-time balance tracking. Your keys stay local.",
    skeleton: <SkeletonWallet />,
    className:
      "col-span-1 lg:col-span-4 border-b lg:border-r border-white/10",
  },
  {
    title: "Instant Transfers",
    description:
      "Send SUI and tokens with automatic gas estimation and transaction preview.",
    skeleton: <SkeletonTransfer />,
    className: "border-b col-span-1 lg:col-span-2 border-white/10",
  },
  {
    title: "Move Development",
    description:
      "Build, test, and publish Move packages directly from your browser with syntax highlighting.",
    skeleton: <SkeletonMove />,
    className:
      "col-span-1 lg:col-span-3 lg:border-r border-white/10",
  },
  {
    title: "Network & Faucet",
    description:
      "Switch between mainnet, testnet, devnet seamlessly. 8 integrated faucets for test tokens.",
    skeleton: <SkeletonNetwork />,
    className: "col-span-1 lg:col-span-3 border-b lg:border-none border-white/10",
  },
];

export function FeaturesGrid() {
  return (
    <section className="relative z-20 py-8 sm:py-10 lg:py-24 max-w-6xl mx-auto px-2 sm:px-4" aria-labelledby="features-heading">
      <div className="mb-6 sm:mb-12 text-center">
        <span className="text-rose-400 text-xs sm:text-sm tracking-wider uppercase" aria-hidden="true">Features</span>
        <h2 id="features-heading" className="text-2xl sm:text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-bold text-white mt-1 sm:mt-2">
          Everything you need
        </h2>
        <p className="text-xs sm:text-sm lg:text-base max-w-2xl my-2 sm:my-4 mx-auto text-white/50 text-center font-normal px-4">
          A complete toolkit for Sui blockchain. All operations run locally.
        </p>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-6 border rounded-lg sm:rounded-xl border-white/10 bg-black/30 backdrop-blur-sm" role="list" aria-label="Feature cards">
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className} title={feature.title}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              {/* Hide skeleton previews on mobile for cleaner UI */}
              <div className="hidden sm:block h-full w-full" aria-hidden="true">{feature.skeleton}</div>
            </FeatureCard>
          ))}
        </div>
      </div>

      {/* Status summary */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-4 sm:mt-8 text-center"
      >
        <div className="inline-flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 bg-black/40 border border-white/10 rounded-full text-xs sm:text-sm">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full" />
            <span className="text-green-400">6 stable</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-400 rounded-full animate-pulse" />
            <span className="text-rose-400">2 beta</span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}

const FeatureCard = ({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => {
  return (
    <article className={cn(`p-4 sm:p-4 md:p-8 relative overflow-hidden`, className)} role="listitem" aria-label={title}>
      {children}
    </article>
  );
};

const FeatureTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <h3 className="max-w-5xl mx-auto text-left tracking-tight text-white text-lg sm:text-xl md:text-2xl md:leading-snug font-semibold">
      {children}
    </h3>
  );
};

const FeatureDescription = ({ children }: { children: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-xs sm:text-sm md:text-base max-w-4xl text-left mx-auto",
        "text-white/50 font-normal",
        "text-left max-w-sm mx-0 my-1 sm:my-2"
      )}
    >
      {children}
    </p>
  );
};

// Skeleton: Wallet Management - Mock terminal UI
function SkeletonWallet() {
  return (
    <div className="relative flex py-4 sm:py-8 px-1 sm:px-2 gap-10 h-full">
      <div className="w-full p-3 sm:p-5 mx-auto bg-black/50 border border-white/10 rounded-lg shadow-2xl group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2 sm:space-y-3">
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 sm:gap-2 pb-2 sm:pb-3 border-b border-white/10">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-rose-500" />
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
            <span className="ml-1 sm:ml-2 text-xs sm:text-xs text-white/40 font-mono">sui-cli-web</span>
          </div>
          {/* Mock wallet list */}
          <div className="space-y-1.5 sm:space-y-2 font-mono text-xs sm:text-sm">
            <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded bg-rose-500/10 border border-rose-500/30">
              <Terminal className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400" />
              <span className="text-rose-300 text-[11px] sm:text-sm">0x7a8f...3d2e</span>
              <span className="ml-auto text-green-400 text-xs sm:text-xs">● active</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded bg-white/5">
              <Terminal className="w-3 h-3 sm:w-4 sm:h-4 text-white/40" />
              <span className="text-white/60 text-[11px] sm:text-sm">0x9c4b...8f1a</span>
              <span className="ml-auto text-white/30 text-xs sm:text-xs">12.5 SUI</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 p-2 rounded bg-white/5">
              <Terminal className="w-4 h-4 text-white/40" />
              <span className="text-white/60">0x2e6d...7c9b</span>
              <span className="ml-auto text-white/30">0.8 SUI</span>
            </div>
          </div>
          {/* Command line */}
          <div className="mt-auto pt-2 sm:pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono">
              <span className="text-rose-400">$</span>
              <span className="text-white/70 truncate">sui client switch</span>
              <span className="w-1.5 sm:w-2 h-3 sm:h-4 bg-rose-400 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 z-40 inset-x-0 h-20 sm:h-40 bg-gradient-to-t from-black via-black/80 to-transparent w-full pointer-events-none" />
    </div>
  );
}

// Skeleton: Transfer - Animated cards
function SkeletonTransfer() {
  const transfers = [
    { to: "0x7a8f...3d2e", amount: "5.0 SUI", status: "success" },
    { to: "0x9c4b...8f1a", amount: "2.5 SUI", status: "success" },
  ];

  const cardVariants = {
    whileHover: {
      scale: 1.05,
      rotate: 0,
      zIndex: 100,
    },
  };

  return (
    <div className="relative flex flex-col items-start p-2 sm:p-4 gap-2 sm:gap-4 h-full overflow-hidden">
      <div className="flex flex-col gap-2 sm:gap-3 w-full">
        {transfers.map((tx, idx) => (
          <motion.div
            variants={cardVariants}
            key={"transfer-" + idx}
            whileHover="whileHover"
            className="rounded-lg p-2 sm:p-3 bg-black/50 border border-white/10 flex items-center gap-2 sm:gap-3"
          >
            <Send className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400" />
            <div className="flex-1 min-w-0">
              <div className="text-white/80 text-xs sm:text-sm font-mono truncate">{tx.to}</div>
              <div className="text-white/40 text-xs sm:text-xs">{tx.amount}</div>
            </div>
            <span
              className={cn(
                "text-xs sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shrink-0",
                tx.status === "success"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              )}
            >
              {tx.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Skeleton: Move Development - Code editor mock
function SkeletonMove() {
  return (
    <div className="relative flex gap-10 h-full group/code pt-2 sm:pt-4">
      <div className="w-full mx-auto bg-black/50 border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/5 border-b border-white/10">
          <Package className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
          <span className="text-xs sm:text-xs text-white/60 font-mono truncate">sources/module.move</span>
        </div>
        <div className="p-2 sm:p-4 font-mono text-xs sm:text-sm space-y-0.5 sm:space-y-1">
          <div>
            <span className="text-purple-400">module</span>
            <span className="text-white/80"> pkg</span>
            <span className="text-rose-400">::</span>
            <span className="text-yellow-400">token</span>
            <span className="text-white/60"> {"{"}</span>
          </div>
          <div className="pl-2 sm:pl-4">
            <span className="text-purple-400">use</span>
            <span className="text-white/60"> sui::coin;</span>
          </div>
          <div className="pl-2 sm:pl-4 mt-1 sm:mt-2">
            <span className="text-purple-400">public fun</span>
            <span className="text-green-400"> mint</span>
            <span className="text-white/60">() {"{"}</span>
          </div>
          <div className="pl-4 sm:pl-8">
            <span className="text-white/40">// code</span>
          </div>
          <div className="pl-2 sm:pl-4">
            <span className="text-white/60">{"}"}</span>
          </div>
          <div>
            <span className="text-white/60">{"}"}</span>
          </div>
        </div>
        {/* Build status */}
        <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-500/10 border-t border-green-500/30 flex items-center gap-1.5 sm:gap-2">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
          <span className="text-green-400 text-xs sm:text-xs font-mono">Build OK • 0.8s</span>
        </div>
      </div>
    </div>
  );
}

// Skeleton: Network switcher with animated nodes
function SkeletonNetwork() {
  const networks = [
    { name: "mainnet", status: "connected", color: "green" },
    { name: "testnet", status: "available", color: "blue" },
    { name: "devnet", status: "available", color: "purple" },
  ];

  return (
    <div className="h-40 sm:h-60 flex flex-col items-center relative bg-transparent mt-3 sm:mt-6">
      {/* Network nodes visualization */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Center node */}
        <div className="absolute w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center z-10">
          <Network className="w-5 h-5 sm:w-8 sm:h-8 text-rose-400" />
        </div>

        {/* Orbiting nodes */}
        {networks.map((net, idx) => {
          const angle = (idx * 120) * (Math.PI / 180);
          const radius = typeof window !== 'undefined' && window.innerWidth < 640 ? 50 : 80;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={net.name}
              className={cn(
                "absolute w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center",
                net.color === "green" && "bg-green-500/20 border border-green-500/50",
                net.color === "blue" && "bg-blue-500/20 border border-blue-500/50",
                net.color === "purple" && "bg-purple-500/20 border border-purple-500/50"
              )}
              style={{ left: `calc(50% + ${x}px - 16px)`, top: `calc(50% + ${y}px - 16px)` }}
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: idx * 0.3,
              }}
            >
              <span className="text-xs sm:text-xs text-white/80 font-mono">{net.name.slice(0, 3)}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Faucet indicator */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
        <Droplets className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
        <span className="text-cyan-400 text-xs sm:text-xs font-mono">8 faucets</span>
      </div>
    </div>
  );
}
