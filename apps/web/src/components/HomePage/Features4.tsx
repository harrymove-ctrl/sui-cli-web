import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Package, Network, Check } from 'lucide-react';

interface Features4Props {
  autoPlay?: boolean;
  autoPlayDelay?: number;
}

const tabs = [
  {
    icon: Terminal,
    title: 'Wallet Management',
    description:
      'Create, switch, and manage multiple addresses with real-time balance tracking. Your keys stay local.',
    features: [
      'Multi-address key management',
      'Real-time balance tracking',
      'Keys never leave your machine',
      'One-command address switching',
    ],
  },
  {
    icon: Send,
    title: 'Instant Transfers',
    description:
      'Send SUI and tokens with automatic gas estimation and transaction preview.',
    features: [
      'Automatic gas estimation',
      'Transaction preview before signing',
      'Coin merge & split utilities',
      'Full on-chain transfer history',
    ],
  },
  {
    icon: Package,
    title: 'Move Development',
    description:
      'Build, test, and publish Move packages directly from your browser with syntax highlighting.',
    features: [
      'In-browser Move file editor',
      'One-click build & publish',
      'Live terminal build output',
      'Package deploy history',
    ],
  },
  {
    icon: Network,
    title: 'Network & Faucet',
    description:
      'Switch between mainnet, testnet, devnet seamlessly. 8 integrated faucets for test tokens.',
    features: [
      'Mainnet, testnet, devnet switching',
      '8 integrated faucets',
      'Local network support',
      'Live gas & event analysis',
    ],
  },
];

export function Features4({ autoPlay = true, autoPlayDelay = 5000 }: Features4Props) {
  const [activeTab, setActiveTab] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autoPlay) return;

    intervalRef.current = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }, autoPlayDelay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, autoPlayDelay]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);

    if (autoPlay && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setActiveTab((prev) => (prev + 1) % tabs.length);
      }, autoPlayDelay);
    }
  };

  return (
    <section
      className="relative z-20 py-8 sm:py-10 lg:py-24 max-w-6xl mx-auto px-2 sm:px-4"
      aria-labelledby="features4-heading"
    >
      <div className="mb-6 sm:mb-12 text-center">
        <span className="text-foreground text-xs sm:text-sm tracking-wider uppercase" aria-hidden="true">
          Features
        </span>
        <h2
          id="features4-heading"
          className="text-2xl sm:text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-bold text-foreground mt-1 sm:mt-2"
        >
          Everything you need
        </h2>
        <p className="text-xs sm:text-sm lg:text-base max-w-2xl my-2 sm:my-4 mx-auto text-foreground/50 text-center font-normal px-4">
          A complete toolkit for Sui blockchain. All operations run locally.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Tab Navigation */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === index;

            return (
              <button
                key={tab.title}
                onClick={() => handleTabClick(index)}
                className={`w-full text-left p-4 md:p-5 rounded-xl border transition-colors duration-200 flex-1 flex items-start ${
                  isActive
                    ? 'bg-foreground/10 border-foreground/40'
                    : 'bg-background/30 border-foreground/10 hover:border-foreground/20'
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/5 text-foreground/70 border border-foreground/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm sm:text-base font-semibold mb-1 ${
                        isActive ? 'text-foreground' : 'text-foreground/80'
                      }`}
                    >
                      {tab.title}
                    </h3>
                    <p
                      className={`text-xs sm:text-sm line-clamp-2 ${
                        isActive ? 'text-foreground/60' : 'text-foreground/40'
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-8 flex">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl sm:rounded-2xl border border-foreground/10 bg-background/30 backdrop-blur-sm p-6 md:p-8 lg:p-10 flex-1"
            >
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-foreground/10 border border-foreground/30 mb-4 sm:mb-6">
                  {(() => {
                    const Icon = tabs[activeTab].icon;
                    return <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-foreground" />;
                  })()}
                </div>

                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-3">
                  {tabs[activeTab].title}
                </h3>

                <p className="text-sm sm:text-base md:text-lg text-foreground/50 leading-relaxed">
                  {tabs[activeTab].description}
                </p>
              </div>

              <div className="space-y-2 sm:space-y-3">
                {tabs[activeTab].features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-foreground/5 border border-foreground/5"
                  >
                    <div className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-foreground flex items-center justify-center mt-0.5">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-background" strokeWidth={3} />
                    </div>
                    <span className="text-xs sm:text-sm md:text-base text-foreground/70 font-medium">
                      {feature}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
